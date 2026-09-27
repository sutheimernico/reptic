/**
 * Sessions: starting one from plans, the history summaries, and the per-exercise session history behind the progression screen.
 *
 * Part of the `@/db` data layer: screens import from `@/db`, never from here
 * directly. Rows come back snake_case and are mapped to camelCase domain types
 * in `./rows`; pure transformations live in `@/domain`.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import { getPlanExerciseIds } from '@/db/plans';
import {
  type ExerciseRow,
  mapExercise,
  mapWorkout,
  mapWorkoutExercise,
  type WorkoutExerciseRow,
  type WorkoutRow,
} from '@/db/rows';
import { LAST_GYM_SETTING, setSetting } from '@/db/settings';
import { mapSessionTotals, sessionTotalsSql, type SessionTotalsRow } from '@/db/totals';
import { mergePlanExercises, type PlanExercises } from '@/domain/plans';
import type { SessionMuscleTotals } from '@/domain/weeks';
import type {
  Exercise,
  MuscleGroup,
  SessionTotals,
  Workout,
  WorkoutExercise,
} from '@/domain/types';

export async function startWorkout(
  db: SQLiteDatabase,
  planIds: number[],
  gymId: number,
  startedAt: string,
): Promise<number> {
  const plansEx: PlanExercises[] = [];
  for (const planId of planIds) {
    plansEx.push({ planId, exerciseIds: await getPlanExerciseIds(db, planId) });
  }
  const mergedExerciseIds = mergePlanExercises(plansEx);

  let workoutId = 0;
  await db.withTransactionAsync(async () => {
    const res = await db.runAsync(
      'INSERT INTO workouts (started_at, finished_at, plan_ids, gym_id) VALUES (?, NULL, ?, ?)',
      startedAt,
      JSON.stringify(planIds),
      gymId,
    );
    workoutId = res.lastInsertRowId;
    let sort = 0;
    for (const exerciseId of mergedExerciseIds) {
      await db.runAsync(
        'INSERT INTO workout_exercises (workout_id, exercise_id, sort_order) VALUES (?, ?, ?)',
        workoutId,
        exerciseId,
        sort,
      );
      sort += 1;
    }
  });
  await setSetting(db, LAST_GYM_SETTING, String(gymId));
  return workoutId;
}

export async function getActiveWorkout(db: SQLiteDatabase): Promise<Workout | null> {
  const row = await db.getFirstAsync<WorkoutRow>(
    'SELECT * FROM workouts WHERE finished_at IS NULL ORDER BY started_at DESC LIMIT 1',
  );
  return row ? mapWorkout(row) : null;
}

export async function getWorkout(db: SQLiteDatabase, id: number): Promise<Workout | null> {
  const row = await db.getFirstAsync<WorkoutRow>('SELECT * FROM workouts WHERE id = ?', id);
  return row ? mapWorkout(row) : null;
}

export interface WorkoutSummary extends Workout, SessionTotals {
  gymName: string;
}

/**
 * Finished sessions with per-session totals for the history list, newest first.
 * Pass `range` to restrict to finished_at ∈ [from, to) — used by the calendar.
 *
 * The totals come from one grouped pass over the sets (see `./totals`), joined
 * once — joining workout_exercises AND workout_sets directly would
 * cross-multiply the rows and inflate the counts.
 */
export async function getFinishedWorkoutSummaries(
  db: SQLiteDatabase,
  range?: { from: string; to: string },
): Promise<WorkoutSummary[]> {
  const rows = await db.getAllAsync<WorkoutRow & SessionTotalsRow & { gym_name: string }>(
    `SELECT w.*, g.name AS gym_name,
            t.exercise_count, t.set_count, t.volume, t.distance
     FROM workouts w
     LEFT JOIN gyms g ON g.id = w.gym_id
     LEFT JOIN (${sessionTotalsSql()}) t ON t.workout_id = w.id
     WHERE w.finished_at IS NOT NULL
       ${range ? 'AND w.finished_at >= ? AND w.finished_at < ?' : ''}
     ORDER BY w.finished_at DESC`,
    ...(range ? [range.from, range.to] : []),
  );
  return rows.map((r) => ({
    ...mapWorkout(r),
    ...mapSessionTotals(r),
    gymName: r.gym_name,
  }));
}

export async function finishWorkout(
  db: SQLiteDatabase,
  id: number,
  finishedAt: string,
): Promise<void> {
  await db.runAsync('UPDATE workouts SET finished_at = ? WHERE id = ?', finishedAt, id);
}

export async function deleteWorkout(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM workouts WHERE id = ?', id);
}

export interface WorkoutExerciseWithExercise extends WorkoutExercise {
  exercise: Exercise;
}

export async function getWorkoutExercises(
  db: SQLiteDatabase,
  workoutId: number,
): Promise<WorkoutExerciseWithExercise[]> {
  const rows = await db.getAllAsync<WorkoutExerciseRow & ExerciseRow>(
    `SELECT we.id AS id, we.workout_id AS workout_id, we.exercise_id AS exercise_id,
            we.sort_order AS sort_order,
            e.name AS name, e.muscle_group AS muscle_group, e.is_custom AS is_custom,
            e.archived AS archived
     FROM workout_exercises we
     JOIN exercises e ON e.id = we.exercise_id
     WHERE we.workout_id = ?
     ORDER BY we.sort_order`,
    workoutId,
  );
  return rows.map((r) => ({
    ...mapWorkoutExercise(r),
    exercise: mapExercise({
      id: r.exercise_id,
      name: r.name,
      muscle_group: r.muscle_group,
      is_custom: r.is_custom,
      archived: r.archived,
    }),
  }));
}

export async function addWorkoutExercise(
  db: SQLiteDatabase,
  workoutId: number,
  exerciseId: number,
): Promise<number> {
  // Single statement so the MAX read and the insert can't interleave.
  const res = await db.runAsync(
    `INSERT INTO workout_exercises (workout_id, exercise_id, sort_order)
     VALUES (?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1
                    FROM workout_exercises WHERE workout_id = ?))`,
    workoutId,
    exerciseId,
    workoutId,
  );
  return res.lastInsertRowId;
}

export async function removeWorkoutExercise(
  db: SQLiteDatabase,
  workoutExerciseId: number,
): Promise<void> {
  await db.runAsync('DELETE FROM workout_exercises WHERE id = ?', workoutExerciseId);
}

export async function reorderWorkoutExercises(
  db: SQLiteDatabase,
  orderedIds: number[],
): Promise<void> {
  await db.withTransactionAsync(async () => {
    let sort = 0;
    for (const id of orderedIds) {
      await db.runAsync('UPDATE workout_exercises SET sort_order = ? WHERE id = ?', sort, id);
      sort += 1;
    }
  });
}

export interface ExerciseSessionEntry {
  workoutId: number;
  /** finished_at, or started_at as a fallback. */
  date: string;
  gymName: string;
  sets: {
    setNumber: number;
    weightKg: number | null;
    reps: number | null;
    distanceKm: number | null;
    durationSec: number | null;
    level: number | null;
  }[];
}

/**
 * The last `limit` finished sessions that logged this exercise, newest first,
 * with its sets.
 *
 * One query, not one per session: the limited sessions are selected in a
 * sub-select and joined to their sets, then grouped in JS. `LEFT JOIN gyms`
 * (not a plain join) so a session whose gym row vanished — possible on
 * databases that predate foreign-key enforcement — still shows up.
 *
 * "Performed" means reps entered (strength) or any cardio metric entered, both
 * in the EXISTS filter and in the join: opening an exercise pre-fills carried
 * over settings with empty performance, and those rows are not work done.
 */
export async function getExerciseSessionHistory(
  db: SQLiteDatabase,
  exerciseId: number,
  limit = 12,
): Promise<ExerciseSessionEntry[]> {
  const rows = await db.getAllAsync<{
    id: number;
    started_at: string;
    finished_at: string | null;
    gym_name: string;
    set_number: number;
    weight_kg: number | null;
    reps: number | null;
    distance_km: number | null;
    duration_sec: number | null;
    level: number | null;
  }>(
    `SELECT w.id, w.started_at, w.finished_at, g.name AS gym_name,
            s.set_number, s.weight_kg, s.reps, s.distance_km, s.duration_sec, s.level
     FROM (
       SELECT id, started_at, finished_at, gym_id
       FROM workouts
       WHERE finished_at IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM workout_sets ws
           WHERE ws.workout_id = workouts.id AND ws.exercise_id = ?
             AND (ws.reps IS NOT NULL OR ws.duration_sec IS NOT NULL OR ws.distance_km IS NOT NULL)
         )
       ORDER BY finished_at DESC
       LIMIT ?
     ) w
     LEFT JOIN gyms g ON g.id = w.gym_id
     JOIN workout_sets s
       ON s.workout_id = w.id AND s.exercise_id = ?
          AND (s.reps IS NOT NULL OR s.duration_sec IS NOT NULL OR s.distance_km IS NOT NULL)
     ORDER BY w.finished_at DESC, s.set_number`,
    exerciseId,
    limit,
    exerciseId,
  );

  const entries: ExerciseSessionEntry[] = [];
  const byWorkout = new Map<number, ExerciseSessionEntry>();
  for (const r of rows) {
    let entry = byWorkout.get(r.id);
    if (!entry) {
      entry = {
        workoutId: r.id,
        date: r.finished_at ?? r.started_at,
        gymName: r.gym_name,
        sets: [],
      };
      byWorkout.set(r.id, entry);
      entries.push(entry); // rows arrive newest-first, so push order is the result order
    }
    entry.sets.push({
      setNumber: r.set_number,
      weightKg: r.weight_kg,
      reps: r.reps,
      distanceKm: r.distance_km,
      durationSec: r.duration_sec,
      level: r.level,
    });
  }
  return entries;
}

/**
 * Per-session, per-muscle-group totals for the weekly trends, in one aggregate
 * query. Bucketing into weeks happens in `@/domain/weeks`, not here: ISO weeks
 * depend on the device's local calendar, which SQLite has no notion of.
 *
 * `since` is an ISO timestamp; pass the start of the oldest week shown. Volume
 * counts only performed sets — a carried-over weight with no reps multiplies to
 * NULL and is skipped by SUM anyway, which is the behaviour we want.
 */
export async function getSessionMuscleTotals(
  db: SQLiteDatabase,
  since: string,
): Promise<SessionMuscleTotals[]> {
  const rows = await db.getAllAsync<{
    finished_at: string;
    muscle_group: MuscleGroup;
    volume: number;
    distance: number;
  }>(
    `SELECT w.finished_at, e.muscle_group,
            COALESCE(SUM(s.weight_kg * s.reps), 0) AS volume,
            COALESCE(SUM(s.distance_km), 0) AS distance
     FROM workout_sets s
     JOIN workouts w ON w.id = s.workout_id
     JOIN exercises e ON e.id = s.exercise_id
     WHERE w.finished_at IS NOT NULL AND w.finished_at >= ?
     GROUP BY w.id, e.muscle_group
     ORDER BY w.finished_at`,
    since,
  );
  return rows.map((r) => ({
    finishedAt: r.finished_at,
    muscleGroup: r.muscle_group,
    volumeKg: r.volume,
    distanceKm: r.distance,
  }));
}
