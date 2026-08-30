import {
  DEFAULT_PLATE_SETUP,
  parsePlateSetup,
  type PlateSetup,
  serializePlateSetup,
  solvePlates,
} from '@/domain/plates';

/** Unlimited-ish stock, the case most gym calculators assume. */
const rich: PlateSetup = {
  barKg: 20,
  stock: [
    { kg: 25, pairs: 8 },
    { kg: 20, pairs: 8 },
    { kg: 10, pairs: 8 },
    { kg: 5, pairs: 8 },
    { kg: 2.5, pairs: 8 },
    { kg: 1.25, pairs: 8 },
  ],
};

describe('solvePlates', () => {
  it('returns the bare bar for the bar weight itself', () => {
    expect(solvePlates(20, rich)).toEqual({
      totalKg: 20,
      perSide: [],
      exact: true,
      nextHigherKg: null,
    });
  });

  it('refuses a target lighter than the bar', () => {
    expect(solvePlates(15, rich)).toBeNull();
  });

  it('loads a common weight out of few, heavy plates', () => {
    const solution = solvePlates(100, rich);
    // 40 kg per side, and it says 20 + 20 rather than 25 + 10 + 5.
    expect(solution).toMatchObject({ totalKg: 100, exact: true, perSide: [20, 20] });
  });

  it('handles the quarter-kilo steps that break naive float maths', () => {
    const solution = solvePlates(62.5, rich);
    expect(solution).toMatchObject({ exact: true, totalKg: 62.5 });
    expect(solution?.perSide.reduce((a, b) => a + b, 0)).toBeCloseTo(21.25, 10);
  });

  it('says so honestly when a weight is not loadable, with the next one up', () => {
    // No 0.5 kg plates: 61 kg would need 20.5 per side.
    const solution = solvePlates(61, rich);
    expect(solution?.exact).toBe(false);
    expect(solution?.totalKg).toBe(60);
    expect(solution?.nextHigherKg).toBe(62.5);
  });

  it('handles a target that cannot be split across two sides at all', () => {
    // 21.25 kg is 1.25 kg above the bar — that is 0.625 kg per side.
    const solution = solvePlates(21.25, rich);
    expect(solution?.exact).toBe(false);
    expect(solution?.totalKg).toBe(20);
    expect(solution?.nextHigherKg).toBe(22.5);
  });

  it('respects a limited stock instead of inventing plates', () => {
    const sparse: PlateSetup = { barKg: 20, stock: [{ kg: 20, pairs: 1 }] };
    expect(solvePlates(60, sparse)).toMatchObject({
      totalKg: 60,
      perSide: [20],
      exact: true,
    });
    // Only one pair exists, so 100 kg is out of reach in both directions.
    expect(solvePlates(100, sparse)).toMatchObject({
      totalKg: 60,
      exact: false,
      nextHigherKg: null,
    });
  });

  it('finds an exact solution a greedy pass would miss', () => {
    // Greedy would take 25 and get stuck at 25 + nothing = 25 ≠ 30 per side.
    const odd: PlateSetup = {
      barKg: 20,
      stock: [
        { kg: 25, pairs: 1 },
        { kg: 15, pairs: 2 },
      ],
    };
    expect(solvePlates(80, odd)).toMatchObject({ totalKg: 80, exact: true, perSide: [15, 15] });
  });

  it('works with a different bar', () => {
    const short: PlateSetup = { ...rich, barKg: 10 };
    expect(solvePlates(50, short)).toMatchObject({ totalKg: 50, exact: true });
  });
});

describe('parsePlateSetup', () => {
  it('falls back to the default for anything unusable', () => {
    expect(parsePlateSetup(null)).toEqual(DEFAULT_PLATE_SETUP);
    expect(parsePlateSetup('{ not json')).toEqual(DEFAULT_PLATE_SETUP);
    expect(parsePlateSetup('[]')).toEqual(DEFAULT_PLATE_SETUP);
    expect(parsePlateSetup('{"barKg":"schwer","stock":[]}')).toEqual(DEFAULT_PLATE_SETUP);
    expect(parsePlateSetup('{"barKg":20,"stock":[]}')).toEqual(DEFAULT_PLATE_SETUP);
  });

  it('drops nonsense entries and sorts heaviest first', () => {
    const parsed = parsePlateSetup(
      '{"barKg":15,"stock":[{"kg":5,"pairs":2},{"kg":-1,"pairs":2},{"kg":20,"pairs":0},{"kg":25,"pairs":1}]}',
    );
    expect(parsed).toEqual({ barKg: 15, stock: [{ kg: 25, pairs: 1 }, { kg: 5, pairs: 2 }] });
  });

  it('round-trips a setup', () => {
    expect(parsePlateSetup(serializePlateSetup(DEFAULT_PLATE_SETUP))).toEqual(DEFAULT_PLATE_SETUP);
  });
});
