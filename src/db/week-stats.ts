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
  weekStreak,
  WEEK_GOAL_KG_SETTING,
  WEEK_GOAL_KM_SETTING,
  xpFor,
  type PrReplaySet,
  type WeekGoal,
  type WeekProgress,
} from '@/domain/week-stats';
import { bucketByWeek, isoWeekKey, isoWeekOf, startOfWeekWindow, type WeekTotals } from '@/domain/weeks';

const WINDOW_WEEKS = 12;

export interface WeekOverview {
  progress: WeekProgress;
  weeks: WeekTotals[];
  streak: number;
  goal: WeekGoal;
  xp: number;
}

export async function getWeekOverview(db: SQLiteDatabase, now: Date): Promise<WeekOverview> {
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

  const dates = await db.getAllAsync<{ finished_at: string }>(
    'SELECT finished_at FROM workouts WHERE finished_at IS NOT NULL',
  );

  const finishedSetCount = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM workout_sets s
     JOIN workouts w ON w.id = s.workout_id
     WHERE w.finished_at IS NOT NULL AND ${performedSql('s.')}`,
  );
  const prSets = await db.getAllAsync<{
    workout_id: number;
    exercise_id: number;
    weight_kg: number | null;
    reps: number | null;
    distance_km: number | null;
    duration_sec: number | null;
  }>(
    `SELECT s.workout_id, s.exercise_id, s.weight_kg, s.reps, s.distance_km, s.duration_sec
     FROM workout_sets s
     JOIN workouts w ON w.id = s.workout_id
     WHERE w.finished_at IS NOT NULL AND ${performedSql('s.')}
     ORDER BY w.finished_at, w.id, s.id`,
  );
  const replay: PrReplaySet[] = prSets.map((r) => ({
    workoutId: r.workout_id,
    exerciseId: r.exercise_id,
    weightKg: r.weight_kg,
    reps: r.reps,
    distanceKm: r.distance_km,
    durationSec: r.duration_sec,
  }));

  const goal = resolveWeekGoal(
    await getSetting(db, WEEK_GOAL_KG_SETTING),
    await getSetting(db, WEEK_GOAL_KM_SETTING),
    weeks,
  );

  return {
    progress,
    weeks,
    streak: weekStreak(
      dates.map((d) => d.finished_at),
      now,
    ),
    goal,
    xp: xpFor((finishedSetCount?.n ?? 0) + (activeTotals?.sets ?? 0), countPersonalRecords(replay)),
  };
}
