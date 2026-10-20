/**
 * What every hero skin shows, derived once so the four of them cannot disagree.
 * Guards the empty install: a zero goal never divides, nothing renders NaN.
 */

import type { WeekOverview } from '@/db';
import { formatDistance, groupThousands } from '@/domain/format';
import { levelFor } from '@/domain/week-stats';

export interface HeroModel {
  kg: number;
  goalKg: number;
  kgPct: number;
  remainingKg: number;
  kgIsSuggestion: boolean;
  /** Null until cardio was ever logged: the km half stays out of every skin. */
  km: number | null;
  goalKm: number | null;
  kmPct: number;
  kmIsSuggestion: boolean;
  /** ISO calendar week number (the "KW"). */
  week: number;
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  streak: number;
  days: WeekOverview['days'];
  /** 0 = Monday. */
  todayIndex: number;
  weekPrs: number;
  sessions: number;
  xp: number;
  lastWorkoutDaysAgo: number | null;
  /** Km per week, oldest first, running week last — the cardio sparkline. */
  weeklyKm: number[];
  /** Screen-reader sentence; also what tests read. */
  summary: string;
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
const ratio = (value: number, goal: number) => (goal > 0 ? clamp01(value / goal) : 0);

export const formatKg = (kg: number) => groupThousands(Math.round(kg));

export function heroModel(overview: WeekOverview, now: Date = new Date()): HeroModel {
  const { progress, goal } = overview;
  const week = Number(progress.weekKey.split('-W')[1]) || 0;
  const { level, xpIntoLevel, xpForNext } = levelFor(overview.xp);
  const km = goal.km === null ? null : progress.distanceKm;
  const kgText = `${formatKg(progress.volumeKg)} kg von ${formatKg(goal.kg)} kg`;
  return {
    kg: progress.volumeKg,
    goalKg: goal.kg,
    kgPct: ratio(progress.volumeKg, goal.kg),
    remainingKg: Math.max(0, Math.round(goal.kg - progress.volumeKg)),
    kgIsSuggestion: goal.kgIsSuggestion,
    km,
    goalKm: goal.km,
    kmPct: goal.km === null ? 0 : ratio(progress.distanceKm, goal.km),
    kmIsSuggestion: goal.kmIsSuggestion,
    week,
    level,
    xpIntoLevel,
    xpForNext,
    streak: overview.streak,
    days: overview.days,
    todayIndex: (now.getDay() + 6) % 7,
    weekPrs: overview.weekPrs,
    sessions: progress.sessions,
    xp: overview.xp,
    lastWorkoutDaysAgo: overview.lastWorkoutDaysAgo,
    weeklyKm: overview.weeks.map((w) => w.distanceKm),
    summary:
      `Wochenfortschritt: ${kgText}` +
      (goal.km === null || km === null
        ? ''
        : `, ${formatDistance(km)} von ${formatDistance(goal.km)}`),
  };
}

export const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;

export function streakLabel(weeks: number): string {
  if (weeks <= 0) return 'Noch keine Serie';
  return weeks === 1 ? '1 Woche in Folge' : `${weeks} Wochen in Folge`;
}
