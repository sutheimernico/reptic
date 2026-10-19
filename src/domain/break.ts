import { type PlateSetup, solvePlates } from '@/domain/plates';

const DAY_MS = 86_400_000;
const BREAK_DAYS = 14;
const LONG_BREAK_DAYS = 56;

/** Settings keys are per workout: the choice must survive leaving and reopening the session. */
export const breakAppliedKey = (workoutId: number) => `break_applied_${workoutId}`;
export const breakDismissedKey = (workoutId: number) => `break_dismissed_${workoutId}`;

/** Weight factor to restart with after a break; null when no suggestion is due. */
export function breakFactor(daysSinceLast: number | null): number | null {
  if (daysSinceLast === null || daysSinceLast < BREAK_DAYS) return null;
  return daysSinceLast >= LONG_BREAK_DAYS ? 0.85 : 0.9;
}

/** "10" / "15" — the percentage as shown in the copy. */
export function breakPercent(factor: number): number {
  return Math.round((1 - factor) * 100);
}

/** Local calendar day number; avoids the 23/25 h days around DST that raw ms / 86400000 hits. */
function localDayNumber(date: Date): number {
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

/** Whole local calendar days from `lastIso` to `now`. */
export function daysBetween(lastIso: string, now: Date): number {
  return localDayNumber(now) - localDayNumber(new Date(lastIso));
}

const roundKg = (kg: number) => Math.round(kg * 100) / 100;

/**
 * `kg` lowered by `factor`, rounded down — mirroring `nextWeight`: a weight the
 * plates can build lands on the largest loadable weight at or below the target,
 * anything else (machines, dumbbells) on a multiple of the increment. Empty and
 * zero weights stay as they are; the result is never negative.
 */
export function lowerWeight(
  kg: number | null,
  factor: number,
  incrementKg: number,
  plates: PlateSetup | null,
): number | null {
  if (kg === null || !(kg > 0)) return kg;
  const target = kg * factor;
  if (plates && solvePlates(kg, plates)?.exact) {
    const lowered = solvePlates(target, plates);
    if (lowered) return roundKg(lowered.totalKg);
  }
  // The epsilon keeps an exact multiple (45 / 2.5) from flooring one step too far.
  return roundKg(Math.max(0, Math.floor(target / incrementKg + 1e-9) * incrementKg));
}
