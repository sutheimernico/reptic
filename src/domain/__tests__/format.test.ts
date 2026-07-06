import {
  formatReference,
  formatSessionDate,
  formatSetSummary,
  formatVolume,
  formatWeight,
} from '@/domain/format';

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

describe('formatSessionDate', () => {
  it('renders weekday, day, month and year in German', () => {
    // Build from a local noon date so the ISO round-trip never crosses a day
    // boundary in any time zone; 2026-07-05 is a Sunday.
    const local = new Date(2026, 6, 5, 12, 0, 0);
    expect(formatSessionDate(local.toISOString())).toBe('So, 5. Juli 2026');
  });

  it('returns empty string for an unparseable input', () => {
    expect(formatSessionDate('not-a-date')).toBe('');
  });
});

describe('formatVolume', () => {
  it('rounds and groups thousands with a dot', () => {
    expect(formatVolume(0)).toBe('0 kg');
    expect(formatVolume(950)).toBe('950 kg');
    expect(formatVolume(4180)).toBe('4.180 kg');
    expect(formatVolume(1234567)).toBe('1.234.567 kg');
    expect(formatVolume(4179.6)).toBe('4.180 kg');
  });
});
