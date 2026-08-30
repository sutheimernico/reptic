/**
 * Row shapes as SQLite returns them (snake_case) and the mappers to the
 * camelCase domain types. Shared by every module of the data layer.
 */

import type {
  Exercise,
  Gym,
  MuscleGroup,
  Plan,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/domain/types';

export interface ExerciseRow {
  id: number;
  name: string;
  muscle_group: string;
  is_custom: number;
  archived: number;
}

export const mapExercise = (r: ExerciseRow): Exercise => ({
  id: r.id,
  name: r.name,
  muscleGroup: r.muscle_group as MuscleGroup,
  isCustom: r.is_custom === 1,
  archived: r.archived === 1,
});

export interface PlanRow {
  id: number;
  name: string;
  color: string;
  sort_order: number;
}

export const mapPlan = (r: PlanRow): Plan => ({
  id: r.id,
  name: r.name,
  color: r.color,
  sortOrder: r.sort_order,
});

export interface WorkoutRow {
  id: number;
  started_at: string;
  finished_at: string | null;
  plan_ids: string;
  gym_id: number;
}

export const mapWorkout = (r: WorkoutRow): Workout => ({
  id: r.id,
  startedAt: r.started_at,
  finishedAt: r.finished_at,
  planIds: safeParseIds(r.plan_ids),
  gymId: r.gym_id,
});

export interface GymRow {
  id: number;
  name: string;
  archived: number;
}

export const mapGym = (r: GymRow): Gym => ({ id: r.id, name: r.name, archived: r.archived === 1 });

function safeParseIds(json: string): number[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

export interface WorkoutExerciseRow {
  id: number;
  workout_id: number;
  exercise_id: number;
  sort_order: number;
}

export const mapWorkoutExercise = (r: WorkoutExerciseRow): WorkoutExercise => ({
  id: r.id,
  workoutId: r.workout_id,
  exerciseId: r.exercise_id,
  sortOrder: r.sort_order,
});

export interface WorkoutSetRow {
  id: number;
  workout_id: number;
  workout_exercise_id: number;
  exercise_id: number;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  distance_km: number | null;
  duration_sec: number | null;
  level: number | null;
  done: number;
}

export const mapWorkoutSet = (r: WorkoutSetRow): WorkoutSet => ({
  id: r.id,
  workoutId: r.workout_id,
  workoutExerciseId: r.workout_exercise_id,
  exerciseId: r.exercise_id,
  setNumber: r.set_number,
  weightKg: r.weight_kg,
  reps: r.reps,
  distanceKm: r.distance_km ?? null,
  durationSec: r.duration_sec ?? null,
  level: r.level ?? null,
  done: r.done === 1,
});
