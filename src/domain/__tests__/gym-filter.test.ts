import { applyGymFilter, gymFilterKey, parseGymFilter, toggleGym } from '@/domain/gym-filter';

describe('gym filter', () => {
  it('keys the setting per exercise', () => {
    expect(gymFilterKey(7)).toBe('progress_gyms_7');
  });

  it('parses stored values against the available gyms', () => {
    expect(parseGymFilter(null, [3])).toBe('all');
    expect(parseGymFilter('[3,9]', [3])).toEqual([3]);
    expect(parseGymFilter('[9]', [3])).toBe('all');
    expect(parseGymFilter('garbage', [3])).toBe('all');
    expect(parseGymFilter('{"a":1}', [3])).toBe('all');
  });

  it('toggles chips with all/individual exclusive', () => {
    expect(toggleGym('all', 3)).toEqual([3]);
    expect(toggleGym([3], 3)).toBe('all');
    expect(toggleGym([3], 'all')).toBe('all');
    expect(toggleGym([3], 5)).toEqual([3, 5]);
    expect(toggleGym([3, 5], 3)).toEqual([5]);
    expect(toggleGym('all', 'all')).toBe('all');
  });

  it('applies the filter to points', () => {
    const pts = [{ gymId: 1 }, { gymId: 2 }, { gymId: null }];
    expect(applyGymFilter(pts, 'all')).toHaveLength(3);
    expect(applyGymFilter(pts, [2])).toEqual([{ gymId: 2 }]);
  });
});
