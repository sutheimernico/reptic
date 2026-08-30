/**
 * Gyms: weights depend on the machines, so every session records where it happened.
 *
 * Part of the `@/db` data layer: screens import from `@/db`, never from here
 * directly. Rows come back snake_case and are mapped to camelCase domain types
 * in `./rows`; pure transformations live in `@/domain`.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import { type GymRow, mapGym } from '@/db/rows';
import type { Gym } from '@/domain/types';

export async function getGyms(
  db: SQLiteDatabase,
  { includeArchived = false } = {},
): Promise<Gym[]> {
  const rows = await db.getAllAsync<GymRow>(
    `SELECT * FROM gyms ${includeArchived ? '' : 'WHERE archived = 0'} ORDER BY name`,
  );
  return rows.map(mapGym);
}

export async function getGym(db: SQLiteDatabase, id: number): Promise<Gym | null> {
  const row = await db.getFirstAsync<GymRow>('SELECT * FROM gyms WHERE id = ?', id);
  return row ? mapGym(row) : null;
}

export async function createGym(db: SQLiteDatabase, name: string): Promise<number> {
  const res = await db.runAsync('INSERT INTO gyms (name, archived) VALUES (?, 0)', name);
  return res.lastInsertRowId;
}

export async function updateGym(db: SQLiteDatabase, id: number, name: string): Promise<void> {
  await db.runAsync('UPDATE gyms SET name = ? WHERE id = ?', name, id);
}

export async function setGymArchived(
  db: SQLiteDatabase,
  id: number,
  archived: boolean,
): Promise<void> {
  await db.runAsync('UPDATE gyms SET archived = ? WHERE id = ?', archived ? 1 : 0, id);
}

/** Whether any session references the gym (used to decide delete vs archive in the UI). */
export async function gymHasWorkouts(db: SQLiteDatabase, id: number): Promise<boolean> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM workouts WHERE gym_id = ?',
    id,
  );
  return (row?.n ?? 0) > 0;
}

export async function deleteGym(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM gyms WHERE id = ?', id);
}
