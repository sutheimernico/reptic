import {
  describeRecords,
  detectPersonalRecords,
  epleyE1rm,
  type ExerciseBests,
  MIN_SESSIONS_FOR_PR,
  NO_BESTS,
  paceKmh,
  withSet,
} from '@/domain/personal-records';

/** Bests that are old enough to announce records. */
const seasoned = (over: Partial<ExerciseBests> = {}): ExerciseBests => ({
  ...NO_BESTS,
  priorSessions: MIN_SESSIONS_FOR_PR,
  ...over,
});

const set = (over: Partial<Parameters<typeof detectPersonalRecords>[0]> = {}) => ({
  weightKg: null,
  reps: null,
  distanceKm: null,
  durationSec: null,
  ...over,
});

describe('epleyE1rm', () => {
  it('estimates weight × (1 + reps/30)', () => {
    expect(epleyE1rm(100, 5)).toBeCloseTo(116.667, 3);
    expect(epleyE1rm(80, 1)).toBeCloseTo(82.667, 3);
  });

  it('refuses long sets, where the estimate drifts high', () => {
    expect(epleyE1rm(60, 12)).not.toBeNull();
    expect(epleyE1rm(60, 13)).toBeNull();
  });

  it('refuses sets that carry no real lift', () => {
    expect(epleyE1rm(null, 8)).toBeNull();
    expect(epleyE1rm(100, null)).toBeNull();
    expect(epleyE1rm(0, 8)).toBeNull();
    expect(epleyE1rm(100, 0)).toBeNull();
  });
});

describe('paceKmh', () => {
  it('converts distance and time to km/h', () => {
    expect(paceKmh(10, 3600)).toBe(10);
    expect(paceKmh(5, 1800)).toBe(10);
  });

  it('needs both halves and refuses zeros', () => {
    expect(paceKmh(10, null)).toBeNull();
    expect(paceKmh(null, 3600)).toBeNull();
    expect(paceKmh(10, 0)).toBeNull();
  });
});

describe('detectPersonalRecords', () => {
  it('stays quiet until the exercise has enough history', () => {
    const young = { ...NO_BESTS, priorSessions: MIN_SESSIONS_FOR_PR - 1 };
    expect(detectPersonalRecords(set({ weightKg: 200, reps: 10 }), young)).toEqual([]);
  });

  it('flags a heavier lift than ever before', () => {
    const bests = seasoned({ topWeightKg: 80, topE1rm: 100 });
    expect(detectPersonalRecords(set({ weightKg: 85, reps: 5 }), bests)).toContain('weight');
  });

  it('does not treat a tie as a record', () => {
    const bests = seasoned({ topWeightKg: 80, topE1rm: 80 * (1 + 8 / 30) });
    expect(detectPersonalRecords(set({ weightKg: 80, reps: 8 }), bests)).toEqual([]);
  });

  it('flags a stronger set even when the weight is not a record', () => {
    // 80 × 10 estimates higher than the previous best of 80 × 8, same weight.
    const bests = seasoned({ topWeightKg: 80, topE1rm: epleyE1rm(80, 8) });
    expect(detectPersonalRecords(set({ weightKg: 80, reps: 10 }), bests)).toEqual(['e1rm']);
  });

  it('never fires for a carried-over row the user did not fill in', () => {
    const bests = seasoned({ topWeightKg: 60 });
    // Weight pre-filled from last time, no reps typed: not a lift.
    expect(detectPersonalRecords(set({ weightKg: 100, reps: null }), bests)).toEqual([]);
  });

  it('flags cardio distance and pace separately', () => {
    const bests = seasoned({ topDistanceKm: 10, topPaceKmh: 12 });
    expect(detectPersonalRecords(set({ distanceKm: 12, durationSec: 3600 }), bests)).toEqual([
      'distance',
    ]);
    expect(detectPersonalRecords(set({ distanceKm: 8, durationSec: 1800 }), bests)).toEqual([
      'pace',
    ]);
    expect(detectPersonalRecords(set({ distanceKm: 12, durationSec: 1800 }), bests)).toEqual([
      'distance',
      'pace',
    ]);
  });

  it('does not claim a pace record from distance alone', () => {
    const bests = seasoned({ topDistanceKm: 5, topPaceKmh: 8 });
    expect(detectPersonalRecords(set({ distanceKm: 6, durationSec: null }), bests)).toEqual([
      'distance',
    ]);
  });

  it('sets both records on the very first qualifying set after the quiet period', () => {
    const bests = seasoned(); // history exists, but no usable bests recorded
    expect(detectPersonalRecords(set({ weightKg: 50, reps: 5 }), bests)).toEqual([
      'weight',
      'e1rm',
    ]);
  });
});

describe('withSet', () => {
  it('advances the bests so the next set of the session compares fairly', () => {
    let bests = seasoned({ topWeightKg: 80, topE1rm: epleyE1rm(80, 8) });

    const first = set({ weightKg: 85, reps: 5 });
    expect(detectPersonalRecords(first, bests)).toContain('weight');
    bests = withSet(bests, first);

    // The same 85 kg one set later is no longer a record.
    expect(detectPersonalRecords(set({ weightKg: 85, reps: 5 }), bests)).toEqual([]);
    expect(bests.topWeightKg).toBe(85);
  });

  it('ignores a weight without reps, and keeps the session count untouched', () => {
    const bests = withSet(seasoned({ topWeightKg: 60 }), set({ weightKg: 200, reps: null }));
    expect(bests.topWeightKg).toBe(60);
    expect(bests.priorSessions).toBe(MIN_SESSIONS_FOR_PR);
  });

  it('tracks cardio bests', () => {
    const bests = withSet(seasoned(), set({ distanceKm: 10, durationSec: 3600 }));
    expect(bests.topDistanceKm).toBe(10);
    expect(bests.topPaceKmh).toBe(10);
  });
});

describe('describeRecords', () => {
  it('names the records in German', () => {
    expect(describeRecords(['weight'])).toBe('schwerstes Gewicht');
    expect(describeRecords(['distance', 'pace'])).toBe('weiteste Strecke · höchstes Tempo');
  });
});
