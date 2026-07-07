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
  Gym,
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
  gym_id: number;
}

const mapWorkout = (r: WorkoutRow): Workout => ({
  id: r.id,
  startedAt: r.started_at,
  finishedAt: r.finished_at,
  planIds: safeParseIds(r.plan_ids),
  gymId: r.gym_id,
});

interface GymRow {
  id: number;
  name: string;
  archived: number;
}

const mapGym = (r: GymRow): Gym => ({ id: r.id, name: r.name, archived: r.archived === 1 });

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

// ---------- gyms ----------

/** Settings key holding the id of the gym used for the last (or upcoming) session. */
export const LAST_GYM_SETTING = 'last_gym_id';

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
  gymId: number,
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
      'INSERT INTO workouts (started_at, finished_at, plan_ids, gym_id) VALUES (?, NULL, ?, ?)',
      startedAt,
      JSON.stringify(planIds),
      gymId,
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
  await setSetting(db, LAST_GYM_SETTING, String(gymId));
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
  /** Distinct exercises with at least one performed set (reps entered). */
  exerciseCount: number;
  /** Performed sets (reps entered); carried-over-but-untouched rows don't count. */
  setCount: number;
  /** Σ weight_kg × reps across the session's sets (kg). */
  volume: number;
  gymName: string;
}

/**
 * Finished sessions with per-session counts for the history list, newest first.
 * Pass `range` to restrict to finished_at ∈ [from, to) — used by the calendar.
 */
export async function getFinishedWorkoutSummaries(
  db: SQLiteDatabase,
  range?: { from: string; to: string },
): Promise<WorkoutSummary[]> {
  // Correlated subqueries, not joins: joining workout_exercises AND workout_sets
  // at once would cross-multiply the rows and inflate the counts.
  // "Performed" = reps IS NOT NULL: opening an exercise pre-fills carried-over
  // weights with empty reps, so those unfilled rows must not count as done work.
  const rows = await db.getAllAsync<
    WorkoutRow & { exercise_count: number; set_count: number; volume: number; gym_name: string }
  >(
    `SELECT w.*,
       (SELECT COUNT(DISTINCT ws.exercise_id) FROM workout_sets ws
          WHERE ws.workout_id = w.id AND ws.reps IS NOT NULL) AS exercise_count,
       (SELECT COUNT(*) FROM workout_sets ws
          WHERE ws.workout_id = w.id AND ws.reps IS NOT NULL) AS set_count,
       (SELECT COALESCE(SUM(ws.weight_kg * ws.reps), 0) FROM workout_sets ws
          WHERE ws.workout_id = w.id) AS volume,
       (SELECT g.name FROM gyms g WHERE g.id = w.gym_id) AS gym_name
     FROM workouts w
     WHERE w.finished_at IS NOT NULL
       ${range ? 'AND w.finished_at >= ? AND w.finished_at < ?' : ''}
     ORDER BY w.finished_at DESC`,
    ...(range ? [range.from, range.to] : []),
  );
  return rows.map((r) => ({
    ...mapWorkout(r),
    exerciseCount: r.exercise_count,
    setCount: r.set_count,
    volume: r.volume,
    gymName: r.gym_name,
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

export interface LastSetsResult {
  sets: PriorSet[];
  /** Name of the gym the sets came from when it is NOT the requested one; null otherwise. */
  sourceGymName: string | null;
}

/**
 * Last time's sets for an exercise, gym-aware: prefer the most recent *finished*
 * workout containing it in the SAME gym; fall back to any gym, reporting the
 * source gym's name so the UI can label the reference. Drives the kg pre-fill.
 */
export async function getLastSetsForExercise(
  db: SQLiteDatabase,
  exerciseId: number,
  gymId: number,
  excludeWorkoutId?: number,
): Promise<LastSetsResult> {
  const exclude = excludeWorkoutId ?? -1;

  let source = await db.getFirstAsync<{ id: number }>(
    `SELECT w.id FROM workouts w
     JOIN workout_sets s ON s.workout_id = w.id
     WHERE s.exercise_id = ? AND w.finished_at IS NOT NULL AND w.id != ? AND w.gym_id = ?
     ORDER BY w.finished_at DESC
     LIMIT 1`,
    exerciseId,
    exclude,
    gymId,
  );
  let sourceGymName: string | null = null;

  if (!source) {
    const fallback = await db.getFirstAsync<{ id: number; gym_name: string }>(
      `SELECT w.id, g.name AS gym_name FROM workouts w
       JOIN gyms g ON g.id = w.gym_id
       JOIN workout_sets s ON s.workout_id = w.id
       WHERE s.exercise_id = ? AND w.finished_at IS NOT NULL AND w.id != ?
       ORDER BY w.finished_at DESC
       LIMIT 1`,
      exerciseId,
      exclude,
    );
    if (!fallback) return { sets: [], sourceGymName: null };
    source = { id: fallback.id };
    sourceGymName = fallback.gym_name;
  }

  const rows = await db.getAllAsync<{ set_number: number; weight_kg: number | null; reps: number | null }>(
    'SELECT set_number, weight_kg, reps FROM workout_sets WHERE workout_id = ? AND exercise_id = ? ORDER BY set_number',
    source.id,
    exerciseId,
  );
  return {
    sets: toPriorSets(
      rows.map((r) => ({ setNumber: r.set_number, weightKg: r.weight_kg, reps: r.reps })),
    ),
    sourceGymName,
  };
}

export interface ExerciseSessionEntry {
  workoutId: number;
  /** finished_at, or started_at as a fallback. */
  date: string;
  gymName: string;
  sets: { setNumber: number; weightKg: number | null; reps: number | null }[];
}

/** The last `limit` finished sessions that logged this exercise, newest first, with its sets. */
export async function getExerciseSessionHistory(
  db: SQLiteDatabase,
  exerciseId: number,
  limit = 12,
): Promise<ExerciseSessionEntry[]> {
  const workouts = await db.getAllAsync<{
    id: number;
    started_at: string;
    finished_at: string | null;
    gym_name: string;
  }>(
    `SELECT w.id, w.started_at, w.finished_at,
       (SELECT g.name FROM gyms g WHERE g.id = w.gym_id) AS gym_name
     FROM workouts w
     WHERE w.finished_at IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM workout_sets ws
         WHERE ws.workout_id = w.id AND ws.exercise_id = ? AND ws.reps IS NOT NULL
       )
     ORDER BY w.finished_at DESC
     LIMIT ?`,
    exerciseId,
    limit,
  );
  const entries: ExerciseSessionEntry[] = [];
  for (const w of workouts) {
    // Only performed sets (reps entered) — skip carried-over rows left untouched.
    const rows = await db.getAllAsync<{ set_number: number; weight_kg: number | null; reps: number | null }>(
      'SELECT set_number, weight_kg, reps FROM workout_sets WHERE workout_id = ? AND exercise_id = ? AND reps IS NOT NULL ORDER BY set_number',
      w.id,
      exerciseId,
    );
    entries.push({
      workoutId: w.id,
      date: w.finished_at ?? w.started_at,
      gymName: w.gym_name,
      sets: rows.map((r) => ({ setNumber: r.set_number, weightKg: r.weight_kg, reps: r.reps })),
    });
  }
  return entries;
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
