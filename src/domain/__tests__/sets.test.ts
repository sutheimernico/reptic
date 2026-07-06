import {
  addSet,
  createInitialSets,
  type PriorSet,
  removeSet,
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

describe('createInitialSets', () => {
  it('returns one empty set with no history', () => {
    expect(createInitialSets([])).toEqual([
      { setNumber: 1, weightKg: null, reps: null, done: false, reference: null },
    ]);
  });

  it('carries weight over, leaves reps empty, and sets the reference', () => {
    const out = createInitialSets(prior);
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({
      setNumber: 1,
      weightKg: 80,
      reps: null,
      done: false,
      reference: { weightKg: 80, reps: 8 },
    });
    expect(out.every((s) => s.reps === null)).toBe(true);
  });
});

describe('addSet', () => {
  it('inherits weight and reference from last time at that position', () => {
    const current = createInitialSets(prior).slice(0, 2);
    const out = addSet(current, prior);
    expect(out).toHaveLength(3);
    expect(out[2]).toEqual({
      setNumber: 3,
      weightKg: 80,
      reps: null,
      done: false,
      reference: { weightKg: 80, reps: 7 },
    });
  });

  it('inherits from the last current set when there is no prior for the new position', () => {
    const current = createInitialSets(prior); // 3 sets
    const out = addSet(current, prior); // 4th set has no prior
    expect(out[3]).toEqual({
      setNumber: 4,
      weightKg: 80, // from the last current set
      reps: null,
      done: false,
      reference: null,
    });
  });
});

describe('removeSet', () => {
  it('renumbers remaining sets and re-maps references by position', () => {
    const current = createInitialSets(prior);
    const out = removeSet(current, 2, prior);
    expect(out.map((s) => s.setNumber)).toEqual([1, 2]);
    // position 2 now references last time's set index 1 (80 kg × 8)
    expect(out[1].reference).toEqual({ weightKg: 80, reps: 8 });
  });
});

describe('topSetWeight', () => {
  it('returns the heaviest weight, ignoring sets without one', () => {
    expect(topSetWeight([{ weightKg: 80 }, { weightKg: 100 }, { weightKg: null }])).toBe(100);
  });

  it('returns null when no set carries a weight', () => {
    expect(topSetWeight([{ weightKg: null }, { weightKg: null }])).toBeNull();
    expect(topSetWeight([])).toBeNull();
  });
});
