/**
 * SQLite schema and migrations. Version is bumped and a new `if (version === N)`
 * block added for each future change; existing blocks are never edited.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import type { MuscleGroup } from '@/domain/types';

export const DATABASE_VERSION = 2;

/**
 * Default exercise library, inserted once on a brand-new install so the app is
 * usable out of the box. NOT re-added on later launches, so deleting one keeps
 * it gone. Existing installs (already past v0) are untouched.
 */
const STARTER_EXERCISES: readonly (readonly [string, MuscleGroup])[] = [
  ['Brustpresse', 'Brust'],
  ['Obere Brustpresse', 'Brust'],
  ['Breites Rudern', 'Rücken'],
  ['Einarmiges Latziehen', 'Rücken'],
  ['Einarmiges Latrudern', 'Rücken'],
  ['Klimmzüge', 'Rücken'],
  ['Schulterdrücken', 'Schultern'],
  ['Seitheben', 'Schultern'],
  ['Beinbeuger', 'Beine'],
  ['Beinpresse', 'Beine'],
  ['Beinstrecker', 'Beine'],
  ['Wadenheben (Beinpresse)', 'Beine'],
  ['Wadenheben (sitzend)', 'Beine'],
  ['Bizeps-Curls (Kabelturm)', 'Bizeps'],
  ['Bizeps-Curls (Maschine)', 'Bizeps'],
  ['Hammer-Curls', 'Bizeps'],
  ['Trizeps (Überkopf)', 'Trizeps'],
  ['Trizeps drücken', 'Trizeps'],
];

// IF NOT EXISTS throughout: the pre-2026-07-07 migration code was not atomic,
// so devices may carry a half-applied schema with user_version still 0. This
// lets the migration re-run over such a state instead of dying on the first
// CREATE TABLE forever.
const V1_SCHEMA = `
CREATE TABLE IF NOT EXISTS exercises (
  id INTEGER PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  muscle_group TEXT NOT NULL,
  is_custom INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plan_exercises (
  plan_id INTEGER NOT NULL,
  exercise_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (plan_id, exercise_id),
  FOREIGN KEY (plan_id) REFERENCES plans (id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workouts (
  id INTEGER PRIMARY KEY NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  plan_ids TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS workout_exercises (
  id INTEGER PRIMARY KEY NOT NULL,
  workout_id INTEGER NOT NULL,
  exercise_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (workout_id) REFERENCES workouts (id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES exercises (id)
);

CREATE TABLE IF NOT EXISTS workout_sets (
  id INTEGER PRIMARY KEY NOT NULL,
  workout_id INTEGER NOT NULL,
  workout_exercise_id INTEGER NOT NULL,
  exercise_id INTEGER NOT NULL,
  set_number INTEGER NOT NULL,
  weight_kg REAL,
  reps INTEGER,
  done INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (workout_id) REFERENCES workouts (id) ON DELETE CASCADE,
  FOREIGN KEY (workout_exercise_id) REFERENCES workout_exercises (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workout_sets_exercise ON workout_sets (exercise_id);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout ON workout_exercises (workout_id);
`;

/**
 * V2: gyms + gym-aware workouts, and the switch to a user-owned library.
 * Wipes the seeded exercises/plans and all (test) history — deliberate product
 * decision: the app starts empty. The workouts family is dropped and recreated
 * so `gym_id` can be NOT NULL without an ALTER TABLE workaround.
 */
const V2_MIGRATION = `
CREATE TABLE IF NOT EXISTS gyms (
  id INTEGER PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0
);

DROP TABLE IF EXISTS workout_sets;
DROP TABLE IF EXISTS workout_exercises;
DROP TABLE IF EXISTS workouts;

DELETE FROM plan_exercises;
DELETE FROM plans;
DELETE FROM exercises;

CREATE TABLE workouts (
  id INTEGER PRIMARY KEY NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  plan_ids TEXT NOT NULL DEFAULT '[]',
  gym_id INTEGER NOT NULL,
  FOREIGN KEY (gym_id) REFERENCES gyms (id)
);

CREATE TABLE workout_exercises (
  id INTEGER PRIMARY KEY NOT NULL,
  workout_id INTEGER NOT NULL,
  exercise_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (workout_id) REFERENCES workouts (id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES exercises (id)
);

CREATE TABLE workout_sets (
  id INTEGER PRIMARY KEY NOT NULL,
  workout_id INTEGER NOT NULL,
  workout_exercise_id INTEGER NOT NULL,
  exercise_id INTEGER NOT NULL,
  set_number INTEGER NOT NULL,
  weight_kg REAL,
  reps INTEGER,
  done INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (workout_id) REFERENCES workouts (id) ON DELETE CASCADE,
  FOREIGN KEY (workout_exercise_id) REFERENCES workout_exercises (id) ON DELETE CASCADE
);

CREATE INDEX idx_workout_sets_exercise ON workout_sets (exercise_id);
CREATE INDEX idx_workout_exercises_workout ON workout_exercises (workout_id);
`;

// SQLiteProvider re-runs onInit on every remount (Fast Refresh does this
// constantly in dev), and expo-sqlite hands the SAME cached native connection
// to each run. Serialize them so two migrations never interleave.
let pendingMigration: Promise<void> = Promise.resolve();

export function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  const run = pendingMigration.then(() => migrate(db));
  pendingMigration = run.catch(() => undefined);
  return run;
}

async function migrate(db: SQLiteDatabase): Promise<void> {
  // A Metro reload can kill the JS context mid-withTransactionAsync. The
  // cached native connection then carries the open transaction into the next
  // app instance: every later write joins it, looks saved, and vanishes with
  // the eventual rollback. Nothing legitimate is in a transaction during
  // init, so clear any leftover one. (No-op error when there is none.)
  await db.execAsync('ROLLBACK').catch(() => undefined);

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const fromVersion = row?.user_version ?? 0;

  if (fromVersion < DATABASE_VERSION) {
    console.log(`[db] migrating schema v${fromVersion} -> v${DATABASE_VERSION}`);

    // journal_mode and foreign_keys cannot change inside a transaction, so
    // both precede BEGIN. foreign_keys must be OFF while migrating: the v2
    // step drops and recreates the workouts family, which FK enforcement
    // would reject halfway through (SQLite's recommended procedure for
    // destructive schema changes).
    await db.execAsync(`PRAGMA journal_mode = 'wal';`);
    await db.execAsync('PRAGMA foreign_keys = OFF;');

    // One exclusive transaction makes the migration atomic: an interrupt or a
    // failing statement rolls back everything INCLUDING user_version, so the
    // next launch retries from a clean state. Without it, sqlite3_exec
    // commits each statement individually and a mid-script failure strands
    // the schema half-applied with user_version never bumped.
    await db.execAsync('BEGIN EXCLUSIVE;');
    try {
      let version = fromVersion;
      if (version === 0) {
        await db.execAsync(V1_SCHEMA);
        version = 1;
      }
      if (version === 1) {
        await db.execAsync(V2_MIGRATION);
        version = 2;
      }
      // Seed the default library only on a truly fresh database, inside the
      // same transaction so a fresh install is all-or-nothing.
      if (fromVersion === 0) {
        await seedStarterExercises(db);
      }
      await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION};`);
      await db.execAsync('COMMIT;');
    } catch (error) {
      await db.execAsync('ROLLBACK;').catch(() => undefined);
      console.error('[db] migration failed, rolled back', error);
      throw error;
    }
    console.log('[db] migration done');
  }

  // Enforce foreign keys for all normal app operation (ON DELETE CASCADE
  // etc.). Per-connection and off by default, so set it on every init.
  await db.execAsync('PRAGMA foreign_keys = ON;');
}

async function seedStarterExercises(db: SQLiteDatabase): Promise<void> {
  for (const [name, group] of STARTER_EXERCISES) {
    await db.runAsync(
      'INSERT INTO exercises (name, muscle_group, is_custom, archived) VALUES (?, ?, 1, 0)',
      name,
      group,
    );
  }
}
