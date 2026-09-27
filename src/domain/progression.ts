/**
 * Double progression: what to aim for in this session of an exercise, read from
 * last time's sets.
 *
 * The rule: train in a rep range at a fixed weight. Once every working set of a
 * session reaches the top of the range, the weight goes up next time and the
 * reps start low again; until then the weight stays and the reps climb.
 *
 * "Working sets" are the performed sets at last session's top weight — lighter
 * warm-up or back-off sets are neither a reason to go up nor to stay.
 *
 * The suggestion is advice, never an edit: the screen shows it as a hint, and
 * only an explicit tap moves any weight (see `rowsToBump`).
 */

import { formatWeight, plural } from '@/domain/format';
import { type PlateSetup, solvePlates } from '@/domain/plates';
import type { PriorSet } from '@/domain/sets';

/** Settings key: reps every working set has to reach before the weight goes up. */
export const REP_TARGET_SETTING = 'progression_rep_target';
/** Settings key: how much weight one progression step adds, in kg. */
export const INCREMENT_SETTING = 'progression_increment_kg';

/** Top of the classic 8–12 hypertrophy range — Nico's library is machine and cable work. */
export const DEFAULT_REP_TARGET = 12;
export const MIN_REP_TARGET = 3;
export const MAX_REP_TARGET = 30;

/** Offered steps. 2.5 kg is the smallest jump a standard rack makes with 1.25 kg plates. */
export const INCREMENT_OPTIONS = [1, 1.25, 2, 2.5, 5] as const;
export const DEFAULT_INCREMENT_KG = 2.5;

export interface ProgressionSettings {
  repTarget: number;
  incrementKg: number;
}

export const DEFAULT_PROGRESSION: ProgressionSettings = {
  repTarget: DEFAULT_REP_TARGET,
  incrementKg: DEFAULT_INCREMENT_KG,
};

export type ProgressionHint =
  /** Every working set reached the target: go heavier. */
  | { kind: 'increase'; fromKg: number; toKg: number; repTarget: number; workingSets: number }
  /** Not there yet: same weight, more reps. */
  | { kind: 'hold'; weightKg: number; repTarget: number };

/** A set that carried real work: reps entered and an actual load on it. */
function isWorked(s: PriorSet): s is PriorSet & { weightKg: number; reps: number } {
  return s.reps !== null && s.reps >= 1 && s.weightKg !== null && s.weightKg > 0;
}

const roundKg = (kg: number): number => Math.round(kg * 100) / 100;

/**
 * The weight one step above `fromKg`. When `fromKg` is itself exactly loadable
 * on the configured bar, the step rounds up to the next weight the plates can
 * actually build — a suggestion nobody can load is noise. A weight the plates
 * cannot build (a pin-loaded machine, a dumbbell) gets the plain increment,
 * because the plate stock says nothing about that equipment.
 */
export function nextWeight(fromKg: number, incrementKg: number, plates: PlateSetup | null): number {
  const target = roundKg(fromKg + incrementKg);
  if (!plates || !solvePlates(fromKg, plates)?.exact) return target;
  const next = solvePlates(target, plates);
  if (!next || next.exact) return target;
  return next.nextHigherKg ?? target; // beyond the rack: say the honest number anyway
}

/**
 * The hint for this session, or null when there is nothing honest to say: no
 * performed sets last time, or no load to progress (bodyweight, cardio).
 * Callers also stay quiet when last time's sets came from another gym — other
 * machines, other numbers.
 */
export function suggestProgression(
  prior: PriorSet[],
  settings: ProgressionSettings,
  plates: PlateSetup | null,
): ProgressionHint | null {
  const worked = prior.filter(isWorked);
  if (worked.length === 0) return null;

  const topKg = Math.max(...worked.map((s) => s.weightKg));
  const working = worked.filter((s) => s.weightKg === topKg);
  if (working.every((s) => s.reps >= settings.repTarget)) {
    return {
      kind: 'increase',
      fromKg: topKg,
      toKg: nextWeight(topKg, settings.incrementKg, plates),
      repTarget: settings.repTarget,
      workingSets: working.length,
    };
  }
  return { kind: 'hold', weightKg: topKg, repTarget: settings.repTarget };
}

/** Headline + explanation for the hint row. */
export function describeHint(hint: ProgressionHint): { title: string; detail: string } {
  if (hint.kind === 'increase') {
    return {
      title: `Vorschlag: ${formatWeight(hint.toKg)} kg`,
      detail: `Letztes Mal ${plural(hint.workingSets, 'Satz', 'Sätze')} mit ${formatWeight(hint.fromKg)} kg × ${hint.repTarget}+ geschafft`,
    };
  }
  return {
    title: `Vorschlag: bei ${formatWeight(hint.weightKg)} kg bleiben`,
    detail: `Ziel: ${hint.repTarget} Wdh. in jedem Satz, dann steigern`,
  };
}

/**
 * Which rows an explicit "Übernehmen" may move to the suggested weight: those
 * not yet ticked done that still sit at the old working weight. Anything typed
 * to a different weight, and every finished set, stays exactly as it is.
 */
export function rowsToBump(
  rows: { weightKg: number | null; done: boolean }[],
  fromKg: number,
): number[] {
  const indices: number[] = [];
  rows.forEach((r, i) => {
    if (!r.done && r.weightKg === fromKg) indices.push(i);
  });
  return indices;
}

const clampRepTarget = (n: number): number =>
  Math.min(MAX_REP_TARGET, Math.max(MIN_REP_TARGET, Math.round(n)));

/** Stored rep target, falling back to the default when unset or corrupt. */
export function parseRepTarget(stored: string | null): number {
  if (stored === null) return DEFAULT_REP_TARGET;
  const n = Number.parseInt(stored, 10);
  return Number.isFinite(n) ? clampRepTarget(n) : DEFAULT_REP_TARGET;
}

export function stepRepTarget(current: number, direction: 1 | -1): number {
  return clampRepTarget(current + direction);
}

/** Stored increment; only the offered steps are valid, anything else is the default. */
export function parseIncrement(stored: string | null): number {
  if (stored === null) return DEFAULT_INCREMENT_KG;
  const n = Number(stored);
  return (INCREMENT_OPTIONS as readonly number[]).includes(n) ? n : DEFAULT_INCREMENT_KG;
}

/** The neighbouring offered step, clamped at both ends. */
export function stepIncrement(current: number, direction: 1 | -1): number {
  const options = INCREMENT_OPTIONS as readonly number[];
  const index = options.indexOf(current);
  const from = index === -1 ? options.indexOf(DEFAULT_INCREMENT_KG) : index;
  return options[Math.min(options.length - 1, Math.max(0, from + direction))];
}
