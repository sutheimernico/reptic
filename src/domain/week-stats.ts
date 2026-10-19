/**
 * Weekly progress for the Heute screen: this week's totals against a goal, the
 * week streak, a suggested goal, and XP / level. Pure — the db layer feeds it
 * rows. Weeks are local-time ISO weeks (see `weeks.ts`).
 */

import {
  detectPersonalRecords,
  NO_BESTS,
  withSet,
  type ExerciseBests,
} from '@/domain/personal-records';
import {
  bucketByWeek,
  isoWeekKey,
  isoWeekOf,
  startOfIsoWeek,
  type SessionMuscleTotals,
  type WeekTotals,
} from '@/domain/weeks';

export const WEEK_GOAL_KG_SETTING = 'week_goal_kg';
export const WEEK_GOAL_KM_SETTING = 'week_goal_km';

const DEFAULT_GOAL_KG = 10000;
const DEFAULT_GOAL_KM = 10;
const SUGGESTION_WEEKS = 4;

export interface WeekProgress {
  weekKey: string;
  volumeKg: number;
  distanceKm: number;
  sessions: number;
}

export function currentWeekProgress(rows: SessionMuscleTotals[], now: Date): WeekProgress {
  const [bucket] = bucketByWeek(rows, now, 1);
  const finished = new Set<string>();
  for (const r of rows) {
    const date = new Date(r.finishedAt);
    if (!Number.isNaN(date.getTime()) && isoWeekKey(isoWeekOf(date)) === bucket.key) {
      finished.add(r.finishedAt);
    }
  }
  return {
    weekKey: bucket.key,
    volumeKg: bucket.volumeKg,
    distanceKm: bucket.distanceKm,
    sessions: finished.size,
  };
}

/**
 * Consecutive ISO weeks with at least one finished workout. The current week
 * only counts once it has one, so a Monday morning still shows last week's run.
 */
export function weekStreak(sessionDates: string[], now: Date): number {
  const trained = new Set<string>();
  for (const iso of sessionDates) {
    const date = new Date(iso);
    if (!Number.isNaN(date.getTime())) trained.add(isoWeekKey(isoWeekOf(date)));
  }

  const cursor = startOfIsoWeek(now);
  if (!trained.has(isoWeekKey(isoWeekOf(cursor)))) cursor.setDate(cursor.getDate() - 7);

  let streak = 0;
  while (trained.has(isoWeekKey(isoWeekOf(cursor)))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** `weeks` is oldest first with the running week last; that one is still incomplete, so it is skipped. */
const completedWeeks = (weeks: WeekTotals[]): WeekTotals[] => weeks.slice(0, -1);

export function suggestGoalKg(weeks: WeekTotals[]): number {
  const volumes = completedWeeks(weeks)
    .map((w) => w.volumeKg)
    .filter((v) => v > 0)
    .slice(-SUGGESTION_WEEKS);
  if (volumes.length === 0) return DEFAULT_GOAL_KG;
  return Math.ceil(median(volumes) / 500) * 500;
}

/** Null when cardio was never logged, so the UI can leave the km goal out entirely. */
export function suggestGoalKm(weeks: WeekTotals[]): number | null {
  if (!weeks.some((w) => w.distanceKm > 0)) return null;
  const distances = completedWeeks(weeks)
    .map((w) => w.distanceKm)
    .filter((d) => d > 0)
    .slice(-SUGGESTION_WEEKS);
  if (distances.length === 0) return DEFAULT_GOAL_KM;
  return Math.ceil(median(distances));
}

export interface WeekGoal {
  kg: number;
  km: number | null;
  kgIsSuggestion: boolean;
  kmIsSuggestion: boolean;
}

function parseGoal(stored: string | null): number | null {
  if (stored === null) return null;
  const value = Number(stored);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function resolveWeekGoal(
  storedKg: string | null,
  storedKm: string | null,
  weeks: WeekTotals[],
): WeekGoal {
  const kg = parseGoal(storedKg);
  const km = parseGoal(storedKm);
  return {
    kg: kg ?? suggestGoalKg(weeks),
    km: km ?? suggestGoalKm(weeks),
    kgIsSuggestion: kg === null,
    kmIsSuggestion: km === null,
  };
}

export const xpFor = (setCount: number, prCount: number): number => 10 * setCount + 50 * prCount;

/** Cumulative XP at which `level` begins (level 1 starts at 0). */
const levelStart = (level: number): number => Math.round(100 * (level - 1) ** 1.5);

export function levelFor(xp: number): { level: number; xpIntoLevel: number; xpForNext: number } {
  let level = 1;
  while (levelStart(level + 1) <= xp) level += 1;
  return {
    level,
    xpIntoLevel: xp - levelStart(level),
    xpForNext: levelStart(level + 1) - levelStart(level),
  };
}

/** A performed set of a finished workout, as the XP replay needs it. */
export interface PrReplaySet {
  workoutId: number;
  exerciseId: number;
  weightKg: number | null;
  reps: number | null;
  distanceKm: number | null;
  durationSec: number | null;
}

/**
 * Number of sets that were a personal record when logged. `sets` must be
 * chronological (workouts oldest first, sets in logging order within one).
 * Replays the live badge's rules exactly: bests come from earlier sessions plus
 * earlier sets of the same session, and nothing counts before an exercise has
 * `MIN_SESSIONS_FOR_PR` prior sessions.
 */
export function countPersonalRecords(sets: PrReplaySet[]): number {
  const bests = new Map<number, ExerciseBests>();
  let prs = 0;
  let i = 0;
  while (i < sets.length) {
    // One workout at a time, so the session count only advances once it is over.
    const workoutId = sets[i].workoutId;
    const inSession = new Map<number, ExerciseBests>();
    for (; i < sets.length && sets[i].workoutId === workoutId; i += 1) {
      const s = sets[i];
      const current = inSession.get(s.exerciseId) ?? bests.get(s.exerciseId) ?? NO_BESTS;
      if (detectPersonalRecords(s, current).length > 0) prs += 1;
      inSession.set(s.exerciseId, withSet(current, s));
    }
    for (const [exerciseId, b] of inSession) {
      bests.set(exerciseId, { ...b, priorSessions: (bests.get(exerciseId)?.priorSessions ?? 0) + 1 });
    }
  }
  return prs;
}
