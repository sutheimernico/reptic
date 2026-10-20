/**
 * Data for the Heute week hero: this week's progress (finished sessions plus the
 * running workout), the 12-week series, streak, resolved goal and lifetime XP.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import { getSetting } from '@/db/settings';
import { performedSql } from '@/db/totals';
import { getActiveWorkout, getSessionMuscleTotals } from '@/db/workouts';
import {
  countPersonalRecords,
  currentWeekProgress,
  resolveWeekGoal,
  weekDays,
  weekStreak,
  WEEK_GOAL_KG_SETTING,
  WEEK_GOAL_KM_SETTING,
  xpFor,
  type PrReplaySet,
  type WeekDay,
  type WeekGoal,
  type WeekProgress,
} from '@/domain/week-stats';
import { bucketByWeek, isoWeekKey, isoWeekOf, startOfIsoWeek, startOfWeekWindow, type WeekTotals } from '@/domain/weeks';

const WINDOW_WEEKS = 12;

export interface WeekOverview {
  progress: WeekProgress;
  weeks: WeekTotals[];
  /** Mon–Sun of the running week, live workout included on today. */
  days: WeekDay[];
  streak: number;
  goal: WeekGoal;
  /** Personal records set in finished workouts this week. */
  weekPrs: number;
  xp: number;
}

/**
 * Everything the lean path needs plus the intermediates the full overview reuses.
 * No performed-set replay: this runs on every tick in a workout.
 */
async function loadWeekBase(db: SQLiteDatabase, now: Date) {
  const since = startOfWeekWindow(now, WINDOW_WEEKS).toISOString();
  const rows = await getSessionMuscleTotals(db, since);
  const weeks = bucketByWeek(rows, now, WINDOW_WEEKS);

  // Only the latest unfinished workout is the running session; older ones are
  // abandoned and count nowhere. The running one isn't in any row above, so its
  // work counts toward this week right away (if it started this week). It is not
  // a session yet.
  const active = await getActiveWorkout(db);
  const activeTotals = active
    ? await db.getFirstAsync<{ volume: number | null; distance: number | null; sets: number }>(
        `SELECT SUM(s.weight_kg * s.reps) AS volume,
                SUM(CASE WHEN ${performedSql('s.')} THEN s.distance_km END) AS distance,
                SUM(CASE WHEN ${performedSql('s.')} THEN 1 ELSE 0 END) AS sets
         FROM workout_sets s WHERE s.workout_id = ?`,
        active.id,
      )
    : null;
  const finished = currentWeekProgress(rows, now);
  const startedThisWeek =
    active !== null && isoWeekKey(isoWeekOf(new Date(active.startedAt))) === finished.weekKey;
  const progress: WeekProgress = {
    ...finished,
    volumeKg: finished.volumeKg + (startedThisWeek ? (activeTotals?.volume ?? 0) : 0),
    distanceKm: finished.distanceKm + (startedThisWeek ? (activeTotals?.distance ?? 0) : 0),
  };
  const goal = resolveWeekGoal(
    await getSetting(db, WEEK_GOAL_KG_SETTING),
    await getSetting(db, WEEK_GOAL_KM_SETTING),
    weeks,
  );
  return { rows, weeks, activeTotals, startedThisWeek, progress, goal };
}

/** This week's progress and resolved goal — the lean part of the overview (no PR replay). */
export async function getWeekProgress(
  db: SQLiteDatabase,
  now: Date,
): Promise<{ progress: WeekProgress; goal: WeekGoal }> {
  const { progress, goal } = await loadWeekBase(db, now);
  return { progress, goal };
}

export async function getWeekOverview(db: SQLiteDatabase, now: Date): Promise<WeekOverview> {
  const { rows, weeks, activeTotals, startedThisWeek, progress, goal } = await loadWeekBase(
    db,
    now,
  );

  const dates = await db.getAllAsync<{ finished_at: string }>(
    'SELECT finished_at FROM workouts WHERE finished_at IS NOT NULL',
  );

  const finishedSetCount = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM workout_sets s
     JOIN workouts w ON w.id = s.workout_id
     WHERE w.finished_at IS NOT NULL AND ${performedSql('s.')}`,
  );
  const prSets = await db.getAllAsync<{
    finished_at: string;
    workout_id: number;
    exercise_id: number;
    weight_kg: number | null;
    reps: number | null;
    distance_km: number | null;
    duration_sec: number | null;
  }>(
    `SELECT w.finished_at, s.workout_id, s.exercise_id, s.weight_kg, s.reps, s.distance_km, s.duration_sec
     FROM workout_sets s
     JOIN workouts w ON w.id = s.workout_id
     WHERE w.finished_at IS NOT NULL AND ${performedSql('s.')}
     ORDER BY w.finished_at, w.id, s.id`,
  );
  const toReplay = (r: (typeof prSets)[number]): PrReplaySet => ({
    workoutId: r.workout_id,
    exerciseId: r.exercise_id,
    weightKg: r.weight_kg,
    reps: r.reps,
    distanceKm: r.distance_km,
    durationSec: r.duration_sec,
  });
  const replay = prSets.map(toReplay);
  // Sets are chronological, so the records before Monday are a prefix of the replay.
  const weekStartMs = startOfIsoWeek(now).getTime();
  const before = prSets.filter((r) => new Date(r.finished_at).getTime() < weekStartMs).map(toReplay);
  const totalPrs = countPersonalRecords(replay);

  return {
    progress,
    weeks,
    days: weekDays(rows, now, {
      volumeKg: startedThisWeek ? (activeTotals?.volume ?? 0) : 0,
      active: startedThisWeek && (activeTotals?.sets ?? 0) > 0,
    }),
    streak: weekStreak(
      dates.map((d) => d.finished_at),
      now,
    ),
    goal,
    weekPrs: totalPrs - countPersonalRecords(before),
    xp: xpFor((finishedSetCount?.n ?? 0) + (activeTotals?.sets ?? 0), totalPrs),
  };
}
