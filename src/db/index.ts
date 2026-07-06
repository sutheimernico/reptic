/**
 * Typed data layer over expo-sqlite. Screens call these functions; nothing else
 * touches SQL. Rows come back with snake_case columns and are mapped to the
 * camelCase domain types here. Pure transformations live in `@/domain`.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import type { BackupData, BackupPayload, PlanExerciseRow } from '@/domain/backup';
import { mergePlanExercises, type PlanExercises } from '@/domain/plans';
import { type PriorSet, toPriorSets } from '@/domain/sets';
import type {
  Exercise,
  MuscleGroup,
  Plan,
  PlanWithExercises,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/domain/types';

export { migrateDbIfNeeded, DATABASE_VERSION } from '@/db/schema';

// ---------- row shapes + mappers ----------

interface ExerciseRow {
  id: number;
  name: string;
  muscle_group: string;
  is_custom: number;
  archived: number;
}

const mapExercise = (r: ExerciseRow): Exercise => ({
  id: r.id,
  name: r.name,
  muscleGroup: r.muscle_group as MuscleGroup,
  isCustom: r.is_custom === 1,
  archived: r.archived === 1,
});

interface PlanRow {
  id: number;
  name: string;
  color: string;
  sort_order: number;
}

const mapPlan = (r: PlanRow): Plan => ({
  id: r.id,
  name: r.name,
  color: r.color,
  sortOrder: r.sort_order,
});

interface WorkoutRow {
  id: number;
  started_at: string;
  finished_at: string | null;
  plan_ids: string;
}

const mapWorkout = (r: WorkoutRow): Workout => ({
  id: r.id,
  startedAt: r.started_at,
  finishedAt: r.finished_at,
  planIds: safeParseIds(r.plan_ids),
});

function safeParseIds(json: string): number[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

interface WorkoutExerciseRow {
  id: number;
  workout_id: number;
  exercise_id: number;
  sort_order: number;
}

const mapWorkoutExercise = (r: WorkoutExerciseRow): WorkoutExercise => ({
  id: r.id,
  workoutId: r.workout_id,
  exerciseId: r.exercise_id,
  sortOrder: r.sort_order,
});

interface WorkoutSetRow {
  id: number;
  workout_id: number;
  workout_exercise_id: number;
  exercise_id: number;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  done: number;
}

const mapWorkoutSet = (r: WorkoutSetRow): WorkoutSet => ({
  id: r.id,
  workoutId: r.workout_id,
  workoutExerciseId: r.workout_exercise_id,
  exerciseId: r.exercise_id,
  setNumber: r.set_number,
  weightKg: r.weight_kg,
  reps: r.reps,
  done: r.done === 1,
});

// ---------- exercises ----------

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

/** Whether an exercise has ever been logged (used to decide delete vs archive in the UI). */
export async function exerciseHasHistory(db: SQLiteDatabase, id: number): Promise<boolean> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM workout_sets WHERE exercise_id = ?',
    id,
  );
  return (row?.n ?? 0) > 0;
}

export async function deleteExercise(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM exercises WHERE id = ?', id);
}

// ---------- plans ----------

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
  const row = await db.getFirstAsync<{ next: number }>(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM plans',
  );
  const res = await db.runAsync(
    'INSERT INTO plans (name, color, sort_order) VALUES (?, ?, ?)',
    name,
    color,
    row?.next ?? 0,
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

// ---------- workouts ----------

/** Create a session from the selected plans (merged, de-duplicated) and return its id. */
export async function startWorkout(
  db: SQLiteDatabase,
  planIds: number[],
  startedAt: string,
): Promise<number> {
  const plansEx: PlanExercises[] = [];
  for (const planId of planIds) {
    plansEx.push({ planId, exerciseIds: await getPlanExerciseIds(db, planId) });
  }
  const mergedExerciseIds = mergePlanExercises(plansEx);

  let workoutId = 0;
  await db.withTransactionAsync(async () => {
    const res = await db.runAsync(
      'INSERT INTO workouts (started_at, finished_at, plan_ids) VALUES (?, NULL, ?)',
      startedAt,
      JSON.stringify(planIds),
    );
    workoutId = res.lastInsertRowId;
    let sort = 0;
    for (const exerciseId of mergedExerciseIds) {
      await db.runAsync(
        'INSERT INTO workout_exercises (workout_id, exercise_id, sort_order) VALUES (?, ?, ?)',
        workoutId,
        exerciseId,
        sort,
      );
      sort += 1;
    }
  });
  return workoutId;
}

export async function getActiveWorkout(db: SQLiteDatabase): Promise<Workout | null> {
  const row = await db.getFirstAsync<WorkoutRow>(
    'SELECT * FROM workouts WHERE finished_at IS NULL ORDER BY started_at DESC LIMIT 1',
  );
  return row ? mapWorkout(row) : null;
}

export async function getWorkout(db: SQLiteDatabase, id: number): Promise<Workout | null> {
  const row = await db.getFirstAsync<WorkoutRow>('SELECT * FROM workouts WHERE id = ?', id);
  return row ? mapWorkout(row) : null;
}

export async function getFinishedWorkouts(db: SQLiteDatabase): Promise<Workout[]> {
  const rows = await db.getAllAsync<WorkoutRow>(
    'SELECT * FROM workouts WHERE finished_at IS NOT NULL ORDER BY finished_at DESC',
  );
  return rows.map(mapWorkout);
}

export interface WorkoutSummary extends Workout {
  exerciseCount: number;
  setCount: number;
  doneCount: number;
}

/** Finished sessions with per-session counts for the history list, newest first. */
export async function getFinishedWorkoutSummaries(db: SQLiteDatabase): Promise<WorkoutSummary[]> {
  // Correlated subqueries, not joins: joining workout_exercises AND workout_sets
  // at once would cross-multiply the rows and inflate the counts.
  const rows = await db.getAllAsync<
    WorkoutRow & { exercise_count: number; set_count: number; done_count: number }
  >(
    `SELECT w.*,
       (SELECT COUNT(*) FROM workout_exercises we WHERE we.workout_id = w.id) AS exercise_count,
       (SELECT COUNT(*) FROM workout_sets ws WHERE ws.workout_id = w.id) AS set_count,
       (SELECT COALESCE(SUM(ws.done), 0) FROM workout_sets ws WHERE ws.workout_id = w.id) AS done_count
     FROM workouts w
     WHERE w.finished_at IS NOT NULL
     ORDER BY w.finished_at DESC`,
  );
  return rows.map((r) => ({
    ...mapWorkout(r),
    exerciseCount: r.exercise_count,
    setCount: r.set_count,
    doneCount: r.done_count,
  }));
}

export async function finishWorkout(
  db: SQLiteDatabase,
  id: number,
  finishedAt: string,
): Promise<void> {
  await db.runAsync('UPDATE workouts SET finished_at = ? WHERE id = ?', finishedAt, id);
}

export async function deleteWorkout(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM workouts WHERE id = ?', id);
}

export interface WorkoutExerciseWithExercise extends WorkoutExercise {
  exercise: Exercise;
}

export async function getWorkoutExercises(
  db: SQLiteDatabase,
  workoutId: number,
): Promise<WorkoutExerciseWithExercise[]> {
  const rows = await db.getAllAsync<WorkoutExerciseRow & ExerciseRow>(
    `SELECT we.id AS id, we.workout_id AS workout_id, we.exercise_id AS exercise_id,
            we.sort_order AS sort_order,
            e.name AS name, e.muscle_group AS muscle_group, e.is_custom AS is_custom,
            e.archived AS archived
     FROM workout_exercises we
     JOIN exercises e ON e.id = we.exercise_id
     WHERE we.workout_id = ?
     ORDER BY we.sort_order`,
    workoutId,
  );
  return rows.map((r) => ({
    ...mapWorkoutExercise(r),
    exercise: mapExercise({
      id: r.exercise_id,
      name: r.name,
      muscle_group: r.muscle_group,
      is_custom: r.is_custom,
      archived: r.archived,
    }),
  }));
}

export async function addWorkoutExercise(
  db: SQLiteDatabase,
  workoutId: number,
  exerciseId: number,
): Promise<number> {
  const row = await db.getFirstAsync<{ next: number }>(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM workout_exercises WHERE workout_id = ?',
    workoutId,
  );
  const res = await db.runAsync(
    'INSERT INTO workout_exercises (workout_id, exercise_id, sort_order) VALUES (?, ?, ?)',
    workoutId,
    exerciseId,
    row?.next ?? 0,
  );
  return res.lastInsertRowId;
}

export async function removeWorkoutExercise(
  db: SQLiteDatabase,
  workoutExerciseId: number,
): Promise<void> {
  await db.runAsync('DELETE FROM workout_exercises WHERE id = ?', workoutExerciseId);
}

export async function reorderWorkoutExercises(
  db: SQLiteDatabase,
  orderedIds: number[],
): Promise<void> {
  await db.withTransactionAsync(async () => {
    let sort = 0;
    for (const id of orderedIds) {
      await db.runAsync('UPDATE workout_exercises SET sort_order = ? WHERE id = ?', sort, id);
      sort += 1;
    }
  });
}

// ---------- sets ----------

export async function getSetsForWorkoutExercise(
  db: SQLiteDatabase,
  workoutExerciseId: number,
): Promise<WorkoutSet[]> {
  const rows = await db.getAllAsync<WorkoutSetRow>(
    'SELECT * FROM workout_sets WHERE workout_exercise_id = ? ORDER BY set_number',
    workoutExerciseId,
  );
  return rows.map(mapWorkoutSet);
}

export interface SetProgress {
  total: number;
  done: number;
}

/** Per-workout-exercise set counts (total + done) for the session list, in one query. */
export async function getSetProgressForWorkout(
  db: SQLiteDatabase,
  workoutId: number,
): Promise<Map<number, SetProgress>> {
  const rows = await db.getAllAsync<{ workout_exercise_id: number; total: number; done: number }>(
    `SELECT workout_exercise_id, COUNT(*) AS total, SUM(done) AS done
     FROM workout_sets WHERE workout_id = ? GROUP BY workout_exercise_id`,
    workoutId,
  );
  const map = new Map<number, SetProgress>();
  for (const row of rows) {
    map.set(row.workout_exercise_id, { total: row.total, done: row.done });
  }
  return map;
}

export interface NewSet {
  workoutId: number;
  workoutExerciseId: number;
  exerciseId: number;
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  done: boolean;
}

export async function insertSet(db: SQLiteDatabase, set: NewSet): Promise<number> {
  const res = await db.runAsync(
    `INSERT INTO workout_sets
       (workout_id, workout_exercise_id, exercise_id, set_number, weight_kg, reps, done)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    set.workoutId,
    set.workoutExerciseId,
    set.exerciseId,
    set.setNumber,
    set.weightKg,
    set.reps,
    set.done ? 1 : 0,
  );
  return res.lastInsertRowId;
}

export async function updateSet(
  db: SQLiteDatabase,
  id: number,
  fields: { weightKg: number | null; reps: number | null; done: boolean; setNumber?: number },
): Promise<void> {
  if (fields.setNumber === undefined) {
    await db.runAsync(
      'UPDATE workout_sets SET weight_kg = ?, reps = ?, done = ? WHERE id = ?',
      fields.weightKg,
      fields.reps,
      fields.done ? 1 : 0,
      id,
    );
  } else {
    await db.runAsync(
      'UPDATE workout_sets SET weight_kg = ?, reps = ?, done = ?, set_number = ? WHERE id = ?',
      fields.weightKg,
      fields.reps,
      fields.done ? 1 : 0,
      fields.setNumber,
      id,
    );
  }
}

export async function deleteSet(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM workout_sets WHERE id = ?', id);
}

/**
 * Last time's sets for an exercise: the sets of the most recent *finished* workout
 * that contains it, ordered by set number. Drives the kg pre-fill and grey reference.
 */
export async function getLastSetsForExercise(
  db: SQLiteDatabase,
  exerciseId: number,
  excludeWorkoutId?: number,
): Promise<PriorSet[]> {
  const exclude = excludeWorkoutId ?? -1;
  const rows = await db.getAllAsync<{ set_number: number; weight_kg: number | null; reps: number | null }>(
    `SELECT ws.set_number, ws.weight_kg, ws.reps
     FROM workout_sets ws
     WHERE ws.exercise_id = ?
       AND ws.workout_id = (
         SELECT w.id FROM workouts w
         JOIN workout_sets s ON s.workout_id = w.id
         WHERE s.exercise_id = ? AND w.finished_at IS NOT NULL AND w.id != ?
         ORDER BY w.finished_at DESC
         LIMIT 1
       )
     ORDER BY ws.set_number`,
    exerciseId,
    exerciseId,
    exclude,
  );
  return toPriorSets(
    rows.map((r) => ({ setNumber: r.set_number, weightKg: r.weight_kg, reps: r.reps })),
  );
}

// ---------- settings ----------

export async function getSetting(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

export async function setSetting(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}

// ---------- backup ----------

export async function exportAllData(
  db: SQLiteDatabase,
  exportedAt: string,
): Promise<BackupPayload> {
  const exercises = (await db.getAllAsync<ExerciseRow>('SELECT * FROM exercises')).map(mapExercise);
  const plans = (await db.getAllAsync<PlanRow>('SELECT * FROM plans')).map(mapPlan);
  const planExercises = await db.getAllAsync<PlanExerciseRow>(
    `SELECT plan_id AS planId, exercise_id AS exerciseId, sort_order AS sortOrder FROM plan_exercises`,
  );
  const workouts = (await db.getAllAsync<WorkoutRow>('SELECT * FROM workouts')).map(mapWorkout);
  const workoutExercises = (
    await db.getAllAsync<WorkoutExerciseRow>('SELECT * FROM workout_exercises')
  ).map(mapWorkoutExercise);
  const workoutSets = (await db.getAllAsync<WorkoutSetRow>('SELECT * FROM workout_sets')).map(
    mapWorkoutSet,
  );
  return { exportedAt, exercises, plans, planExercises, workouts, workoutExercises, workoutSets };
}

/** Replace ALL data with the backup's contents (used by Import). Runs in one transaction. */
export async function importAllData(db: SQLiteDatabase, data: BackupData): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const table of [
      'workout_sets',
      'workout_exercises',
      'workouts',
      'plan_exercises',
      'plans',
      'exercises',
    ]) {
      await db.runAsync(`DELETE FROM ${table}`);
    }

    for (const e of data.exercises) {
      await db.runAsync(
        'INSERT INTO exercises (id, name, muscle_group, is_custom, archived) VALUES (?, ?, ?, ?, ?)',
        e.id,
        e.name,
        e.muscleGroup,
        e.isCustom ? 1 : 0,
        e.archived ? 1 : 0,
      );
    }
    for (const p of data.plans) {
      await db.runAsync(
        'INSERT INTO plans (id, name, color, sort_order) VALUES (?, ?, ?, ?)',
        p.id,
        p.name,
        p.color,
        p.sortOrder,
      );
    }
    for (const pe of data.planExercises) {
      await db.runAsync(
        'INSERT INTO plan_exercises (plan_id, exercise_id, sort_order) VALUES (?, ?, ?)',
        pe.planId,
        pe.exerciseId,
        pe.sortOrder,
      );
    }
    for (const w of data.workouts) {
      await db.runAsync(
        'INSERT INTO workouts (id, started_at, finished_at, plan_ids) VALUES (?, ?, ?, ?)',
        w.id,
        w.startedAt,
        w.finishedAt,
        JSON.stringify(w.planIds),
      );
    }
    for (const we of data.workoutExercises) {
      await db.runAsync(
        'INSERT INTO workout_exercises (id, workout_id, exercise_id, sort_order) VALUES (?, ?, ?, ?)',
        we.id,
        we.workoutId,
        we.exerciseId,
        we.sortOrder,
      );
    }
    for (const s of data.workoutSets) {
      await db.runAsync(
        `INSERT INTO workout_sets
           (id, workout_id, workout_exercise_id, exercise_id, set_number, weight_kg, reps, done)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        s.id,
        s.workoutId,
        s.workoutExerciseId,
        s.exerciseId,
        s.setNumber,
        s.weightKg,
        s.reps,
        s.done ? 1 : 0,
      );
    }
  });
}
