import { MIN_SESSIONS_FOR_PR, NO_BESTS } from '@/domain/personal-records';
import {
  compareSessions,
  NO_TOTALS,
  samePlanSet,
  sessionDurationSec,
  type SessionFacts,
  summarizeSession,
} from '@/domain/session';

const facts = (over: Partial<SessionFacts> & { volume?: number; sets?: number; km?: number } = {}) => ({
  startedAt: over.startedAt ?? '2026-09-20T10:00:00.000Z',
  durationSec: over.durationSec === undefined ? 3600 : over.durationSec,
  totals: {
    ...NO_TOTALS,
    volume: over.volume ?? 0,
    setCount: over.sets ?? 0,
    distanceKm: over.km ?? 0,
  },
});

describe('sessionDurationSec', () => {
  it('is the whole seconds between start and end', () => {
    expect(sessionDurationSec('2026-09-27T10:00:00.000Z', '2026-09-27T11:12:30.400Z')).toBe(4350);
  });

  it('is unknown without an end, and never negative', () => {
    expect(sessionDurationSec('2026-09-27T10:00:00.000Z', null)).toBeNull();
    expect(sessionDurationSec('garbage', '2026-09-27T10:00:00.000Z')).toBeNull();
    expect(sessionDurationSec('2026-09-27T11:00:00.000Z', '2026-09-27T10:00:00.000Z')).toBe(0);
  });
});

describe('samePlanSet', () => {
  it('matches the same plans in any order', () => {
    expect(samePlanSet([1, 2], [2, 1])).toBe(true);
    expect(samePlanSet([3], [3])).toBe(true);
  });

  it('does not match a different or partial selection', () => {
    expect(samePlanSet([1, 2], [1])).toBe(false);
    expect(samePlanSet([1], [2])).toBe(false);
  });

  it('never matches an empty session', () => {
    expect(samePlanSet([], [])).toBe(false);
    expect(samePlanSet([], [1])).toBe(false);
  });
});

describe('compareSessions', () => {
  it('reports current minus previous for every measure', () => {
    const current = facts({ volume: 4500, sets: 18, durationSec: 3300, km: 2.5 });
    const previous = facts({
      startedAt: '2026-09-13T10:00:00.000Z',
      volume: 4180,
      sets: 16,
      durationSec: 3600,
      km: 3,
    });
    expect(compareSessions(current, previous)).toEqual({
      previousStartedAt: '2026-09-13T10:00:00.000Z',
      durationSec: -300,
      setCount: 2,
      volume: 320,
      volumePct: 8,
      distanceKm: -0.5,
    });
  });

  it('has no percentage when the previous session moved no weight', () => {
    expect(compareSessions(facts({ volume: 500 }), facts({ volume: 0 })).volumePct).toBeNull();
  });

  it('has no duration delta when either session lacks one', () => {
    expect(compareSessions(facts({ durationSec: null }), facts()).durationSec).toBeNull();
  });

  it('keeps float noise out of the deltas', () => {
    expect(compareSessions(facts({ km: 0.3 }), facts({ km: 0.1 })).distanceKm).toBe(0.2);
  });
});

describe('summarizeSession', () => {
  const seasoned = { ...NO_BESTS, priorSessions: MIN_SESSIONS_FOR_PR, topWeightKg: 80 };

  it('lists only the exercises that set a record, keeping their order', () => {
    const summary = summarizeSession({
      current: facts({ volume: 1000 }),
      previous: null,
      recordInputs: [
        { exerciseId: 1, name: 'Brustpresse', session: { ...NO_BESTS, topWeightKg: 85 }, before: seasoned },
        { exerciseId: 2, name: 'Rudern', session: { ...NO_BESTS, topWeightKg: 80 }, before: seasoned },
        { exerciseId: 3, name: 'Curls', session: { ...NO_BESTS, topWeightKg: 90 }, before: seasoned },
      ],
    });
    expect(summary.records).toEqual([
      { exerciseId: 1, name: 'Brustpresse', kinds: ['weight'] },
      { exerciseId: 3, name: 'Curls', kinds: ['weight'] },
    ]);
    expect(summary.comparison).toBeNull();
    expect(summary.totals.volume).toBe(1000);
  });

  it('compares when there is a previous session', () => {
    const summary = summarizeSession({
      current: facts({ sets: 10 }),
      previous: facts({ sets: 12 }),
      recordInputs: [],
    });
    expect(summary.comparison?.setCount).toBe(-2);
  });
});
