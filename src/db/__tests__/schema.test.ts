/**
 * Migration tests against real SQLite via node:sqlite. The `SQLiteDatabase`
 * adapter and its fidelity notes live in `./sqlite-adapter`, shared with the
 * query-layer tests.
 */
import type { DatabaseSync } from 'node:sqlite';

import { openDb } from '@/db/test-support/sqlite-adapter';
import { DATABASE_VERSION, migrateDbIfNeeded } from '@/db/schema';

const userVersion = (raw: DatabaseSync): number =>
  Number((raw.prepare('PRAGMA user_version').get() as { user_version: number }).user_version);

const count = (raw: DatabaseSync, table: string): number =>
  Number((raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n);

describe('migrateDbIfNeeded', () => {
  it('migrates a fresh database to the current version and seeds the library', async () => {
    const { raw, db } = openDb();
    await migrateDbIfNeeded(db);

    expect(userVersion(raw)).toBe(DATABASE_VERSION);
    expect(count(raw, 'gyms')).toBe(0);
    expect(count(raw, 'exercises')).toBe(18); // starter library seeded once
    raw.exec("INSERT INTO gyms (name, archived) VALUES ('Quakenbrück', 0)");
    expect(count(raw, 'gyms')).toBe(1);
  });

  it('does not seed when upgrading an existing v1 install', async () => {
    const { raw, db } = openDb();
    raw.exec(`
      CREATE TABLE exercises (id INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL,
        muscle_group TEXT NOT NULL, is_custom INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE plans (id INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL,
        color TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE plan_exercises (plan_id INTEGER NOT NULL, exercise_id INTEGER NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (plan_id, exercise_id));
      INSERT INTO exercises (name, muscle_group) VALUES ('Alt', 'Brust');
      PRAGMA user_version = 1;
    `);

    await migrateDbIfNeeded(db);

    // v2 wipes the old library and, because this is an upgrade (not a fresh
    // install), no starter set is seeded — the user owns their library.
    expect(userVersion(raw)).toBe(DATABASE_VERSION);
    expect(count(raw, 'exercises')).toBe(0);
  });

  it('adds cardio columns on a v2 upgrade without losing any data', async () => {
    const { raw, db } = openDb();
    // Build a v2-shaped database (workout_sets without the cardio columns) with
    // real user data, exactly what sits on Nico's device.
    raw.exec(`
      CREATE TABLE exercises (id INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL,
        muscle_group TEXT NOT NULL, is_custom INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE workout_sets (id INTEGER PRIMARY KEY NOT NULL, workout_id INTEGER NOT NULL,
        workout_exercise_id INTEGER NOT NULL, exercise_id INTEGER NOT NULL,
        set_number INTEGER NOT NULL, weight_kg REAL, reps INTEGER, done INTEGER NOT NULL DEFAULT 0);
      INSERT INTO exercises (name, muscle_group, is_custom) VALUES ('Bankdrücken', 'Brust', 1);
      INSERT INTO workout_sets (workout_id, workout_exercise_id, exercise_id, set_number, weight_kg, reps, done)
        VALUES (1, 1, 1, 1, 80, 8, 1);
      PRAGMA user_version = 2;
    `);

    await migrateDbIfNeeded(db);

    expect(userVersion(raw)).toBe(DATABASE_VERSION);
    const hasColumn = (name: string) =>
      Number(
        (
          raw
            .prepare("SELECT COUNT(*) AS n FROM pragma_table_info('workout_sets') WHERE name = ?")
            .get(name) as { n: number }
        ).n,
      ) === 1;
    expect(hasColumn('distance_km')).toBe(true);
    expect(hasColumn('duration_sec')).toBe(true);
    expect(hasColumn('level')).toBe(true);
    // existing data survives untouched
    expect(count(raw, 'exercises')).toBe(1);
    const set = raw.prepare('SELECT weight_kg, reps, distance_km FROM workout_sets').get() as {
      weight_kg: number;
      reps: number;
      distance_km: number | null;
    };
    expect(set.weight_kg).toBe(80);
    expect(set.reps).toBe(8);
    expect(set.distance_km).toBeNull();
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
