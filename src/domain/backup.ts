/**
 * Pure (de)serialization for the export/import backup. The screen supplies the
 * data (read from SQLite) and the timestamp; this module owns the wire format
 * and validation so a round-trip is guaranteed and bad input fails loudly.
 */

import type { Exercise, Gym, Plan, Workout, WorkoutExercise, WorkoutSet } from '@/domain/types';

/** v2: adds gyms and workouts.gymId. v1 backups are rejected (pre-gym data model). */
export const BACKUP_VERSION = 2;

export interface PlanExerciseRow {
  planId: number;
  exerciseId: number;
  sortOrder: number;
}

export interface BackupData {
  version: number;
  /** ISO 8601 timestamp, supplied by the caller (domain stays clock-free). */
  exportedAt: string;
  gyms: Gym[];
  exercises: Exercise[];
  plans: Plan[];
  planExercises: PlanExerciseRow[];
  workouts: Workout[];
  workoutExercises: WorkoutExercise[];
  workoutSets: WorkoutSet[];
}

export type BackupPayload = Omit<BackupData, 'version'>;

const REQUIRED_ARRAYS = [
  'gyms',
  'exercises',
  'plans',
  'planExercises',
  'workouts',
  'workoutExercises',
  'workoutSets',
] as const;

export function serializeBackup(payload: BackupPayload): string {
  const data: BackupData = { version: BACKUP_VERSION, ...payload };
  return JSON.stringify(data, null, 2);
}

export function parseBackup(json: string): BackupData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Backup ist kein gültiges JSON.');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Backup hat ein unerwartetes Format.');
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.version !== BACKUP_VERSION) {
    throw new Error(
      `Backup-Version ${String(obj.version)} wird nicht unterstützt (erwartet ${BACKUP_VERSION}).`,
    );
  }
  for (const key of REQUIRED_ARRAYS) {
    if (!Array.isArray(obj[key])) {
      throw new Error(`Backup unvollständig: "${key}" fehlt oder ist kein Array.`);
    }
  }
  if (typeof obj.exportedAt !== 'string') {
    throw new Error('Backup unvollständig: "exportedAt" fehlt.');
  }
  return parsed as BackupData;
}
