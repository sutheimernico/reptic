/**
 * First-run seeding: turn the pure seed data into rows. Only called once, from the
 * v0 -> v1 migration, so it never runs against a populated database.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import { EXAMPLE_PLANS, EXERCISE_LIBRARY } from '@/domain/seed';

export async function seedDatabase(db: SQLiteDatabase): Promise<void> {
  const nameToId = new Map<string, number>();

  for (const exercise of EXERCISE_LIBRARY) {
    const res = await db.runAsync(
      'INSERT INTO exercises (name, muscle_group, is_custom, archived) VALUES (?, ?, 0, 0)',
      exercise.name,
      exercise.muscleGroup,
    );
    nameToId.set(exercise.name, res.lastInsertRowId);
  }

  let planSort = 0;
  for (const plan of EXAMPLE_PLANS) {
    const res = await db.runAsync(
      'INSERT INTO plans (name, color, sort_order) VALUES (?, ?, ?)',
      plan.name,
      plan.color,
      planSort,
    );
    planSort += 1;
    const planId = res.lastInsertRowId;

    let exerciseSort = 0;
    for (const name of plan.exerciseNames) {
      const exerciseId = nameToId.get(name);
      if (exerciseId === undefined) continue; // seed tests guarantee every name exists
      await db.runAsync(
        'INSERT INTO plan_exercises (plan_id, exercise_id, sort_order) VALUES (?, ?, ?)',
        planId,
        exerciseId,
        exerciseSort,
      );
      exerciseSort += 1;
    }
  }
}
