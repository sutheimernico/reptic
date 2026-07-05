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

/** Last time's set values for one exercise, ordered by set number. */
export interface PriorSet {
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
}

/** An editable set row shown during the session. */
export interface DraftSet {
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  done: boolean;
  /** Last time's values for this set position; null when there is no history. */
  reference: { weightKg: number; reps: number } | null;
}

/** Normalize stored sets into ordered PriorSet[] (defensive copy + sort). */
export function toPriorSets(
  sets: Pick<WorkoutSet, 'setNumber' | 'weightKg' | 'reps'>[],
): PriorSet[] {
  return [...sets]
    .sort((a, b) => a.setNumber - b.setNumber)
    .map((s) => ({ setNumber: s.setNumber, weightKg: s.weightKg, reps: s.reps }));
}

function referenceFor(prior: PriorSet | undefined): DraftSet['reference'] {
  if (!prior || prior.weightKg === null || prior.reps === null) return null;
  return { weightKg: prior.weightKg, reps: prior.reps };
}

/**
 * The set rows shown when an exercise is opened: mirror last time's set count
 * with weights carried over and reps left empty. With no history, one empty set.
 */
export function createInitialSets(prior: PriorSet[]): DraftSet[] {
  if (prior.length === 0) {
    return [{ setNumber: 1, weightKg: null, reps: null, done: false, reference: null }];
  }
  return prior.map((p, i) => ({
    setNumber: i + 1,
    weightKg: p.weightKg,
    reps: null,
    done: false,
    reference: referenceFor(p),
  }));
}

/**
 * Append a new set. Weight inherits from last time's set at this position, or
 * failing that from the current last set; reps stay empty.
 */
export function addSet(current: DraftSet[], prior: PriorSet[]): DraftSet[] {
  const index = current.length; // 0-based position of the new set
  const priorForIndex = prior[index];
  const inheritedWeight =
    priorForIndex?.weightKg ?? (current.length > 0 ? current[current.length - 1].weightKg : null);
  const next: DraftSet = {
    setNumber: index + 1,
    weightKg: inheritedWeight,
    reps: null,
    done: false,
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
