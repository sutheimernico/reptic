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

const WEEKDAYS_DE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONTHS_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

/**
 * A session date for history rows: `So, 5. Juli 2026`. Reads the device-local
 * calendar fields (getDay/getDate/…), which is what the user expects to see.
 * Returns "" for an unparseable timestamp.
 */
export function formatSessionDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${WEEKDAYS_DE[d.getDay()]}, ${d.getDate()}. ${MONTHS_DE[d.getMonth()]} ${d.getFullYear()}`;
}

/** Group thousands with a dot (German): 4180 -> "4.180". */
function groupThousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Total session volume (kg moved = Σ weight × reps), rounded: `4.180 kg`. */
export function formatVolume(kg: number): string {
  return `${groupThousands(Math.round(kg))} kg`;
}
