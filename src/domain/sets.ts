/**
 * Pure logic for the per-exercise set list during an active session.
 *
 * Rules (from the design):
 *  - The kg field is pre-filled with last time's weight (carry-over), editable.
 *  - The reps field is always empty; the user types it fresh each time.
 *  - Each set carries a `reference` (last time's weight × reps for that set
 *    position) which the UI renders as the grey "↳ letztes Mal" line.
 */

import type { WorkoutSet } from '@/domain/types';

/**
 * Last time's set values for one exercise, ordered by set number. The cardio
 * fields are optional so strength callers can keep passing weight/reps only.
 */
export interface PriorSet {
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  distanceKm?: number | null;
  durationSec?: number | null;
  level?: number | null;
}

/** An editable set row shown during the session. */
export interface DraftSet {
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  distanceKm: number | null;
  durationSec: number | null;
  level: number | null;
  done: boolean;
  /** Last time's values for this set position; null when there is no history. */
  reference: { weightKg: number; reps: number } | null;
}

/** Normalize stored sets into ordered PriorSet[] (defensive copy + sort). */
export function toPriorSets(
  sets: (Pick<WorkoutSet, 'setNumber' | 'weightKg' | 'reps'> &
    Partial<Pick<WorkoutSet, 'distanceKm' | 'durationSec' | 'level'>>)[],
): PriorSet[] {
  return [...sets]
    .sort((a, b) => a.setNumber - b.setNumber)
    .map((s) => ({
      setNumber: s.setNumber,
      weightKg: s.weightKg,
      reps: s.reps,
      distanceKm: s.distanceKm ?? null,
      durationSec: s.durationSec ?? null,
      level: s.level ?? null,
    }));
}

function referenceFor(prior: PriorSet | undefined): DraftSet['reference'] {
  if (!prior || prior.weightKg === null || prior.reps === null) return null;
  return { weightKg: prior.weightKg, reps: prior.reps };
}

const EMPTY_SET: Omit<DraftSet, 'setNumber' | 'reference'> = {
  weightKg: null,
  reps: null,
  distanceKm: null,
  durationSec: null,
  level: null,
  done: false,
};

/**
 * The set rows shown when an exercise is opened: mirror last time's set count
 * with the "settings" carried over (weight for strength, distance + level for
 * cardio) and the "performance" left empty (reps / duration typed fresh). With
 * no history, one empty set.
 */
export function createInitialSets(prior: PriorSet[]): DraftSet[] {
  if (prior.length === 0) {
    return [{ setNumber: 1, ...EMPTY_SET, reference: null }];
  }
  return prior.map((p, i) => ({
    ...EMPTY_SET,
    setNumber: i + 1,
    weightKg: p.weightKg,
    distanceKm: p.distanceKm ?? null,
    level: p.level ?? null,
    reference: referenceFor(p),
  }));
}

/**
 * Append a new set. The carried-over "settings" inherit from last time's set at
 * this position, or failing that from the current last set; performance fields
 * stay empty.
 */
export function addSet(current: DraftSet[], prior: PriorSet[]): DraftSet[] {
  const index = current.length; // 0-based position of the new set
  const priorForIndex = prior[index];
  const last = current.length > 0 ? current[current.length - 1] : undefined;
  const next: DraftSet = {
    ...EMPTY_SET,
    setNumber: index + 1,
    weightKg: priorForIndex?.weightKg ?? last?.weightKg ?? null,
    distanceKm: priorForIndex?.distanceKm ?? last?.distanceKm ?? null,
    level: priorForIndex?.level ?? last?.level ?? null,
    reference: referenceFor(priorForIndex),
  };
  return [...current, next];
}

/**
 * Remove a set and renumber the rest sequentially, re-mapping each remaining
 * row's reference to last time's set at its new position.
 */
export function removeSet(current: DraftSet[], setNumber: number, prior: PriorSet[]): DraftSet[] {
  return current
    .filter((s) => s.setNumber !== setNumber)
    .map((s, i) => ({ ...s, setNumber: i + 1, reference: referenceFor(prior[i]) }));
}

/**
 * Prefix for the grey reference line. Prior sets come from the same gym by
 * default; when they were pulled from another gym (fallback), name it so the
 * user knows the weights may not match this gym's machines.
 */
export function referenceLabel(sourceGymName: string | null): string {
  return sourceGymName === null ? '↳ letztes Mal' : `↳ letztes Mal im ${sourceGymName}`;
}

/**
 * The heaviest weight among *performed* sets. A set counts only when reps were
 * entered (`reps !== null`): opening an exercise pre-fills carried-over weights
 * with empty reps, so those untouched rows must not be read as real lifts.
 * Returns null when no performed set carries a weight.
 */
export function topSetWeight(sets: Pick<WorkoutSet, 'weightKg' | 'reps'>[]): number | null {
  let max: number | null = null;
  for (const s of sets) {
    if (s.reps === null || s.weightKg === null) continue;
    if (max === null || s.weightKg > max) max = s.weightKg;
  }
  return max;
}
