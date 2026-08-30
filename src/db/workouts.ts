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
import { mergePlanExercises, type PlanExercises } from '@/domain/plans';
import type { Exercise, Workout, WorkoutExercise } from '@/domain/types';

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

export interface WorkoutSummary extends Workout {
  /** Distinct exercises with at least one performed set (reps entered). */
  exerciseCount: number;
  /** Performed sets (reps entered); carried-over-but-untouched rows don't count. */
  setCount: number;
  /** Σ weight_kg × reps across the session's sets (kg). */
  volume: number;
  gymName: string;
}

/**
 * Finished sessions with per-session counts for the history list, newest first.
 * Pass `range` to restrict to finished_at ∈ [from, to) — used by the calendar.
 */
export async function getFinishedWorkoutSummaries(
  db: SQLiteDatabase,
  range?: { from: string; to: string },
): Promise<WorkoutSummary[]> {
  // Correlated subqueries, not joins: joining workout_exercises AND workout_sets
  // at once would cross-multiply the rows and inflate the counts.
  // "Performed" = reps IS NOT NULL: opening an exercise pre-fills carried-over
  // weights with empty reps, so those unfilled rows must not count as done work.
  const rows = await db.getAllAsync<
    WorkoutRow & { exercise_count: number; set_count: number; volume: number; gym_name: string }
  >(
    // "Performed" = reps entered (strength) OR a cardio metric entered, so a
    // cardio-only session still counts. Opening an exercise pre-fills settings
    // with empty performance, so those untouched rows must not count.
    `SELECT w.*,
       (SELECT COUNT(DISTINCT ws.exercise_id) FROM workout_sets ws
          WHERE ws.workout_id = w.id
            AND (ws.reps IS NOT NULL OR ws.duration_sec IS NOT NULL OR ws.distance_km IS NOT NULL)) AS exercise_count,
       (SELECT COUNT(*) FROM workout_sets ws
          WHERE ws.workout_id = w.id
            AND (ws.reps IS NOT NULL OR ws.duration_sec IS NOT NULL OR ws.distance_km IS NOT NULL)) AS set_count,
       (SELECT COALESCE(SUM(ws.weight_kg * ws.reps), 0) FROM workout_sets ws
          WHERE ws.workout_id = w.id) AS volume,
       (SELECT g.name FROM gyms g WHERE g.id = w.gym_id) AS gym_name
     FROM workouts w
     WHERE w.finished_at IS NOT NULL
       ${range ? 'AND w.finished_at >= ? AND w.finished_at < ?' : ''}
     ORDER BY w.finished_at DESC`,
    ...(range ? [range.from, range.to] : []),
  );
  return rows.map((r) => ({
    ...mapWorkout(r),
    exerciseCount: r.exercise_count,
    setCount: r.set_count,
    volume: r.volume,
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
