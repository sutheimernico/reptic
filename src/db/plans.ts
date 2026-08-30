/**
 * Trainingspläne: named, colored groups of exercises that seed a session.
 *
 * Part of the `@/db` data layer: screens import from `@/db`, never from here
 * directly. Rows come back snake_case and are mapped to camelCase domain types
 * in `./rows`; pure transformations live in `@/domain`.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import { mapPlan, type PlanRow } from '@/db/rows';
import type { Plan, PlanWithExercises } from '@/domain/types';

export async function getPlans(db: SQLiteDatabase): Promise<Plan[]> {
  const rows = await db.getAllAsync<PlanRow>('SELECT * FROM plans ORDER BY sort_order, name');
  return rows.map(mapPlan);
}

export async function getPlan(db: SQLiteDatabase, id: number): Promise<Plan | null> {
  const row = await db.getFirstAsync<PlanRow>('SELECT * FROM plans WHERE id = ?', id);
  return row ? mapPlan(row) : null;
}

export async function getPlanExerciseIds(db: SQLiteDatabase, planId: number): Promise<number[]> {
  const rows = await db.getAllAsync<{ exercise_id: number }>(
    'SELECT exercise_id FROM plan_exercises WHERE plan_id = ? ORDER BY sort_order',
    planId,
  );
  return rows.map((r) => r.exercise_id);
}

export async function getPlansWithExercises(db: SQLiteDatabase): Promise<PlanWithExercises[]> {
  const plans = await getPlans(db);
  const result: PlanWithExercises[] = [];
  for (const plan of plans) {
    result.push({ ...plan, exerciseIds: await getPlanExerciseIds(db, plan.id) });
  }
  return result;
}

export async function createPlan(db: SQLiteDatabase, name: string, color: string): Promise<number> {
  // Single statement so the MAX read and the insert can't interleave.
  const res = await db.runAsync(
    `INSERT INTO plans (name, color, sort_order)
     VALUES (?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM plans))`,
    name,
    color,
  );
  return res.lastInsertRowId;
}

export async function updatePlan(
  db: SQLiteDatabase,
  id: number,
  name: string,
  color: string,
): Promise<void> {
  await db.runAsync('UPDATE plans SET name = ?, color = ? WHERE id = ?', name, color, id);
}

export async function deletePlan(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM plans WHERE id = ?', id);
}

/** Replace a plan's exercise list wholesale, preserving the given order. */
export async function setPlanExercises(
  db: SQLiteDatabase,
  planId: number,
  exerciseIds: number[],
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM plan_exercises WHERE plan_id = ?', planId);
    let sort = 0;
    for (const exerciseId of exerciseIds) {
      await db.runAsync(
        'INSERT INTO plan_exercises (plan_id, exercise_id, sort_order) VALUES (?, ?, ?)',
        planId,
        exerciseId,
        sort,
      );
      sort += 1;
    }
  });
}
