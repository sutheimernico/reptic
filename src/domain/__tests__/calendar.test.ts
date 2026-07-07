import { buildMonthGrid, localDayOf, monthTitle, shiftMonth } from '@/domain/calendar';

describe('buildMonthGrid', () => {
  it('starts weeks on Monday and pads leading blanks (Feb 2024, leap year)', () => {
    // 2024-02-01 is a Thursday → 3 leading blanks, 29 days, 5 weeks
    const weeks = buildMonthGrid(2024, 1);
    expect(weeks).toHaveLength(5);
    expect(weeks[0].map((c) => c.day)).toEqual([null, null, null, 1, 2, 3, 4]);
    expect(weeks[4].map((c) => c.day)).toEqual([26, 27, 28, 29, null, null, null]);
  });

  it('has no leading blanks when the month starts on Monday (Jun 2026)', () => {
    const weeks = buildMonthGrid(2026, 5);
    expect(weeks[0].map((c) => c.day)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(weeks).toHaveLength(5);
  });

  it('pads six blanks when the month starts on Sunday (Nov 2026)', () => {
    const weeks = buildMonthGrid(2026, 10);
    expect(weeks[0].map((c) => c.day)).toEqual([null, null, null, null, null, null, 1]);
    expect(weeks).toHaveLength(6);
  });

  it('gives every cell a unique key', () => {
    const keys = buildMonthGrid(2024, 1)
      .flat()
      .map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('shiftMonth', () => {
  it('wraps backwards over the year boundary', () => {
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month0: 11 });
  });

  it('wraps forwards over the year boundary', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month0: 0 });
  });

  it('shifts within the year', () => {
    expect(shiftMonth(2026, 6, -1)).toEqual({ year: 2026, month0: 5 });
  });
});

describe('monthTitle', () => {
  it('renders German month name and year', () => {
    expect(monthTitle(2026, 6)).toBe('Juli 2026');
  });
});

describe('localDayOf', () => {
  it('returns the day of month in local time', () => {
    // Noon local time is stable across timezones up to ±12h
    const iso = new Date(2026, 6, 6, 12, 0, 0).toISOString();
    expect(localDayOf(iso)).toBe(6);
  });
});
