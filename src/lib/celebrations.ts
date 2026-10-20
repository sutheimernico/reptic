/**
 * "Celebrate each goal once per week": the flag lives in `settings` so a restart
 * or a second session in the same week does not fire the same confetti again.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import { getSetting, setSetting } from '@/db/settings';

export type GoalKind = 'kg' | 'km';

const keyFor = (goal: GoalKind, weekKey: string) => `celebrated_${goal}_${weekKey}`;

export async function shouldCelebrateGoal(
  db: SQLiteDatabase,
  goal: GoalKind,
  weekKey: string,
): Promise<boolean> {
  return (await getSetting(db, keyFor(goal, weekKey))) === null;
}

export async function markGoalCelebrated(
  db: SQLiteDatabase,
  goal: GoalKind,
  weekKey: string,
): Promise<void> {
  await setSetting(db, keyFor(goal, weekKey), '1');
}

/** Both goals already celebrated this week: nothing left for a tick to find out. */
export async function allGoalsCelebrated(db: SQLiteDatabase, weekKey: string): Promise<boolean> {
  return (
    !(await shouldCelebrateGoal(db, 'kg', weekKey)) && !(await shouldCelebrateGoal(db, 'km', weekKey))
  );
}
