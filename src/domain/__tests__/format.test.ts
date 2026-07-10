import {
  formatCardioReference,
  formatCardioSetSummary,
  formatDuration,
  formatReference,
  formatSessionDate,
  formatSetSummary,
  formatVolume,
  formatWeight,
  parseDuration,
  parseReps,
  parseWeight,
  plural,
} from '@/domain/format';

describe('parseWeight', () => {
  it('parses dot and comma decimals', () => {
    expect(parseWeight('82.5')).toBe(82.5);
    expect(parseWeight('82,5')).toBe(82.5);
    expect(parseWeight('0')).toBe(0);
  });

  it('returns null for empty, non-numeric and negative input', () => {
    expect(parseWeight('')).toBeNull();
    expect(parseWeight('abc')).toBeNull();
    expect(parseWeight('-5')).toBeNull();
  });
});

describe('parseReps', () => {
  it('parses whole numbers', () => {
    expect(parseReps('8')).toBe(8);
    expect(parseReps('0')).toBe(0);
  });

  it('returns null for empty, non-numeric and negative input', () => {
    expect(parseReps('')).toBeNull();
    expect(parseReps('x')).toBeNull();
    expect(parseReps('-3')).toBeNull();
  });
});

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

describe('parseDuration', () => {
  it('parses mm:ss', () => {
    expect(parseDuration('32:30')).toBe(1950);
    expect(parseDuration('0:45')).toBe(45);
  });

  it('parses bare minutes (dot or comma)', () => {
    expect(parseDuration('32')).toBe(1920);
    expect(parseDuration('32,5')).toBe(1950);
  });

  it('returns null for empty, negative or invalid seconds', () => {
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('-5')).toBeNull();
    expect(parseDuration('1:75')).toBeNull(); // seconds must be < 60
    expect(parseDuration('abc')).toBeNull();
  });
});

describe('formatDuration', () => {
  it('renders m:ss with zero-padded seconds', () => {
    expect(formatDuration(1950)).toBe('32:30');
    expect(formatDuration(45)).toBe('0:45');
    expect(formatDuration(0)).toBe('0:00');
  });

  it('returns empty string for null', () => {
    expect(formatDuration(null)).toBe('');
  });
});

describe('formatCardioReference', () => {
  it('joins the set parts', () => {
    expect(formatCardioReference(5, 1950, 8)).toBe('5 km · 32:30 · Stufe 8');
    expect(formatCardioReference(5, 1950, null)).toBe('5 km · 32:30');
    expect(formatCardioReference(null, 1200, null)).toBe('20:00');
  });

  it('returns null when nothing is set', () => {
    expect(formatCardioReference(null, null, null)).toBeNull();
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

describe('formatCardioSetSummary', () => {
  it('renders one segment per set with values', () => {
    expect(formatCardioSetSummary([{ distanceKm: 5, durationSec: 1950, level: 8 }])).toBe(
      '5 km · 32:30 · Stufe 8',
    );
    expect(
      formatCardioSetSummary([
        { distanceKm: 5, durationSec: 1950, level: 8 },
        { distanceKm: 3, durationSec: null, level: null },
      ]),
    ).toBe('5 km · 32:30 · Stufe 8 — 3 km');
  });

  it('skips value-less sets and returns empty for none', () => {
    expect(formatCardioSetSummary([{ distanceKm: null, durationSec: null, level: null }])).toBe('');
    expect(formatCardioSetSummary([])).toBe('');
  });
});

describe('plural', () => {
  it('picks the singular form only for exactly 1', () => {
    expect(plural(1, 'Übung', 'Übungen')).toBe('1 Übung');
    expect(plural(3, 'Satz', 'Sätze')).toBe('3 Sätze');
    expect(plural(0, 'Satz', 'Sätze')).toBe('0 Sätze');
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
