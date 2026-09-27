import { DEFAULT_PLATE_SETUP, type PlateSetup } from '@/domain/plates';
import {
  DEFAULT_INCREMENT_KG,
  DEFAULT_PROGRESSION,
  DEFAULT_REP_TARGET,
  describeHint,
  MAX_REP_TARGET,
  MIN_REP_TARGET,
  nextWeight,
  parseIncrement,
  parseRepTarget,
  rowsToBump,
  stepIncrement,
  stepRepTarget,
  suggestProgression,
} from '@/domain/progression';
import type { PriorSet } from '@/domain/sets';

const set = (setNumber: number, weightKg: number | null, reps: number | null): PriorSet => ({
  setNumber,
  weightKg,
  reps,
});

describe('suggestProgression', () => {
  it('stays quiet without history', () => {
    expect(suggestProgression([], DEFAULT_PROGRESSION, DEFAULT_PLATE_SETUP)).toBeNull();
  });

  it('stays quiet when last time was only opened, never lifted (carried-over rows)', () => {
    const prior = [set(1, 60, null), set(2, 60, null)];
    expect(suggestProgression(prior, DEFAULT_PROGRESSION, DEFAULT_PLATE_SETUP)).toBeNull();
  });

  it('stays quiet for bodyweight work — there is no load to progress', () => {
    const prior = [set(1, null, 12), set(2, 0, 12)];
    expect(suggestProgression(prior, DEFAULT_PROGRESSION, DEFAULT_PLATE_SETUP)).toBeNull();
  });

  it('goes up once every working set reached the rep target', () => {
    const prior = [set(1, 60, 12), set(2, 60, 13), set(3, 60, 12)];
    expect(suggestProgression(prior, DEFAULT_PROGRESSION, DEFAULT_PLATE_SETUP)).toEqual({
      kind: 'increase',
      fromKg: 60,
      toKg: 62.5,
      repTarget: 12,
      workingSets: 3,
    });
  });

  it('holds the weight while any working set is short of the target', () => {
    const prior = [set(1, 60, 12), set(2, 60, 11), set(3, 60, 12)];
    expect(suggestProgression(prior, DEFAULT_PROGRESSION, DEFAULT_PLATE_SETUP)).toEqual({
      kind: 'hold',
      weightKg: 60,
      repTarget: 12,
    });
  });

  it('judges only the sets at the top weight — warm-ups and back-offs do not count', () => {
    // A light warm-up with few reps must not block the increase …
    const warmup = [set(1, 30, 5), set(2, 60, 12), set(3, 60, 12)];
    expect(suggestProgression(warmup, DEFAULT_PROGRESSION, DEFAULT_PLATE_SETUP)?.kind).toBe(
      'increase',
    );
    // … and a high-rep back-off set must not trigger one.
    const backoff = [set(1, 60, 9), set(2, 50, 15)];
    expect(suggestProgression(backoff, DEFAULT_PROGRESSION, DEFAULT_PLATE_SETUP)).toEqual({
      kind: 'hold',
      weightKg: 60,
      repTarget: 12,
    });
  });

  it('uses the configured rep target and increment', () => {
    const prior = [set(1, 100, 5), set(2, 100, 5)];
    const settings = { repTarget: 5, incrementKg: 5 };
    expect(suggestProgression(prior, settings, DEFAULT_PLATE_SETUP)).toMatchObject({
      kind: 'increase',
      toKg: 105,
    });
    expect(suggestProgression(prior, DEFAULT_PROGRESSION, DEFAULT_PLATE_SETUP)?.kind).toBe('hold');
  });
});

describe('nextWeight', () => {
  const noSmallPlates: PlateSetup = {
    barKg: 20,
    stock: DEFAULT_PLATE_SETUP.stock.filter((p) => p.kg !== 1.25),
  };

  it('adds the plain increment when the step is loadable', () => {
    expect(nextWeight(60, 2.5, DEFAULT_PLATE_SETUP)).toBe(62.5);
  });

  it('rounds up to the next loadable weight on a barbell weight', () => {
    // Without 1.25 kg plates, 62.5 cannot be built — 65 is the next real option.
    expect(nextWeight(60, 2.5, noSmallPlates)).toBe(65);
  });

  it('ignores the plates for weights no bar can build (machines, dumbbells)', () => {
    expect(nextWeight(47, 2.5, noSmallPlates)).toBe(49.5); // odd machine stack step
    expect(nextWeight(14, 2, DEFAULT_PLATE_SETUP)).toBe(16); // dumbbell below the bar
  });

  it('works without a plate setup and avoids float drift', () => {
    expect(nextWeight(61.25, 1.25, null)).toBe(62.5);
    expect(nextWeight(0.1, 0.2, null)).toBe(0.3);
  });

  it('keeps the honest number when the rack runs out', () => {
    const tiny: PlateSetup = { barKg: 20, stock: [{ kg: 5, pairs: 1 }] };
    expect(nextWeight(30, 2.5, tiny)).toBe(32.5);
  });
});

describe('describeHint', () => {
  it('names the new weight and why', () => {
    expect(
      describeHint({ kind: 'increase', fromKg: 60, toKg: 62.5, repTarget: 12, workingSets: 3 }),
    ).toEqual({
      title: 'Vorschlag: 62.5 kg',
      detail: 'Letztes Mal 3 Sätze mit 60 kg × 12+ geschafft',
    });
    expect(
      describeHint({ kind: 'increase', fromKg: 60, toKg: 62.5, repTarget: 12, workingSets: 1 })
        .detail,
    ).toBe('Letztes Mal 1 Satz mit 60 kg × 12+ geschafft');
  });

  it('says to stay and what to reach', () => {
    expect(describeHint({ kind: 'hold', weightKg: 60, repTarget: 12 })).toEqual({
      title: 'Vorschlag: bei 60 kg bleiben',
      detail: 'Ziel: 12 Wdh. in jedem Satz, dann steigern',
    });
  });
});

describe('rowsToBump', () => {
  it('moves only open rows still at the old working weight', () => {
    const rows = [
      { weightKg: 60, done: true }, // finished — untouchable
      { weightKg: 60, done: false },
      { weightKg: 57.5, done: false }, // typed to something else
      { weightKg: null, done: false },
      { weightKg: 60, done: false },
    ];
    expect(rowsToBump(rows, 60)).toEqual([1, 4]);
  });
});

describe('settings', () => {
  it('parses the rep target with a safe fallback and clamps it', () => {
    expect(parseRepTarget(null)).toBe(DEFAULT_REP_TARGET);
    expect(parseRepTarget('garbage')).toBe(DEFAULT_REP_TARGET);
    expect(parseRepTarget('8')).toBe(8);
    expect(parseRepTarget('1')).toBe(MIN_REP_TARGET);
    expect(parseRepTarget('99')).toBe(MAX_REP_TARGET);
  });

  it('steps the rep target within its bounds', () => {
    expect(stepRepTarget(12, 1)).toBe(13);
    expect(stepRepTarget(MIN_REP_TARGET, -1)).toBe(MIN_REP_TARGET);
    expect(stepRepTarget(MAX_REP_TARGET, 1)).toBe(MAX_REP_TARGET);
  });

  it('accepts only the offered increments', () => {
    expect(parseIncrement(null)).toBe(DEFAULT_INCREMENT_KG);
    expect(parseIncrement('1.25')).toBe(1.25);
    expect(parseIncrement('3')).toBe(DEFAULT_INCREMENT_KG);
    expect(parseIncrement('abc')).toBe(DEFAULT_INCREMENT_KG);
  });

  it('steps through the offered increments and stops at the ends', () => {
    expect(stepIncrement(2.5, 1)).toBe(5);
    expect(stepIncrement(2.5, -1)).toBe(2);
    expect(stepIncrement(5, 1)).toBe(5);
    expect(stepIncrement(1, -1)).toBe(1);
    expect(stepIncrement(3, 1)).toBe(5); // unknown value restarts from the default
  });
});
