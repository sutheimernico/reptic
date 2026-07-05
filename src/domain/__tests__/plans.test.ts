import { mergePlanExercises } from '@/domain/plans';

describe('mergePlanExercises', () => {
  it('concatenates plans in order', () => {
    expect(
      mergePlanExercises([
        { planId: 1, exerciseIds: [10, 11] },
        { planId: 2, exerciseIds: [20, 21] },
      ]),
    ).toEqual([10, 11, 20, 21]);
  });

  it('de-duplicates, keeping the earliest position', () => {
    expect(
      mergePlanExercises([
        { planId: 1, exerciseIds: [10, 11, 12] },
        { planId: 2, exerciseIds: [12, 11, 30] },
      ]),
    ).toEqual([10, 11, 12, 30]);
  });

  it('handles an empty selection', () => {
    expect(mergePlanExercises([])).toEqual([]);
  });
});
