/**
 * Set rows inside a session, and the gym-aware "letztes Mal" lookup that pre-fills them.
 *
 * Part of the `@/db` data layer: screens import from `@/db`, never from here
 * directly. Rows come back snake_case and are mapped to camelCase domain types
 * in `./rows`; pure transformations live in `@/domain`.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import { mapWorkoutSet, type WorkoutSetRow } from '@/db/rows';
import {
  type ExerciseBests,
  MAX_REPS_FOR_E1RM,
} from '@/domain/personal-records';
import { type PriorSet, toPriorSets } from '@/domain/sets';
import type { WorkoutSet } from '@/domain/types';

export async function getSetsForWorkoutExercise(
  db: SQLiteDatabase,
  workoutExerciseId: number,
): Promise<WorkoutSet[]> {
  const rows = await db.getAllAsync<WorkoutSetRow>(
    'SELECT * FROM workout_sets WHERE workout_exercise_id = ? ORDER BY set_number',
    workoutExerciseId,
  );
  return rows.map(mapWorkoutSet);
}

export interface SetProgress {
  total: number;
  done: number;
}

/** Per-workout-exercise set counts (total + done) for the session list, in one query. */
export async function getSetProgressForWorkout(
  db: SQLiteDatabase,
  workoutId: number,
): Promise<Map<number, SetProgress>> {
  const rows = await db.getAllAsync<{ workout_exercise_id: number; total: number; done: number }>(
    `SELECT workout_exercise_id, COUNT(*) AS total, SUM(done) AS done
     FROM workout_sets WHERE workout_id = ? GROUP BY workout_exercise_id`,
    workoutId,
  );
  const map = new Map<number, SetProgress>();
  for (const row of rows) {
    map.set(row.workout_exercise_id, { total: row.total, done: row.done });
  }
  return map;
}

export interface NewSet {
  workoutId: number;
  workoutExerciseId: number;
  exerciseId: number;
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  distanceKm?: number | null;
  durationSec?: number | null;
  level?: number | null;
  done: boolean;
}

export async function insertSet(db: SQLiteDatabase, set: NewSet): Promise<number> {
  const res = await db.runAsync(
    `INSERT INTO workout_sets
       (workout_id, workout_exercise_id, exercise_id, set_number, weight_kg, reps,
        distance_km, duration_sec, level, done)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    set.workoutId,
    set.workoutExerciseId,
    set.exerciseId,
    set.setNumber,
    set.weightKg,
    set.reps,
    set.distanceKm ?? null,
    set.durationSec ?? null,
    set.level ?? null,
    set.done ? 1 : 0,
  );
  return res.lastInsertRowId;
}

export interface SetFields {
  weightKg?: number | null;
  reps?: number | null;
  distanceKm?: number | null;
  durationSec?: number | null;
  level?: number | null;
  done: boolean;
}

/** Update all value columns of a set (missing fields become NULL). */
export async function updateSet(db: SQLiteDatabase, id: number, fields: SetFields): Promise<void> {
  await db.runAsync(
    `UPDATE workout_sets
       SET weight_kg = ?, reps = ?, distance_km = ?, duration_sec = ?, level = ?, done = ?
     WHERE id = ?`,
    fields.weightKg ?? null,
    fields.reps ?? null,
    fields.distanceKm ?? null,
    fields.durationSec ?? null,
    fields.level ?? null,
    fields.done ? 1 : 0,
    id,
  );
}

/** Renumber a set without touching its values (used when a set is deleted). */
export async function updateSetNumber(
  db: SQLiteDatabase,
  id: number,
  setNumber: number,
): Promise<void> {
  await db.runAsync('UPDATE workout_sets SET set_number = ? WHERE id = ?', setNumber, id);
}

export async function deleteSet(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM workout_sets WHERE id = ?', id);
}

export interface LastSetsResult {
  sets: PriorSet[];
  /** Name of the gym the sets came from when it is NOT the requested one; null otherwise. */
  sourceGymName: string | null;
}

/**
 * Last time's sets for an exercise, gym-aware: prefer the most recent *finished*
 * workout containing it in the SAME gym; fall back to any gym, reporting the
 * source gym's name so the UI can label the reference. Drives the kg pre-fill.
 */
export async function getLastSetsForExercise(
  db: SQLiteDatabase,
  exerciseId: number,
  gymId: number,
  excludeWorkoutId?: number,
): Promise<LastSetsResult> {
  const exclude = excludeWorkoutId ?? -1;

  let source = await db.getFirstAsync<{ id: number }>(
    `SELECT w.id FROM workouts w
     JOIN workout_sets s ON s.workout_id = w.id
     WHERE s.exercise_id = ? AND w.finished_at IS NOT NULL AND w.id != ? AND w.gym_id = ?
     ORDER BY w.finished_at DESC
     LIMIT 1`,
    exerciseId,
    exclude,
    gymId,
  );
  let sourceGymName: string | null = null;

  if (!source) {
    const fallback = await db.getFirstAsync<{ id: number; gym_name: string }>(
      `SELECT w.id, g.name AS gym_name FROM workouts w
       JOIN gyms g ON g.id = w.gym_id
       JOIN workout_sets s ON s.workout_id = w.id
       WHERE s.exercise_id = ? AND w.finished_at IS NOT NULL AND w.id != ?
       ORDER BY w.finished_at DESC
       LIMIT 1`,
      exerciseId,
      exclude,
    );
    if (!fallback) return { sets: [], sourceGymName: null };
    source = { id: fallback.id };
    sourceGymName = fallback.gym_name;
  }

  const rows = await db.getAllAsync<{
    set_number: number;
    weight_kg: number | null;
    reps: number | null;
    distance_km: number | null;
    duration_sec: number | null;
    level: number | null;
  }>(
    'SELECT set_number, weight_kg, reps, distance_km, duration_sec, level FROM workout_sets WHERE workout_id = ? AND exercise_id = ? ORDER BY set_number',
    source.id,
    exerciseId,
  );
  return {
    sets: toPriorSets(
      rows.map((r) => ({
        setNumber: r.set_number,
        weightKg: r.weight_kg,
        reps: r.reps,
        distanceKm: r.distance_km,
        durationSec: r.duration_sec,
        level: r.level,
      })),
    ),
    sourceGymName,
  };
}

/**
 * Everything a personal record has to beat for one exercise, in a single query:
 * how many other sessions logged it, plus the best weight, Epley estimate,
 * distance and speed ever recorded.
 *
 * `excludeWorkoutId` only narrows the session *count* — the running session's
 * own earlier sets still count towards the bests, because a record set an hour
 * ago is still a record. Aggregates skip carried-over rows the same way the
 * history does: a weight without reps was never lifted.
 */
export async function getExerciseBests(
  db: SQLiteDatabase,
  exerciseId: number,
  excludeWorkoutId?: number,
): Promise<ExerciseBests> {
  const row = await db.getFirstAsync<{
    prior_sessions: number;
    top_weight: number | null;
    top_e1rm: number | null;
    top_distance: number | null;
    top_pace: number | null;
  }>(
    `SELECT
       COUNT(DISTINCT CASE
         WHEN workout_id != ?
          AND (reps IS NOT NULL OR distance_km IS NOT NULL OR duration_sec IS NOT NULL)
         THEN workout_id END) AS prior_sessions,
       MAX(CASE WHEN reps >= 1 THEN weight_kg END) AS top_weight,
       MAX(CASE WHEN reps >= 1 AND reps <= ${MAX_REPS_FOR_E1RM} AND weight_kg > 0
                THEN weight_kg * (1 + reps / 30.0) END) AS top_e1rm,
       MAX(distance_km) AS top_distance,
       MAX(CASE WHEN distance_km > 0 AND duration_sec > 0
                THEN distance_km / (duration_sec / 3600.0) END) AS top_pace
     FROM workout_sets
     WHERE exercise_id = ?`,
    excludeWorkoutId ?? -1,
    exerciseId,
  );
  return {
    priorSessions: row?.prior_sessions ?? 0,
    topWeightKg: row?.top_weight ?? null,
    topE1rm: row?.top_e1rm ?? null,
    topDistanceKm: row?.top_distance ?? null,
    topPaceKmh: row?.top_pace ?? null,
  };
}
