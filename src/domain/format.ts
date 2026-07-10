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
 * Parse a weight input ("82,5" or "82.5") to kg. Returns null for anything
 * that is not a finite, non-negative number — a set cannot weigh less than
 * bodyweight-only (0 kg).
 */
export function parseWeight(text: string): number | null {
  const n = parseFloat(text.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Parse a reps input to a whole number. Returns null for anything that is
 * not a finite, non-negative integer.
 */
export function parseReps(text: string): number | null {
  const n = parseInt(text, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
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
 * Parse a cardio time input to seconds. Accepts "mm:ss" ("32:30" -> 1950) or a
 * bare minutes value ("32" -> 1920, "32,5" -> 1950). Returns null for anything
 * negative or unparseable.
 */
export function parseDuration(text: string): number | null {
  const t = text.trim();
  if (t === '') return null;
  if (t.includes(':')) {
    const [mm, ss] = t.split(':');
    const m = parseInt(mm, 10);
    const s = parseInt(ss, 10);
    if (![m, s].every(Number.isFinite) || m < 0 || s < 0 || s >= 60) return null;
    return m * 60 + s;
  }
  const minutes = parseFloat(t.replace(',', '.'));
  return Number.isFinite(minutes) && minutes >= 0 ? Math.round(minutes * 60) : null;
}

/** Render seconds as "m:ss" (1950 -> "32:30"). Returns "" for null so inputs bind to it. */
export function formatDuration(sec: number | null): string {
  if (sec === null || !Number.isFinite(sec) || sec < 0) return '';
  const total = Math.round(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * The grey per-set reference for a cardio exercise: `5 km · 32:30 · Stufe 8`.
 * Each part is optional; returns null when nothing is set.
 */
export function formatCardioReference(
  distanceKm: number | null,
  durationSec: number | null,
  level: number | null,
): string | null {
  const parts: string[] = [];
  if (distanceKm !== null) parts.push(`${formatWeight(distanceKm)} km`);
  if (durationSec !== null) parts.push(formatDuration(durationSec));
  if (level !== null) parts.push(`Stufe ${level}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * A compact summary of a cardio set list for history rows: one
 * `formatCardioReference` segment per set, joined with an em dash
 * (`5 km · 32:30 · Stufe 8 — 3 km`). Returns "" when no set has a value.
 */
export function formatCardioSetSummary(
  sets: { distanceKm: number | null; durationSec: number | null; level: number | null }[],
): string {
  return sets
    .map((s) => formatCardioReference(s.distanceKm, s.durationSec, s.level))
    .filter((s): s is string => s !== null)
    .join(' — ');
}

/** German count phrase: `plural(1, 'Satz', 'Sätze')` -> "1 Satz". */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
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
export const MONTHS_DE = [
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
