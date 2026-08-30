/**
 * The SQLite database a component test runs against: real SQLite through
 * node:sqlite, not a mock. Screens then exercise the actual queries in `@/db`,
 * so a test failure means the flow is broken, not that a stub drifted.
 *
 * Registry rather than a parameter because `jest.mock` factories are hoisted
 * above any test-local variable — the mock reads the current database from
 * here.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { openDb } from '@/db/test-support/sqlite-adapter';
import { migrateDbIfNeeded } from '@/db/schema';

let current: SQLiteDatabase | null = null;

/** Fresh migrated database for one test. Call in `beforeEach`. */
export async function createTestDb(): Promise<SQLiteDatabase> {
  const { db } = openDb();
  await migrateDbIfNeeded(db);
  current = db;
  return db;
}

export function getTestDb(): SQLiteDatabase {
  if (!current) throw new Error('createTestDb() must run before rendering a screen');
  return current;
}
