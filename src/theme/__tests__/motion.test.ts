import { REVEAL_CAP_MS, revealMs, STAGGER_BUDGET_MS, staggerDelay, springFor, timingFor } from '../motion';
import { resolveTheme } from '../themes';

const A = resolveTheme('evolved', 'light', 'light');
const D = resolveTheme('arcade', 'light', 'light');
const E = resolveTheme('instrument', 'dark', 'dark');

describe('motion helpers', () => {
  it('starts the first item immediately and caps the stagger at 8 items', () => {
    expect(staggerDelay(0, A)).toBe(0);
    expect(staggerDelay(20, A)).toBe(staggerDelay(8, A));
  });

  it('steps the stagger by the theme fast duration while that stays under budget', () => {
    // instrument: fast 90 ms would be 720 ms over 8 rows, so it is the budget that rules there ...
    expect(staggerDelay(1, E)).toBe(STAGGER_BUDGET_MS / 8);
    // ... a hypothetical theme with a fast pace under the budget keeps its own step exactly.
    const quick = { ...A, motion: { ...A.motion, durationMs: { ...A.motion.durationMs, fast: 10 } } };
    expect(staggerDelay(1, quick)).toBe(10);
    expect(staggerDelay(3, quick)).toBe(30);
  });

  it('caps reveals at one second', () => {
    const warm = resolveTheme('warm', 'light', 'light');
    expect(revealMs(warm, 3)).toBe(REVEAL_CAP_MS);
    expect(revealMs(E, 2)).toBe(E.motion.durationMs.slow * 2);
  });

  it('keeps the whole stagger inside the budget for every theme', () => {
    for (const variant of ['evolved', 'warm', 'arcade', 'instrument'] as const) {
      const theme = resolveTheme(variant, 'light', 'light');
      expect(staggerDelay(8, theme)).toBeLessThanOrEqual(STAGGER_BUDGET_MS);
      expect(staggerDelay(8, theme)).toBeGreaterThan(staggerDelay(1, theme));
    }
  });

  it('uses the theme duration, linear for instrument', () => {
    expect(timingFor(E, 'base').duration).toBe(180);
    expect(timingFor(A, 'base').duration).toBe(220);
  });

  it('gives arcade a bouncier spring than evolved', () => {
    expect(springFor(D).damping).toBeLessThan(springFor(A).damping as number);
  });
});
