/**
 * Pure logic behind the session summary: how long a session took, which
 * earlier session it is fairly compared with, the deltas, and the records it
 * set. The data layer supplies the raw numbers; the screen only renders.
 */

import {
  type ExerciseBests,
  type ExerciseTops,
  type PrKind,
  sessionRecords,
} from '@/domain/personal-records';
import type { SessionTotals } from '@/domain/types';

export const NO_TOTALS: SessionTotals = { exerciseCount: 0, setCount: 0, volume: 0, distanceKm: 0 };

/** Whole seconds from start to end; null when the session has no (valid) end. Never negative. */
export function sessionDurationSec(startedAt: string, finishedAt: string | null): number | null {
  if (finishedAt === null) return null;
  const ms = Date.parse(finishedAt) - Date.parse(startedAt);
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.round(ms / 1000));
}

/**
 * Whether two sessions trained the same plans — the only comparison that is
 * fair ("Push" against "Push", not against "Beine"). Order does not matter;
 * a session without plans ("leere Einheit") has nothing to be compared with.
 */
export function samePlanSet(a: number[], b: number[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const left = new Set(a);
  const right = new Set(b);
  return left.size === right.size && [...left].every((id) => right.has(id));
}

/** What the summary knows about one session. */
export interface SessionFacts {
  startedAt: string;
  durationSec: number | null;
  totals: SessionTotals;
}

/** Current minus previous, per measure. */
export interface SessionComparison {
  previousStartedAt: string;
  /** Null when either session lacks a duration. */
  durationSec: number | null;
  setCount: number;
  volume: number;
  /** Relative volume change in whole percent; null when the previous session moved no weight. */
  volumePct: number | null;
  distanceKm: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function compareSessions(current: SessionFacts, previous: SessionFacts): SessionComparison {
  const volume = round2(current.totals.volume - previous.totals.volume);
  return {
    previousStartedAt: previous.startedAt,
    durationSec:
      current.durationSec === null || previous.durationSec === null
        ? null
        : current.durationSec - previous.durationSec,
    setCount: current.totals.setCount - previous.totals.setCount,
    volume,
    volumePct:
      previous.totals.volume > 0 ? Math.round((volume / previous.totals.volume) * 100) : null,
    distanceKm: round2(current.totals.distanceKm - previous.totals.distanceKm),
  };
}

/** One exercise of the session with its best values and what it had to beat. */
export interface SessionRecordInput {
  exerciseId: number;
  name: string;
  session: ExerciseTops;
  before: ExerciseBests;
}

export interface SessionRecord {
  exerciseId: number;
  name: string;
  kinds: PrKind[];
}

export interface SessionSummary {
  durationSec: number | null;
  totals: SessionTotals;
  /** Null for a session without plans or the first one with this plan set. */
  comparison: SessionComparison | null;
  /** Only exercises that actually set a record, in session order. */
  records: SessionRecord[];
}

export function summarizeSession({
  current,
  previous,
  recordInputs,
}: {
  current: SessionFacts;
  previous: SessionFacts | null;
  recordInputs: SessionRecordInput[];
}): SessionSummary {
  return {
    durationSec: current.durationSec,
    totals: current.totals,
    comparison: previous ? compareSessions(current, previous) : null,
    records: recordInputs
      .map((r) => ({
        exerciseId: r.exerciseId,
        name: r.name,
        kinds: sessionRecords(r.session, r.before),
      }))
      .filter((r) => r.kinds.length > 0),
  };
}
