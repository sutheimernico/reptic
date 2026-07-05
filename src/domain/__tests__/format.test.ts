import { formatReference, formatSetSummary, formatWeight } from '@/domain/format';

describe('formatWeight', () => {
  it('drops trailing zeros and keeps useful decimals', () => {
    expect(formatWeight(80)).toBe('80');
    expect(formatWeight(80.0)).toBe('80');
    expect(formatWeight(82.5)).toBe('82.5');
    expect(formatWeight(82.25)).toBe('82.25');
  });

  it('returns empty string for null', () => {
    expect(formatWeight(null)).toBe('');
  });
});

describe('formatReference', () => {
  it('renders weight × reps', () => {
    expect(formatReference(80, 8)).toBe('80 kg × 8');
    expect(formatReference(82.5, 6)).toBe('82.5 kg × 6');
  });

  it('returns null when either value is missing', () => {
    expect(formatReference(null, 8)).toBeNull();
    expect(formatReference(80, null)).toBeNull();
  });
});

describe('formatSetSummary', () => {
  it('groups consecutive sets of equal weight', () => {
    expect(
      formatSetSummary([
        { weightKg: 80, reps: 8 },
        { weightKg: 80, reps: 8 },
        { weightKg: 80, reps: 7 },
      ]),
    ).toBe('80 kg × 8, 8, 7');
  });

  it('splits groups when the weight changes', () => {
    expect(
      formatSetSummary([
        { weightKg: 80, reps: 8 },
        { weightKg: 82.5, reps: 6 },
      ]),
    ).toBe('80 kg × 8 · 82.5 kg × 6');
  });

  it('ignores unfinished sets and returns empty for none', () => {
    expect(formatSetSummary([{ weightKg: null, reps: null }])).toBe('');
    expect(formatSetSummary([])).toBe('');
  });
});
