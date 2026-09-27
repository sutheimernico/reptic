/**
 * The numbers behind the session summary: per-session totals, the earlier
 * session with the same plans, and each exercise's bests against what came
 * before. The assembling (deltas, which bests are records) is pure and lives in
 * `@/domain/session`.
 *
 * Part of the `@/db` data layer: screens import from `@/db`, never from here
 * directly. Rows come back snake_case and are mapped to camelCase domain types
 * in `./rows`; pure transformations live in `@/domain`.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import { mapWorkout, type WorkoutRow } from '@/db/rows';
import {
  bestColumnsSql,
  mapSessionTotals,
  performedSql,
  sessionTotalsSql,
  type SessionTotalsRow,
} from '@/db/totals';
import { samePlanSet, type SessionRecordInput } from '@/domain/session';
import type { SessionTotals, Workout } from '@/domain/types';

/** Totals for the given sessions in one grouped query; sessions without sets are absent. */
export async function getSessionTotals(
  db: SQLiteDatabase,
  workoutIds: number[],
): Promise<Map<number, SessionTotals>> {
  const totals = new Map<number, SessionTotals>();
  if (workoutIds.length === 0) return totals;
  const rows = await db.getAllAsync<SessionTotalsRow & { workout_id: number }>(
    sessionTotalsSql(`workout_id IN (${workoutIds.map(() => '?').join(', ')})`),
    ...workoutIds,
  );
  for (const row of rows) totals.set(row.workout_id, mapSessionTotals(row));
  return totals;
}

/**
 * The most recent finished session that started before `workout` and trained
 * exactly the same plans (order ignored), or null. Plan ids are stored as a
 * JSON array, so the set comparison happens in JS over the small workouts
 * table — never over the sets.
 */
export async function getPreviousSamePlanWorkout(
  db: SQLiteDatabase,
  workout: Workout,
): Promise<Workout | null> {
  if (workout.planIds.length === 0) return null;
  const rows = await db.getAllAsync<WorkoutRow>(
    `SELECT * FROM workouts
     WHERE finished_at IS NOT NULL AND id != ? AND started_at < ? AND plan_ids != '[]'
     ORDER BY started_at DESC`,
    workout.id,
    workout.startedAt,
  );
  for (const row of rows) {
    const candidate = mapWorkout(row);
    if (samePlanSet(candidate.planIds, workout.planIds)) return candidate;
  }
  return null;
}

/**
 * Per exercise performed in `workout`: its best values in this session and the
 * bests from every session that started earlier, in one statement. The
 * measures are the live badge's (`bestColumnsSql`), and "earlier" means
 * started before — so reopening an old summary still shows the records it set
 * back then, not whether later sessions have beaten them since.
 */
export async function getSessionRecordInputs(
  db: SQLiteDatabase,
  workout: Workout,
): Promise<SessionRecordInput[]> {
  const rows = await db.getAllAsync<{
    exercise_id: number;
    name: string;
    top_weight: number | null;
    top_e1rm: number | null;
    top_distance: number | null;
    top_pace: number | null;
    prior_sessions: number;
    earlier_weight: number | null;
    earlier_e1rm: number | null;
    earlier_distance: number | null;
    earlier_pace: number | null;
  }>(
    `WITH cur AS (
       SELECT exercise_id, ${bestColumnsSql()}
       FROM workout_sets
       WHERE workout_id = ? AND ${performedSql()}
       GROUP BY exercise_id
     ),
     earlier AS (
       SELECT s.exercise_id,
              COUNT(DISTINCT CASE WHEN ${performedSql('s.')} THEN s.workout_id END)
                AS prior_sessions,
              ${bestColumnsSql('s.')}
       FROM workout_sets s
       JOIN workouts w ON w.id = s.workout_id
       WHERE w.started_at < ? AND w.id != ?
         AND s.exercise_id IN (SELECT exercise_id FROM cur)
       GROUP BY s.exercise_id
     )
     SELECT cur.exercise_id, e.name,
            cur.top_weight, cur.top_e1rm, cur.top_distance, cur.top_pace,
            COALESCE(earlier.prior_sessions, 0) AS prior_sessions,
            earlier.top_weight AS earlier_weight, earlier.top_e1rm AS earlier_e1rm,
            earlier.top_distance AS earlier_distance, earlier.top_pace AS earlier_pace
     FROM cur
     JOIN exercises e ON e.id = cur.exercise_id
     LEFT JOIN earlier ON earlier.exercise_id = cur.exercise_id
     ORDER BY (SELECT MIN(we.sort_order) FROM workout_exercises we
               WHERE we.workout_id = ? AND we.exercise_id = cur.exercise_id), e.name`,
    workout.id,
    workout.startedAt,
    workout.id,
    workout.id,
  );
  return rows.map((r) => ({
    exerciseId: r.exercise_id,
    name: r.name,
    session: {
      topWeightKg: r.top_weight,
      topE1rm: r.top_e1rm,
      topDistanceKm: r.top_distance,
      topPaceKmh: r.top_pace,
    },
    before: {
      priorSessions: r.prior_sessions,
      topWeightKg: r.earlier_weight,
      topE1rm: r.earlier_e1rm,
      topDistanceKm: r.earlier_distance,
      topPaceKmh: r.earlier_pace,
    },
  }));
}
