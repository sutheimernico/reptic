import { moveBy } from '@/domain/ordering';

describe('moveBy', () => {
  it('moves an item up by one', () => {
    expect(moveBy([1, 2, 3], 2, -1)).toEqual([1, 3, 2]);
  });

  it('moves an item down by one', () => {
    expect(moveBy([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
  });

  it('clamps a move past the top to a no-op', () => {
    expect(moveBy([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
  });

  it('clamps a move past the bottom to a no-op', () => {
    expect(moveBy([1, 2, 3], 2, 1)).toEqual([1, 2, 3]);
  });

  it('ignores an out-of-range index', () => {
    expect(moveBy([1, 2, 3], 5, -1)).toEqual([1, 2, 3]);
  });

  it('does not mutate the input', () => {
    const input = [1, 2, 3];
    moveBy(input, 0, 1);
    expect(input).toEqual([1, 2, 3]);
  });

  it('supports multi-step moves', () => {
    expect(moveBy(['a', 'b', 'c', 'd'], 3, -2)).toEqual(['a', 'd', 'b', 'c']);
  });
});
