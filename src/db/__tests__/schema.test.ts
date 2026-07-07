/**
 * Migration tests against real SQLite via node:sqlite. The adapter mirrors the
 * semantics of expo-sqlite's native layer: `execAsync` is sqlite3_exec
 * (statement by statement, autocommit, stops at the first error — earlier
 * statements stay committed), `getFirstAsync` is a prepared statement
 * returning the first row. Verified against expo-sqlite@57 sources
 * (android/ios bindings call sqlite3_exec / sqlite3_prepare_v2 directly).
 */
import { DatabaseSync } from 'node:sqlite';

import type { SQLiteDatabase } from 'expo-sqlite';

import { DATABASE_VERSION, migrateDbIfNeeded } from '@/db/schema';

function adapt(db: DatabaseSync): SQLiteDatabase {
  return {
    execAsync: async (sql: string) => {
      db.exec(sql);
    },
    getFirstAsync: async (sql: string) => db.prepare(sql).get() ?? null,
  } as unknown as SQLiteDatabase;
}

function openDb(): { raw: DatabaseSync; db: SQLiteDatabase } {
  const raw = new DatabaseSync(':memory:');
  return { raw, db: adapt(raw) };
}

const userVersion = (raw: DatabaseSync): number =>
  Number((raw.prepare('PRAGMA user_version').get() as { user_version: number }).user_version);

const count = (raw: DatabaseSync, table: string): number =>
  Number((raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n);

describe('migrateDbIfNeeded', () => {
  it('migrates a fresh database to the current version', async () => {
    const { raw, db } = openDb();
    await migrateDbIfNeeded(db);

    expect(userVersion(raw)).toBe(DATABASE_VERSION);
    raw.exec("INSERT INTO gyms (name, archived) VALUES ('Quakenbrück', 0)");
    raw.exec("INSERT INTO exercises (name, muscle_group, is_custom, archived) VALUES ('Bankdrücken', 'Brust', 1, 0)");
    expect(count(raw, 'gyms')).toBe(1);
    expect(count(raw, 'exercises')).toBe(1);
  });

  it('is a no-op when already at the current version', async () => {
    const { raw, db } = openDb();
    await migrateDbIfNeeded(db);
    raw.exec("INSERT INTO gyms (name, archived) VALUES ('Berge', 0)");

    await migrateDbIfNeeded(db);
    expect(count(raw, 'gyms')).toBe(1);
  });

  // The old non-atomic migration set user_version only as the final statement.
  // A Metro reload between execAsync calls left user_version=0 with tables
  // already created, and every later launch died on "table X already exists".
  it('recovers from an interrupted run (schema applied, user_version never set)', async () => {
    const { raw, db } = openDb();
    await migrateDbIfNeeded(db);
    raw.exec('PRAGMA user_version = 0'); // simulate: interrupt before version bump

    await expect(migrateDbIfNeeded(db)).resolves.toBeUndefined();
    expect(userVersion(raw)).toBe(DATABASE_VERSION);
    raw.exec("INSERT INTO gyms (name, archived) VALUES ('Berge', 0)");
    expect(count(raw, 'gyms')).toBe(1);
  });

  it('recovers when only part of the schema survived the interrupt', async () => {
    const { raw, db } = openDb();
    await migrateDbIfNeeded(db);
    raw.exec('PRAGMA user_version = 0');
    raw.exec('DROP TABLE gyms'); // simulate: interrupt before the v2 step

    await expect(migrateDbIfNeeded(db)).resolves.toBeUndefined();
    expect(userVersion(raw)).toBe(DATABASE_VERSION);
    raw.exec("INSERT INTO gyms (name, archived) VALUES ('Berge', 0)");
    expect(count(raw, 'gyms')).toBe(1);
  });

  // sqlite3_exec commits each statement individually (autocommit); without a
  // wrapping transaction a mid-script error leaves a half-applied migration.
  it('rolls back everything when a migration statement fails', async () => {
    const { raw, db } = openDb();
    // corrupt v1 state: version says 1, but the plans table is missing, so the
    // v2 step fails at "DELETE FROM plans" — after gyms was already created.
    raw.exec(`
      CREATE TABLE exercises (id INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL,
        muscle_group TEXT NOT NULL, is_custom INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE plan_exercises (plan_id INTEGER NOT NULL, exercise_id INTEGER NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (plan_id, exercise_id));
      CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
      PRAGMA user_version = 1;
    `);

    await expect(migrateDbIfNeeded(db)).rejects.toThrow();
    expect(userVersion(raw)).toBe(1); // version untouched → next launch retries
    const gyms = raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'gyms'")
      .get();
    expect(gyms).toBeUndefined(); // nothing half-applied
  });

  // expo-sqlite caches the native connection across Metro reloads. A reload
  // that kills the JS context mid-withTransactionAsync leaves an open
  // transaction on that connection; the reloaded app inherits it and every
  // "successful" write silently vanishes on the eventual rollback.
  it('clears an orphaned transaction inherited from a killed JS context', async () => {
    const { raw, db } = openDb();
    await migrateDbIfNeeded(db);
    raw.exec("INSERT INTO gyms (name, archived) VALUES ('Quakenbrück', 0)");
    // simulate: BEGIN from withTransactionAsync, then the JS context dies
    raw.exec('BEGIN');
    raw.exec("INSERT INTO workouts (started_at, finished_at, plan_ids, gym_id) VALUES ('2026-07-07', NULL, '[]', 1)");

    await migrateDbIfNeeded(db); // reloaded app re-runs onInit on the cached connection

    // the orphaned transaction is gone: writes commit for real again
    raw.exec("INSERT INTO gyms (name, archived) VALUES ('Berge', 0)");
    expect(() => raw.exec('BEGIN; COMMIT;')).not.toThrow(); // not inside a transaction
    expect(count(raw, 'gyms')).toBe(2);
    expect(count(raw, 'workouts')).toBe(0); // the zombie write was rolled back
  });

  it('serializes concurrent runs (Fast Refresh remounts onInit while one is in flight)', async () => {
    const { raw, db } = openDb();
    const results = await Promise.allSettled([migrateDbIfNeeded(db), migrateDbIfNeeded(db)]);

    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
    expect(userVersion(raw)).toBe(DATABASE_VERSION);
    raw.exec("INSERT INTO gyms (name, archived) VALUES ('Quakenbrück', 0)");
    expect(count(raw, 'gyms')).toBe(1);
  });
});
