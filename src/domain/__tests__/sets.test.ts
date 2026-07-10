import {
  createInitialSets,
  type PriorSet,
  referenceLabel,
  topCardioMetrics,
  topSetWeight,
  toPriorSets,
} from '@/domain/sets';

const prior: PriorSet[] = [
  { setNumber: 1, weightKg: 80, reps: 8 },
  { setNumber: 2, weightKg: 80, reps: 8 },
  { setNumber: 3, weightKg: 80, reps: 7 },
];

describe('toPriorSets', () => {
  it('sorts by set number', () => {
    const out = toPriorSets([
      { setNumber: 2, weightKg: 80, reps: 8 },
      { setNumber: 1, weightKg: 75, reps: 10 },
    ]);
    expect(out.map((s) => s.setNumber)).toEqual([1, 2]);
  });
});

const cardioNulls = { distanceKm: null, durationSec: null, level: null };

describe('createInitialSets', () => {
  it('returns one empty set with no history', () => {
    expect(createInitialSets([])).toEqual([
      { setNumber: 1, weightKg: null, reps: null, ...cardioNulls, done: false, reference: null },
    ]);
  });

  it('carries weight over, leaves reps empty, and sets the reference', () => {
    const out = createInitialSets(prior);
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({
      setNumber: 1,
      weightKg: 80,
      reps: null,
      ...cardioNulls,
      done: false,
      reference: { weightKg: 80, reps: 8 },
    });
    expect(out.every((s) => s.reps === null)).toBe(true);
  });

  it('carries distance and level over for cardio, leaves duration empty', () => {
    const cardioPrior: PriorSet[] = [
      { setNumber: 1, weightKg: null, reps: null, distanceKm: 5, durationSec: 1950, level: 8 },
    ];
    const out = createInitialSets(cardioPrior);
    expect(out[0]).toMatchObject({ distanceKm: 5, level: 8, durationSec: null });
  });
});

describe('topSetWeight', () => {
  it('returns the heaviest weight among performed sets', () => {
    expect(
      topSetWeight([
        { weightKg: 80, reps: 8 },
        { weightKg: 100, reps: 5 },
        { weightKg: null, reps: 10 },
      ]),
    ).toBe(100);
  });

  it('ignores carried-over sets that were never performed (no reps)', () => {
    expect(
      topSetWeight([
        { weightKg: 120, reps: null }, // opened, weight pre-filled, never done
        { weightKg: 80, reps: 8 },
      ]),
    ).toBe(80);
  });

  it('returns null when no set was performed with a weight', () => {
    expect(topSetWeight([{ weightKg: 120, reps: null }])).toBeNull();
    expect(topSetWeight([])).toBeNull();
  });
});

describe('topCardioMetrics', () => {
  it('returns max distance and max duration independently', () => {
    expect(
      topCardioMetrics([
        { distanceKm: 5, durationSec: 1800 },
        { distanceKm: 3, durationSec: 2100 },
        { distanceKm: null, durationSec: null },
      ]),
    ).toEqual({ distanceKm: 5, durationSec: 2100 });
  });

  it('returns nulls for empty or value-less sets', () => {
    expect(topCardioMetrics([])).toEqual({ distanceKm: null, durationSec: null });
    expect(topCardioMetrics([{ distanceKm: null, durationSec: null }])).toEqual({
      distanceKm: null,
      durationSec: null,
    });
  });
});

describe('referenceLabel', () => {
  it('is plain when the prior sets are from the same gym', () => {
    expect(referenceLabel(null)).toBe('↳ letztes Mal');
  });

  it('names the source gym on fallback', () => {
    expect(referenceLabel('McFit Köln')).toBe('↳ letztes Mal im McFit Köln');
  });
});
