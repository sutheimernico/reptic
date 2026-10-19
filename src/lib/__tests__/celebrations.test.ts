jest.mock('expo-sqlite', () => require('@/test-support/expo-sqlite-mock'));

import type { SQLiteDatabase } from 'expo-sqlite';

import { markGoalCelebrated, shouldCelebrateGoal } from '@/lib/celebrations';
import { createTestDb } from '@/test-support/db';

let db: SQLiteDatabase;
beforeEach(async () => {
  db = await createTestDb();
});

describe('goal celebrations', () => {
  it('fires once per goal and week', async () => {
    expect(await shouldCelebrateGoal(db, 'kg', '2026-W43')).toBe(true);
    await markGoalCelebrated(db, 'kg', '2026-W43');
    expect(await shouldCelebrateGoal(db, 'kg', '2026-W43')).toBe(false);
  });

  it('keeps kg and km apart', async () => {
    await markGoalCelebrated(db, 'kg', '2026-W43');
    expect(await shouldCelebrateGoal(db, 'km', '2026-W43')).toBe(true);
  });

  it('celebrates again in a new week', async () => {
    await markGoalCelebrated(db, 'kg', '2026-W43');
    expect(await shouldCelebrateGoal(db, 'kg', '2026-W44')).toBe(true);
  });
});
