/**
 * Exercise library: the user's own list of exercises, plus the membership check that decides delete vs archive.
 *
 * Part of the `@/db` data layer: screens import from `@/db`, never from here
 * directly. Rows come back snake_case and are mapped to camelCase domain types
 * in `./rows`; pure transformations live in `@/domain`.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import { type ExerciseRow, mapExercise } from '@/db/rows';
import type { Exercise, MuscleGroup } from '@/domain/types';

export async function getExercises(
  db: SQLiteDatabase,
  { includeArchived = false } = {},
): Promise<Exercise[]> {
  const rows = await db.getAllAsync<ExerciseRow>(
    `SELECT * FROM exercises ${includeArchived ? '' : 'WHERE archived = 0'} ORDER BY name`,
  );
  return rows.map(mapExercise);
}

export async function getExercise(db: SQLiteDatabase, id: number): Promise<Exercise | null> {
  const row = await db.getFirstAsync<ExerciseRow>('SELECT * FROM exercises WHERE id = ?', id);
  return row ? mapExercise(row) : null;
}

export async function createExercise(
  db: SQLiteDatabase,
  name: string,
  muscleGroup: MuscleGroup,
): Promise<number> {
  const res = await db.runAsync(
    'INSERT INTO exercises (name, muscle_group, is_custom, archived) VALUES (?, ?, 1, 0)',
    name,
    muscleGroup,
  );
  return res.lastInsertRowId;
}

export async function updateExercise(
  db: SQLiteDatabase,
  id: number,
  name: string,
  muscleGroup: MuscleGroup,
): Promise<void> {
  await db.runAsync('UPDATE exercises SET name = ?, muscle_group = ? WHERE id = ?', name, muscleGroup, id);
}

export async function setExerciseArchived(
  db: SQLiteDatabase,
  id: number,
  archived: boolean,
): Promise<void> {
  await db.runAsync('UPDATE exercises SET archived = ? WHERE id = ?', archived ? 1 : 0, id);
}

/**
 * Whether an exercise appears in any session (used to decide delete vs archive
 * in the UI). Checked against workout_exercises, not workout_sets: sets are
 * created lazily on first open, and workout_exercises.exercise_id has no ON
 * DELETE CASCADE — deleting an exercise that is merely part of a session would
 * fail with a raw FK error.
 */
export async function exerciseHasHistory(db: SQLiteDatabase, id: number): Promise<boolean> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM workout_exercises WHERE exercise_id = ?',
    id,
  );
  return (row?.n ?? 0) > 0;
}

export async function deleteExercise(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM exercises WHERE id = ?', id);
}
