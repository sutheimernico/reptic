/**
 * Weekly bucketing for the training trends: ISO weeks (Monday-first, the week
 * containing the year's first Thursday is week 1), read in the device's local
 * calendar — a session logged Sunday evening belongs to that Sunday's week, not
 * to the next one because UTC had already rolled over.
 *
 * Weeks without training stay at zero. They are real information ("nothing
 * happened"), so they are never dropped or interpolated away.
 */

import type { MuscleGroup } from '@/domain/types';

export interface IsoWeek {
  /** ISO week-numbering year, which can differ from the calendar year in January. */
  year: number;
  /** 1–53. */
  week: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local midnight of the Monday starting the week that contains `date`. */
export function startOfIsoWeek(date: Date): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (monday.getDay() + 6) % 7; // Mon = 0 … Sun = 6
  monday.setDate(monday.getDate() - offset);
  return monday;
}

export function isoWeekOf(date: Date): IsoWeek {
  // The Thursday of this week decides both the week number and the year.
  const thursday = startOfIsoWeek(date);
  thursday.setDate(thursday.getDate() + 3);

  const firstThursday = startOfIsoWeek(new Date(thursday.getFullYear(), 0, 4));
  firstThursday.setDate(firstThursday.getDate() + 3);

  const week = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
  return { year: thursday.getFullYear(), week };
}

/** Sortable, stable identity for a week: `2026-W35`. */
export function isoWeekKey(week: IsoWeek): string {
  return `${week.year}-W${String(week.week).padStart(2, '0')}`;
}

/** Short axis label: `KW 35`. */
export function isoWeekLabel(week: IsoWeek): string {
  return `KW ${week.week}`;
}

/** The last `count` ISO weeks ending with the one containing `now`, oldest first. */
export function lastIsoWeeks(now: Date, count: number): IsoWeek[] {
  const weeks: IsoWeek[] = [];
  const cursor = startOfIsoWeek(now);
  cursor.setDate(cursor.getDate() - 7 * (count - 1));
  for (let i = 0; i < count; i += 1) {
    weeks.push(isoWeekOf(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

/**
 * Local midnight of the Monday that opens a `count`-week window ending in the
 * week of `now` — the cutoff to query sessions from.
 */
export function startOfWeekWindow(now: Date, count: number): Date {
  const start = startOfIsoWeek(now);
  start.setDate(start.getDate() - 7 * (count - 1));
  return start;
}

/** One session's contribution to a muscle group, as the db layer reports it. */
export interface SessionMuscleTotals {
  /** ISO timestamp of the session. */
  finishedAt: string;
  muscleGroup: MuscleGroup;
  /** Σ weight × reps (kg). */
  volumeKg: number;
  /** Σ distance (km), cardio only. */
  distanceKm: number;
}

export interface WeekTotals {
  key: string;
  label: string;
  week: IsoWeek;
  volumeKg: number;
  distanceKm: number;
  /** Volume per muscle group; only groups with volume appear. */
  byMuscle: Partial<Record<MuscleGroup, number>>;
}

/**
 * Fold session totals into the last `count` ISO weeks, oldest first. Rows
 * outside the window are ignored; empty weeks come back as zeros.
 */
export function bucketByWeek(
  rows: SessionMuscleTotals[],
  now: Date,
  count = 12,
): WeekTotals[] {
  const buckets = new Map<string, WeekTotals>();
  for (const week of lastIsoWeeks(now, count)) {
    buckets.set(isoWeekKey(week), {
      key: isoWeekKey(week),
      label: isoWeekLabel(week),
      week,
      volumeKg: 0,
      distanceKm: 0,
      byMuscle: {},
    });
  }

  for (const row of rows) {
    const date = new Date(row.finishedAt);
    if (Number.isNaN(date.getTime())) continue;
    const bucket = buckets.get(isoWeekKey(isoWeekOf(date)));
    if (!bucket) continue; // older than the window
    bucket.volumeKg += row.volumeKg;
    bucket.distanceKm += row.distanceKm;
    if (row.volumeKg > 0) {
      bucket.byMuscle[row.muscleGroup] = (bucket.byMuscle[row.muscleGroup] ?? 0) + row.volumeKg;
    }
  }

  return [...buckets.values()];
}

/** Muscle groups in the window, heaviest total volume first. */
export function rankMuscleGroups(weeks: WeekTotals[]): { group: MuscleGroup; volumeKg: number }[] {
  const totals = new Map<MuscleGroup, number>();
  for (const week of weeks) {
    for (const [group, volume] of Object.entries(week.byMuscle) as [MuscleGroup, number][]) {
      totals.set(group, (totals.get(group) ?? 0) + volume);
    }
  }
  return [...totals.entries()]
    .map(([group, volumeKg]) => ({ group, volumeKg }))
    .sort((a, b) => b.volumeKg - a.volumeKg);
}
