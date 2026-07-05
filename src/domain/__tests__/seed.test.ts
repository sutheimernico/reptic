import { EXAMPLE_PLANS, EXERCISE_LIBRARY } from '@/domain/seed';
import { MUSCLE_GROUPS } from '@/domain/types';

describe('seed exercise library', () => {
  it('has unique exercise names', () => {
    const names = EXERCISE_LIBRARY.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('only uses known muscle groups', () => {
    for (const exercise of EXERCISE_LIBRARY) {
      expect(MUSCLE_GROUPS).toContain(exercise.muscleGroup);
    }
  });
});

describe('seed example plans', () => {
  it('reference only exercises that exist in the library', () => {
    const known = new Set(EXERCISE_LIBRARY.map((e) => e.name));
    for (const plan of EXAMPLE_PLANS) {
      for (const name of plan.exerciseNames) {
        expect(known.has(name)).toBe(true);
      }
    }
  });

  it('have non-empty, uniquely-named plans', () => {
    const names = EXAMPLE_PLANS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
    for (const plan of EXAMPLE_PLANS) {
      expect(plan.exerciseNames.length).toBeGreaterThan(0);
    }
  });
});
