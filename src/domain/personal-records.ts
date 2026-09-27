/**
 * Personal-record detection for a set the user just ticked done.
 *
 * Honest by construction: a record is only claimed against what was actually
 * logged *before* this set — including earlier sets of the same session, since
 * a PR is a PR whenever it happens. Carried-over rows that were never filled in
 * carry no performance and can therefore never trigger one.
 *
 * Records stay quiet on a brand-new exercise: the first sessions would flag
 * literally every set, which trains the user to ignore the badge.
 */

/** Sessions with this exercise required before records are announced at all. */
export const MIN_SESSIONS_FOR_PR = 3;

/**
 * Reps above this make the Epley estimate unreliable (it drifts high on long
 * sets), so an e1RM record is not claimed from them. The weight record still is.
 */
export const MAX_REPS_FOR_E1RM = 12;

export type PrKind = 'weight' | 'e1rm' | 'distance' | 'pace';

/** The bests to beat — everything logged for this exercise before the current set. */
export interface ExerciseBests {
  /** Finished sessions with this exercise, excluding the running one. */
  priorSessions: number;
  topWeightKg: number | null;
  topE1rm: number | null;
  topDistanceKm: number | null;
  /** Best speed in km/h (distance ÷ time); cardio only. */
  topPaceKmh: number | null;
}

export const NO_BESTS: ExerciseBests = {
  priorSessions: 0,
  topWeightKg: null,
  topE1rm: null,
  topDistanceKm: null,
  topPaceKmh: null,
};

/** What the user entered in the set being checked. */
export interface PerformedSet {
  weightKg: number | null;
  reps: number | null;
  distanceKm: number | null;
  durationSec: number | null;
}

/** Epley one-rep-max estimate; null when the set carries no usable weight × reps. */
export function epleyE1rm(weightKg: number | null, reps: number | null): number | null {
  if (weightKg === null || reps === null) return null;
  if (weightKg <= 0 || reps < 1 || reps > MAX_REPS_FOR_E1RM) return null;
  return weightKg * (1 + reps / 30);
}

/** Speed in km/h, or null when either half is missing. */
export function paceKmh(distanceKm: number | null, durationSec: number | null): number | null {
  if (distanceKm === null || durationSec === null) return null;
  if (distanceKm <= 0 || durationSec <= 0) return null;
  return distanceKm / (durationSec / 3600);
}

/** Strictly greater — matching a best is not a record. */
const beats = (value: number | null, best: number | null): boolean =>
  value !== null && (best === null || value > best);

/**
 * The records this set sets, if any. Empty while the exercise is too new, for
 * an untouched carry-over row, and whenever the set merely ties a best.
 */
export function detectPersonalRecords(set: PerformedSet, bests: ExerciseBests): PrKind[] {
  if (bests.priorSessions < MIN_SESSIONS_FOR_PR) return [];

  const kinds: PrKind[] = [];
  // A weight without reps is a carried-over setting, not a lift.
  if (set.reps !== null && set.reps >= 1 && beats(set.weightKg, bests.topWeightKg)) {
    kinds.push('weight');
  }
  if (beats(epleyE1rm(set.weightKg, set.reps), bests.topE1rm)) kinds.push('e1rm');
  if (beats(set.distanceKm, bests.topDistanceKm)) kinds.push('distance');
  if (beats(paceKmh(set.distanceKm, set.durationSec), bests.topPaceKmh)) kinds.push('pace');
  return kinds;
}

/** One session's best values for an exercise — the same measures as `ExerciseBests`. */
export type ExerciseTops = Omit<ExerciseBests, 'priorSessions'>;

/**
 * The records a whole session set for one exercise: its best values against
 * everything logged in the sessions before it. Same rules as the live badge —
 * quiet while the exercise is new, a tie is not a record — so the summary never
 * claims a record the set screen stayed quiet about.
 */
export function sessionRecords(session: ExerciseTops, before: ExerciseBests): PrKind[] {
  if (before.priorSessions < MIN_SESSIONS_FOR_PR) return [];
  const kinds: PrKind[] = [];
  if (beats(session.topWeightKg, before.topWeightKg)) kinds.push('weight');
  if (beats(session.topE1rm, before.topE1rm)) kinds.push('e1rm');
  if (beats(session.topDistanceKm, before.topDistanceKm)) kinds.push('distance');
  if (beats(session.topPaceKmh, before.topPaceKmh)) kinds.push('pace');
  return kinds;
}

/** Fold a performed set into the bests, so the next set of the session compares fairly. */
export function withSet(bests: ExerciseBests, set: PerformedSet): ExerciseBests {
  const e1rm = epleyE1rm(set.weightKg, set.reps);
  const pace = paceKmh(set.distanceKm, set.durationSec);
  const lifted = set.reps !== null && set.reps >= 1 ? set.weightKg : null;
  return {
    priorSessions: bests.priorSessions,
    topWeightKg: beats(lifted, bests.topWeightKg) ? lifted : bests.topWeightKg,
    topE1rm: beats(e1rm, bests.topE1rm) ? e1rm : bests.topE1rm,
    topDistanceKm: beats(set.distanceKm, bests.topDistanceKm)
      ? set.distanceKm
      : bests.topDistanceKm,
    topPaceKmh: beats(pace, bests.topPaceKmh) ? pace : bests.topPaceKmh,
  };
}

const LABELS: Record<PrKind, string> = {
  weight: 'schwerstes Gewicht',
  e1rm: 'stärkster Satz (geschätztes 1RM)',
  distance: 'weiteste Strecke',
  pace: 'höchstes Tempo',
};

/** German description of the records, for the badge tap and the toast. */
export function describeRecords(kinds: PrKind[]): string {
  return kinds.map((k) => LABELS[k]).join(' · ');
}
