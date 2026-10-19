import { staggerDelay, springFor, timingFor } from '../motion';
import { resolveTheme } from '../themes';

const A = resolveTheme('evolved', 'light', 'light');
const D = resolveTheme('arcade', 'light', 'light');
const E = resolveTheme('instrument', 'dark', 'dark');

describe('motion helpers', () => {
  it('starts the first item immediately and caps the stagger at 8 items', () => {
    expect(staggerDelay(0, A)).toBe(0);
    expect(staggerDelay(20, A)).toBe(staggerDelay(8, A));
    expect(staggerDelay(8, A)).toBe(8 * A.motion.durationMs.fast);
  });

  it('uses the theme duration, linear for instrument', () => {
    expect(timingFor(E, 'base').duration).toBe(180);
    expect(timingFor(A, 'base').duration).toBe(220);
  });

  it('gives arcade a bouncier spring than evolved', () => {
    expect(springFor(D).damping).toBeLessThan(springFor(A).damping as number);
  });
});
