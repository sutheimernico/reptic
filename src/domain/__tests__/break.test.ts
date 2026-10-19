import { breakFactor, daysBetween, lowerWeight } from '@/domain/break';
import { DEFAULT_PLATE_SETUP, solvePlates } from '@/domain/plates';

describe('breakFactor', () => {
  it('has no suggestion without a previous session or under 14 days', () => {
    expect(breakFactor(null)).toBeNull();
    expect(breakFactor(0)).toBeNull();
    expect(breakFactor(13)).toBeNull();
  });
  it('suggests 10 % from 14 days and 15 % from 56 days', () => {
    expect(breakFactor(14)).toBe(0.9);
    expect(breakFactor(55)).toBe(0.9);
    expect(breakFactor(56)).toBe(0.85);
  });
});

describe('lowerWeight', () => {
  it('rounds machine weights down to the increment', () => {
    expect(lowerWeight(82.5, 0.9, 2.5, null)).toBe(72.5);
  });
  it('lands on a loadable barbell weight when the old weight was loadable', () => {
    const kg = lowerWeight(100, 0.9, 2.5, DEFAULT_PLATE_SETUP);
    expect(kg).not.toBeNull();
    expect(kg as number).toBeLessThanOrEqual(90);
    expect(solvePlates(kg as number, DEFAULT_PLATE_SETUP)?.exact).toBe(true);
  });
  it('leaves empty and zero weights alone', () => {
    expect(lowerWeight(null, 0.9, 2.5, null)).toBeNull();
    expect(lowerWeight(0, 0.9, 2.5, null)).toBe(0);
  });
  it('never goes negative', () => {
    expect(lowerWeight(2, 0.9, 2.5, null)).toBe(0);
    expect(lowerWeight(2, 0.9, 2.5, DEFAULT_PLATE_SETUP)).toBe(0);
  });
});

describe('daysBetween', () => {
  it('counts local calendar days, not 24 h blocks', () => {
    const last = new Date(2026, 2, 20, 23, 30).toISOString();
    expect(daysBetween(last, new Date(2026, 3, 3, 0, 10))).toBe(14);
  });
  it('is 0 on the same day', () => {
    const last = new Date(2026, 9, 19, 7, 0).toISOString();
    expect(daysBetween(last, new Date(2026, 9, 19, 22, 0))).toBe(0);
  });
});
