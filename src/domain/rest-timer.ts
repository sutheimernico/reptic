/**
 * Pure logic for the rest timer between sets.
 *
 * The timer is a start timestamp plus a duration, never a counting-down
 * number: the remaining time is derived from the wall clock on every tick, so
 * navigating away, backgrounding the app or a slow render can't drift it. Come
 * back after two minutes and it is expired, not frozen.
 */

/** Settings key holding the configured rest duration in seconds (`0` = off). */
export const REST_TIMER_SETTING = 'rest_timer_seconds';

/** Duration a fresh install starts with. */
export const DEFAULT_REST_SECONDS = 120;

/** Adjustment granularity in the settings UI. */
export const REST_STEP_SECONDS = 15;

/** Longest offered rest; beyond this the timer stops being useful in a gym. */
export const MAX_REST_SECONDS = 300;

/** The "off" value — a duration of zero disables the timer entirely. */
export const REST_OFF = 0;

export interface RestTimer {
  /** Wall-clock milliseconds (Date.now) when the timer was started. */
  startedAtMs: number;
  durationSec: number;
}

/**
 * Seconds left, never negative. Rounded up so a timer started with 120s reads
 * "2:00" for its first second instead of jumping straight to 1:59.
 */
export function remainingSeconds(timer: RestTimer, nowMs: number): number {
  const endMs = timer.startedAtMs + timer.durationSec * 1000;
  return Math.max(0, Math.ceil((endMs - nowMs) / 1000));
}

export function isExpired(timer: RestTimer, nowMs: number): boolean {
  return remainingSeconds(timer, nowMs) === 0;
}

/** Round a duration to the nearest valid step; anything at or below zero is "off". */
export function clampRestSeconds(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return REST_OFF;
  const stepped = Math.round(seconds / REST_STEP_SECONDS) * REST_STEP_SECONDS;
  return Math.min(MAX_REST_SECONDS, Math.max(REST_STEP_SECONDS, stepped));
}

/** Read the stored setting, falling back to the default when unset or corrupt. */
export function parseRestSeconds(stored: string | null): number {
  if (stored === null) return DEFAULT_REST_SECONDS;
  const n = Number.parseInt(stored, 10);
  if (!Number.isFinite(n)) return DEFAULT_REST_SECONDS;
  return n <= 0 ? REST_OFF : clampRestSeconds(n);
}

/** The next duration when the user taps − / + in settings. Off is reachable via −. */
export function stepRestSeconds(current: number, direction: 1 | -1): number {
  const next = current + direction * REST_STEP_SECONDS;
  if (next <= 0) return REST_OFF;
  return clampRestSeconds(next);
}
