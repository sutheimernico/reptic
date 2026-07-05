/**
 * Core domain types for Reptic. Pure data shapes shared across the app.
 * This module must not import from `db/`, `app/`, or any native module —
 * the domain layer stays testable in plain Node/Jest.
 */

export const MUSCLE_GROUPS = [
  'Brust',
  'Rücken',
  'Schultern',
  'Trapez/Nacken',
  'Beine',
  'Bizeps',
  'Trizeps',
  'Core',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export interface Exercise {
  id: number;
  name: string;
  muscleGroup: MuscleGroup;
  isCustom: boolean;
  archived: boolean;
}

export interface Plan {
  id: number;
  name: string;
  color: string;
  sortOrder: number;
}

/** A plan together with its default exercise ids, in order. */
export interface PlanWithExercises extends Plan {
  exerciseIds: number[];
}

export interface Workout {
  id: number;
  /** ISO 8601 timestamp. */
  startedAt: string;
  /** ISO 8601 timestamp, or null while the session is still active. */
  finishedAt: string | null;
  /** Plan ids the user picked for this session. */
  planIds: number[];
}

export interface WorkoutExercise {
  id: number;
  workoutId: number;
  exerciseId: number;
  sortOrder: number;
}

export interface WorkoutSet {
  id: number;
  workoutId: number;
  workoutExerciseId: number;
  exerciseId: number;
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  done: boolean;
}

/** How the app resolves which color scheme to show. */
export type ThemeMode = 'system' | 'light' | 'dark';
