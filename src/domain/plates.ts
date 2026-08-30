/**
 * Which plates to hang on a barbell for a target weight.
 *
 * Not greedy: the reachable per-side weights are enumerated from the actual
 * inventory, so the answer is right even for an odd set of plates, and "not
 * exactly loadable" is a real statement rather than a greedy dead end.
 *
 * All arithmetic runs in quarter kilos (integers). 1.25 kg plates make 0.25 kg
 * the smallest step, and floating-point sums of 1.25 + 2.5 + … drift enough to
 * make an exact-match check unreliable.
 */

/** How many *pairs* of one plate size are available (one pair = one per side). */
export interface PlateStock {
  kg: number;
  pairs: number;
}

export interface PlateSetup {
  barKg: number;
  stock: PlateStock[];
}

/**
 * A common German gym rack. Two pairs of each size is a guess that covers the
 * usual range — Nico can correct it in Einstellungen once he has counted his.
 */
export const DEFAULT_PLATE_SETUP: PlateSetup = {
  barKg: 20,
  stock: [
    { kg: 25, pairs: 2 },
    { kg: 20, pairs: 2 },
    { kg: 15, pairs: 2 },
    { kg: 10, pairs: 2 },
    { kg: 5, pairs: 2 },
    { kg: 2.5, pairs: 2 },
    { kg: 1.25, pairs: 2 },
  ],
};

/** Settings key holding the setup as JSON. */
export const PLATE_SETUP_SETTING = 'plate_setup';

export interface PlateSolution {
  /** The weight actually reachable: the target when exact, else the next below. */
  totalKg: number;
  /** Plates for one side, heaviest first. Empty means the bare bar. */
  perSide: number[];
  exact: boolean;
  /** Closest loadable weight above the target, or null when there is none. */
  nextHigherKg: number | null;
}

const toQuarters = (kg: number): number => Math.round(kg * 4);
const fromQuarters = (q: number): number => q / 4;

/**
 * Every per-side weight the stock can build, mapped to the plates that build
 * it. Bounded knapsack over a few sizes and a few hundred sums — cheap enough
 * to run each time the sheet opens.
 */
function reachablePerSide(stock: PlateStock[]): Map<number, number[]> {
  let sums = new Map<number, number[]>([[0, []]]);
  // Heaviest size first, so the combination remembered for a weight is built
  // from the biggest plates that reach it (40 kg a side comes out as 20 + 20,
  // not 25 + 10 + 5). Fewest-plates is not guaranteed, just strongly preferred.
  for (const { kg, pairs } of [...stock].sort((a, b) => b.kg - a.kg)) {
    if (!Number.isFinite(kg) || kg <= 0 || pairs <= 0) continue;
    const step = toQuarters(kg);
    const next = new Map(sums);
    for (const [sum, plates] of sums) {
      for (let n = 1; n <= pairs; n++) {
        const total = sum + step * n;
        if (next.has(total)) continue; // keep the first (heaviest-plate) path
        next.set(total, [...plates, ...Array<number>(n).fill(kg)]);
      }
    }
    sums = next;
  }
  return sums;
}

/**
 * How to load `targetKg`, or null when the target is below the bar — nothing
 * to compute there, and pretending otherwise would be misleading.
 */
export function solvePlates(
  targetKg: number,
  setup: PlateSetup = DEFAULT_PLATE_SETUP,
): PlateSolution | null {
  if (!Number.isFinite(targetKg) || targetKg < setup.barKg) return null;

  const targetSide = toQuarters(targetKg) - toQuarters(setup.barKg);
  if (targetSide % 2 !== 0) {
    // An odd number of quarter kilos cannot be split evenly across two sides.
    return oddTarget(targetKg, setup);
  }

  const sums = reachablePerSide(setup.stock);
  const wanted = targetSide / 2;

  const exact = sums.get(wanted);
  if (exact) {
    return {
      totalKg: targetKg,
      perSide: [...exact].sort((a, b) => b - a),
      exact: true,
      nextHigherKg: null,
    };
  }

  let below = 0;
  let above: number | null = null;
  for (const sum of sums.keys()) {
    if (sum < wanted && sum > below) below = sum;
    if (sum > wanted && (above === null || sum < above)) above = sum;
  }

  return {
    totalKg: setup.barKg + fromQuarters(below * 2),
    perSide: [...(sums.get(below) ?? [])].sort((a, b) => b - a),
    exact: false,
    nextHigherKg: above === null ? null : setup.barKg + fromQuarters(above * 2),
  };
}

/** A target that is not an even number of quarter kilos above the bar. */
function oddTarget(targetKg: number, setup: PlateSetup): PlateSolution {
  const lower = solvePlates(targetKg - 0.25, setup);
  const higher = solvePlates(targetKg + 0.25, setup);
  return {
    totalKg: lower?.totalKg ?? setup.barKg,
    perSide: lower?.perSide ?? [],
    exact: false,
    nextHigherKg: higher?.exact ? higher.totalKg : (higher?.nextHigherKg ?? null),
  };
}

/** Read a stored setup, falling back to the default when unset or malformed. */
export function parsePlateSetup(stored: string | null): PlateSetup {
  if (!stored) return DEFAULT_PLATE_SETUP;
  try {
    const raw: unknown = JSON.parse(stored);
    if (typeof raw !== 'object' || raw === null) return DEFAULT_PLATE_SETUP;
    const { barKg, stock } = raw as Partial<PlateSetup>;
    if (typeof barKg !== 'number' || !Number.isFinite(barKg) || barKg < 0) {
      return DEFAULT_PLATE_SETUP;
    }
    if (!Array.isArray(stock)) return DEFAULT_PLATE_SETUP;
    const clean = stock.filter(
      (p): p is PlateStock =>
        typeof p?.kg === 'number' &&
        Number.isFinite(p.kg) &&
        p.kg > 0 &&
        typeof p.pairs === 'number' &&
        Number.isFinite(p.pairs) &&
        p.pairs > 0,
    );
    if (clean.length === 0) return DEFAULT_PLATE_SETUP;
    return { barKg, stock: [...clean].sort((a, b) => b.kg - a.kg) };
  } catch {
    return DEFAULT_PLATE_SETUP;
  }
}

export function serializePlateSetup(setup: PlateSetup): string {
  return JSON.stringify(setup);
}
