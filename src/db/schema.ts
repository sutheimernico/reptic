/**
 * SQLite schema and migrations. Version is bumped and a new `if (currentDbVersion === N)`
 * block added for each future change; existing blocks are never edited.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_VERSION = 2;

const V1_SCHEMA = `
CREATE TABLE exercises (
  id INTEGER PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  muscle_group TEXT NOT NULL,
  is_custom INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE plans (
  id INTEGER PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE plan_exercises (
  plan_id INTEGER NOT NULL,
  exercise_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (plan_id, exercise_id),
  FOREIGN KEY (plan_id) REFERENCES plans (id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE
);

CREATE TABLE workouts (
  id INTEGER PRIMARY KEY NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  plan_ids TEXT NOT NULL DEFAULT '[]'
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

CREATE TABLE settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE INDEX idx_workout_sets_exercise ON workout_sets (exercise_id);
CREATE INDEX idx_workout_exercises_workout ON workout_exercises (workout_id);
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

-- Drop children BEFORE deleting from parents: with foreign_keys = ON, deleting
-- exercises while workout_exercises/workout_sets rows still reference them
-- fails (their FKs have no ON DELETE action). IF EXISTS keeps a previously
-- interrupted run of this migration retryable.
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

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  // foreign_keys is per-connection and off by default in SQLite.
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentDbVersion = row?.user_version ?? 0;

  if (currentDbVersion >= DATABASE_VERSION) return;

  if (currentDbVersion === 0) {
    await db.execAsync(`PRAGMA journal_mode = 'wal';${V1_SCHEMA}`);
    currentDbVersion = 1;
  }

  if (currentDbVersion === 1) {
    await db.execAsync(V2_MIGRATION);
    currentDbVersion = 2;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
