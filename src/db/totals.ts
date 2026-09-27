/**
 * Per-session totals of performed work, as one aggregate pass over
 * `workout_sets`. Shared by the history list and the session summary; internal
 * to the data layer (not re-exported from `@/db`).
 *
 * Why a grouped sub-select and not a scalar sub-select per session: there is no
 * index on `workout_sets.workout_id`, so each correlated sub-select scanned the
 * whole table — three of them per history row made the Verlauf query
 * O(sessions × sets): 2.3 s on three years of data (624 sessions, 17k sets,
 * node:sqlite), versus 13 ms for this single pass. No index means no schema
 * migration on Nico's device.
 */

import type { SessionTotals } from '@/domain/types';

/**
 * "Performed" = reps entered (strength) or a cardio metric entered. Opening an
 * exercise pre-fills carried-over settings with empty performance, and those
 * untouched rows are not work done.
 */
export const PERFORMED_SET_SQL =
  '(reps IS NOT NULL OR duration_sec IS NOT NULL OR distance_km IS NOT NULL)';

/**
 * The aggregate, one row per session. `where` narrows the scanned sets (e.g. to
 * a couple of sessions) — pass a condition without the WHERE keyword.
 * Volume needs no performed filter: a carried-over weight with no reps
 * multiplies to NULL, which SUM skips.
 */
export function sessionTotalsSql(where?: string): string {
  return `SELECT workout_id,
       COUNT(DISTINCT CASE WHEN ${PERFORMED_SET_SQL} THEN exercise_id END) AS exercise_count,
       SUM(CASE WHEN ${PERFORMED_SET_SQL} THEN 1 ELSE 0 END) AS set_count,
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
