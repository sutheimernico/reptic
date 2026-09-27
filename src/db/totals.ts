/**
 * Shared SQL building blocks over `workout_sets`: what counts as performed, the
 * personal-record measures, and per-session totals of performed work as one
 * aggregate pass. Used by the history list, the live record badge and the
 * session summary; internal to the data layer (not re-exported from `@/db`).
 *
 * Why a grouped sub-select and not a scalar sub-select per session: there is no
 * index on `workout_sets.workout_id`, so each correlated sub-select scanned the
 * whole table — three of them per history row made the Verlauf query
 * O(sessions × sets): 2.3 s on three years of data (624 sessions, 17k sets,
 * node:sqlite), versus 13 ms for this single pass. No index means no schema
 * migration on Nico's device.
 */

import { MAX_REPS_FOR_E1RM } from '@/domain/personal-records';
import type { SessionTotals } from '@/domain/types';

/**
 * "Performed" = reps entered (strength) or a cardio metric entered. Opening an
 * exercise pre-fills carried-over settings with empty performance, and those
 * untouched rows are not work done. `p` is an optional table alias prefix
 * (e.g. `'s.'`).
 */
export function performedSql(p = ''): string {
  return `(${p}reps IS NOT NULL OR ${p}duration_sec IS NOT NULL OR ${p}distance_km IS NOT NULL)`;
}

/**
 * The four "best" measures a personal record is judged on, as aggregate
 * columns (top_weight, top_e1rm, top_distance, top_pace). One definition for
 * the live badge and the session summary, so the two can never disagree about
 * what counts as a record. A weight without reps was never lifted.
 */
export function bestColumnsSql(p = ''): string {
  return `MAX(CASE WHEN ${p}reps >= 1 THEN ${p}weight_kg END) AS top_weight,
       MAX(CASE WHEN ${p}reps >= 1 AND ${p}reps <= ${MAX_REPS_FOR_E1RM} AND ${p}weight_kg > 0
                THEN ${p}weight_kg * (1 + ${p}reps / 30.0) END) AS top_e1rm,
       MAX(${p}distance_km) AS top_distance,
       MAX(CASE WHEN ${p}distance_km > 0 AND ${p}duration_sec > 0
                THEN ${p}distance_km / (${p}duration_sec / 3600.0) END) AS top_pace`;
}

/**
 * The aggregate, one row per session. `where` narrows the scanned sets (e.g. to
 * a couple of sessions) — pass a condition without the WHERE keyword.
 * Volume needs no performed filter: a carried-over weight with no reps
 * multiplies to NULL, which SUM skips.
 */
export function sessionTotalsSql(where?: string): string {
  return `SELECT workout_id,
       COUNT(DISTINCT CASE WHEN ${performedSql()} THEN exercise_id END) AS exercise_count,
       SUM(CASE WHEN ${performedSql()} THEN 1 ELSE 0 END) AS set_count,
       COALESCE(SUM(weight_kg * reps), 0) AS volume,
       COALESCE(SUM(distance_km), 0) AS distance
     FROM workout_sets
     ${where ? `WHERE ${where}` : ''}
     GROUP BY workout_id`;
}

/** The columns a `LEFT JOIN (sessionTotalsSql) t` contributes; NULL when a session has no sets. */
export interface SessionTotalsRow {
  exercise_count: number | null;
  set_count: number | null;
  volume: number | null;
  distance: number | null;
}

export const mapSessionTotals = (r: SessionTotalsRow): SessionTotals => ({
  exerciseCount: r.exercise_count ?? 0,
  setCount: r.set_count ?? 0,
  volume: r.volume ?? 0,
  distanceKm: r.distance ?? 0,
});
