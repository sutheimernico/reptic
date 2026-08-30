/**
 * Whole-database export and import behind the Backup buttons. Import replaces everything in one transaction.
 *
 * Part of the `@/db` data layer: screens import from `@/db`, never from here
 * directly. Rows come back snake_case and are mapped to camelCase domain types
 * in `./rows`; pure transformations live in `@/domain`.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import {
  mapExercise,
  mapGym,
  mapPlan,
  mapWorkout,
  mapWorkoutExercise,
  mapWorkoutSet,
} from '@/db/rows';
import { LAST_GYM_SETTING } from '@/db/settings';
import type { BackupData, BackupPayload, PlanExerciseRow } from '@/domain/backup';

async function selectAll<TRow, T>(
  db: SQLiteDatabase,
  sql: string,
  map: (row: TRow) => T,
): Promise<T[]> {
  return (await db.getAllAsync<TRow>(sql)).map(map);
}

export async function exportAllData(
  db: SQLiteDatabase,
  exportedAt: string,
): Promise<BackupPayload> {
  return {
    exportedAt,
    gyms: await selectAll(db, 'SELECT * FROM gyms', mapGym),
    exercises: await selectAll(db, 'SELECT * FROM exercises', mapExercise),
    plans: await selectAll(db, 'SELECT * FROM plans', mapPlan),
    planExercises: await selectAll(
      db,
      'SELECT * FROM plan_exercises',
      (r: { plan_id: number; exercise_id: number; sort_order: number }): PlanExerciseRow => ({
        planId: r.plan_id,
        exerciseId: r.exercise_id,
        sortOrder: r.sort_order,
      }),
    ),
    workouts: await selectAll(db, 'SELECT * FROM workouts', mapWorkout),
    workoutExercises: await selectAll(db, 'SELECT * FROM workout_exercises', mapWorkoutExercise),
    workoutSets: await selectAll(db, 'SELECT * FROM workout_sets', mapWorkoutSet),
  };
}

/** Replace ALL data with the backup's contents (used by Import). Runs in one transaction. */
export async function importAllData(db: SQLiteDatabase, data: BackupData): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const table of [
      'workout_sets',
      'workout_exercises',
      'workouts',
      'plan_exercises',
      'plans',
      'exercises',
      'gyms',
    ]) {
      await db.runAsync(`DELETE FROM ${table}`);
    }
    // Gym ids from another device can collide with different actual gyms —
    // drop the remembered last-gym id so Heute never pre-selects a wrong one.
    // Other settings (e.g. theme) are device-local and survive an import.
    await db.runAsync('DELETE FROM settings WHERE key = ?', LAST_GYM_SETTING);

    for (const g of data.gyms) {
      await db.runAsync(
        'INSERT INTO gyms (id, name, archived) VALUES (?, ?, ?)',
        g.id,
        g.name,
        g.archived ? 1 : 0,
      );
    }
    for (const e of data.exercises) {
      await db.runAsync(
        'INSERT INTO exercises (id, name, muscle_group, is_custom, archived) VALUES (?, ?, ?, ?, ?)',
        e.id,
        e.name,
        e.muscleGroup,
        e.isCustom ? 1 : 0,
        e.archived ? 1 : 0,
      );
    }
    for (const p of data.plans) {
      await db.runAsync(
        'INSERT INTO plans (id, name, color, sort_order) VALUES (?, ?, ?, ?)',
        p.id,
        p.name,
        p.color,
        p.sortOrder,
      );
    }
    for (const pe of data.planExercises) {
      await db.runAsync(
        'INSERT INTO plan_exercises (plan_id, exercise_id, sort_order) VALUES (?, ?, ?)',
        pe.planId,
        pe.exerciseId,
        pe.sortOrder,
      );
    }
    for (const w of data.workouts) {
      await db.runAsync(
        'INSERT INTO workouts (id, started_at, finished_at, plan_ids, gym_id) VALUES (?, ?, ?, ?, ?)',
        w.id,
        w.startedAt,
        w.finishedAt,
        JSON.stringify(w.planIds),
        w.gymId,
      );
    }
    for (const we of data.workoutExercises) {
      await db.runAsync(
        'INSERT INTO workout_exercises (id, workout_id, exercise_id, sort_order) VALUES (?, ?, ?, ?)',
        we.id,
        we.workoutId,
        we.exerciseId,
        we.sortOrder,
      );
    }
    for (const s of data.workoutSets) {
      await db.runAsync(
        `INSERT INTO workout_sets
           (id, workout_id, workout_exercise_id, exercise_id, set_number, weight_kg, reps,
            distance_km, duration_sec, level, done)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        s.id,
        s.workoutId,
        s.workoutExerciseId,
        s.exerciseId,
        s.setNumber,
        s.weightKg,
        s.reps,
        s.distanceKm ?? null,
        s.durationSec ?? null,
        s.level ?? null,
        s.done ? 1 : 0,
      );
    }
  });
}
