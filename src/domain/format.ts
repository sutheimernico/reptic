/**
 * Pure formatting helpers for weights and the "last time" reference line.
 */

/**
 * Render a weight without trailing zeros: 80 -> "80", 82.5 -> "82.5".
 * Returns "" for null so inputs can bind to it directly.
 */
export function formatWeight(weightKg: number | null): string {
  if (weightKg === null || Number.isNaN(weightKg)) return '';
  // Avoid "80.0"; keep up to one useful decimal (gym plates are .25 steps at most,
  // but we don't force precision here — just drop trailing zeros).
  return String(Number(weightKg.toFixed(2)));
}

/**
 * The grey per-set reference: `80 kg × 8`. Returns null when either value is
 * missing (so the caller can omit the line entirely).
 */
export function formatReference(weightKg: number | null, reps: number | null): string | null {
  if (weightKg === null || reps === null) return null;
  return `${formatWeight(weightKg)} kg × ${reps}`;
}

/**
 * A compact summary of a set list for history rows: `80 kg × 8, 8, 7`.
 * Groups consecutive sets that share the same weight. Returns "" for no sets.
 */
export function formatSetSummary(sets: { weightKg: number | null; reps: number | null }[]): string {
  const usable = sets.filter((s) => s.weightKg !== null && s.reps !== null);
  if (usable.length === 0) return '';

  const groups: { weightKg: number; reps: number[] }[] = [];
  for (const set of usable) {
    const last = groups[groups.length - 1];
    if (last && last.weightKg === set.weightKg) {
      last.reps.push(set.reps as number);
    } else {
      groups.push({ weightKg: set.weightKg as number, reps: [set.reps as number] });
    }
  }

  return groups
    .map((g) => `${formatWeight(g.weightKg)} kg × ${g.reps.join(', ')}`)
    .join(' · ');
}
