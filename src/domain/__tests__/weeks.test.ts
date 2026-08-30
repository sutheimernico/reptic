import {
  bucketByWeek,
  isoWeekKey,
  isoWeekLabel,
  isoWeekOf,
  lastIsoWeeks,
  rankMuscleGroups,
  startOfIsoWeek,
  startOfWeekWindow,
  type SessionMuscleTotals,
} from '@/domain/weeks';

/** Local-midnight date, so tests read as the calendar the user sees. */
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);

describe('startOfIsoWeek', () => {
  it('walks back to Monday', () => {
    // 2026-08-30 is a Sunday; its week starts Monday 2026-08-24.
    expect(startOfIsoWeek(at(2026, 8, 30)).getDate()).toBe(24);
    expect(startOfIsoWeek(at(2026, 8, 24)).getDate()).toBe(24); // Monday stays put
  });

  it('drops the time of day', () => {
    const start = startOfIsoWeek(at(2026, 8, 30, 23));
    expect([start.getHours(), start.getMinutes(), start.getSeconds()]).toEqual([0, 0, 0]);
  });
});

describe('isoWeekOf', () => {
  it('numbers ordinary weeks', () => {
    expect(isoWeekOf(at(2026, 1, 5))).toEqual({ year: 2026, week: 2 });
    expect(isoWeekOf(at(2026, 8, 30))).toEqual({ year: 2026, week: 35 });
  });

  it('assigns early January to the previous ISO year where it belongs', () => {
    // 2027-01-01 is a Friday, so it is still week 53 of 2026.
    expect(isoWeekOf(at(2027, 1, 1))).toEqual({ year: 2026, week: 53 });
  });

  it('assigns late December to the next ISO year where it belongs', () => {
    // 2024-12-30 is a Monday, already week 1 of 2025.
    expect(isoWeekOf(at(2024, 12, 30))).toEqual({ year: 2025, week: 1 });
  });

  it('keeps a Sunday evening in its own week, not the next one', () => {
    expect(isoWeekOf(at(2026, 8, 30, 23))).toEqual(isoWeekOf(at(2026, 8, 24, 6)));
  });
});

describe('isoWeekKey / isoWeekLabel', () => {
  it('formats sortably and readably', () => {
    expect(isoWeekKey({ year: 2026, week: 5 })).toBe('2026-W05');
    expect(isoWeekKey({ year: 2026, week: 35 })).toBe('2026-W35');
    expect(isoWeekLabel({ year: 2026, week: 35 })).toBe('KW 35');
  });

  it('sorts chronologically as plain strings', () => {
    const keys = [
      isoWeekKey({ year: 2026, week: 9 }),
      isoWeekKey({ year: 2025, week: 52 }),
      isoWeekKey({ year: 2026, week: 10 }),
    ].sort();
    expect(keys).toEqual(['2025-W52', '2026-W09', '2026-W10']);
  });
});

describe('lastIsoWeeks', () => {
  it('returns the window oldest first, ending with the current week', () => {
    const weeks = lastIsoWeeks(at(2026, 8, 30), 4);
    expect(weeks.map(isoWeekLabel)).toEqual(['KW 32', 'KW 33', 'KW 34', 'KW 35']);
  });

  it('crosses a year boundary correctly', () => {
    const weeks = lastIsoWeeks(at(2027, 1, 14), 3);
    expect(weeks.map(isoWeekKey)).toEqual(['2026-W53', '2027-W01', '2027-W02']);
  });
});

describe('startOfWeekWindow', () => {
  it('opens on the Monday that starts the oldest week of the window', () => {
    const start = startOfWeekWindow(at(2026, 8, 30), 12);
    expect(isoWeekKey(isoWeekOf(start))).toBe(isoWeekKey(lastIsoWeeks(at(2026, 8, 30), 12)[0]));
    expect(start.getDay()).toBe(1); // Monday
    expect([start.getHours(), start.getMinutes()]).toEqual([0, 0]);
  });

  it('is inclusive: a session at that exact moment is inside the window', () => {
    const now = at(2026, 8, 30);
    const start = startOfWeekWindow(now, 12);
    const weeks = bucketByWeek(
      [{ finishedAt: start.toISOString(), muscleGroup: 'Brust', volumeKg: 100, distanceKm: 0 }],
      now,
      12,
    );
    expect(weeks[0].volumeKg).toBe(100);
  });
});

describe('bucketByWeek', () => {
  const now = at(2026, 8, 30);
  const row = (over: Partial<SessionMuscleTotals>): SessionMuscleTotals => ({
    finishedAt: at(2026, 8, 25).toISOString(),
    muscleGroup: 'Brust',
    volumeKg: 0,
    distanceKm: 0,
    ...over,
  });

  it('produces one bucket per week, even when nothing was trained', () => {
    const weeks = bucketByWeek([], now, 12);
    expect(weeks).toHaveLength(12);
    expect(weeks.every((w) => w.volumeKg === 0 && w.distanceKm === 0)).toBe(true);
    expect(weeks[11].label).toBe('KW 35'); // newest last
  });

  it('sums volume into the right week and muscle group', () => {
    const weeks = bucketByWeek(
      [
        row({ volumeKg: 1000 }),
        row({ volumeKg: 500, muscleGroup: 'Rücken' }),
        row({ finishedAt: at(2026, 8, 18).toISOString(), volumeKg: 800 }),
      ],
      now,
      12,
    );
    const current = weeks[weeks.length - 1];
    expect(current.volumeKg).toBe(1500);
    expect(current.byMuscle).toEqual({ Brust: 1000, Rücken: 500 });
    expect(weeks[weeks.length - 2].volumeKg).toBe(800);
  });

  it('keeps cardio distance out of the volume', () => {
    const weeks = bucketByWeek(
      [row({ muscleGroup: 'Cardio', distanceKm: 12.5, volumeKg: 0 })],
      now,
      12,
    );
    const current = weeks[weeks.length - 1];
    expect(current.distanceKm).toBe(12.5);
    expect(current.volumeKg).toBe(0);
    expect(current.byMuscle).toEqual({}); // no volume, so no bar
  });

  it('ignores sessions older than the window instead of folding them into week one', () => {
    const weeks = bucketByWeek([row({ finishedAt: at(2025, 1, 1).toISOString(), volumeKg: 9999 })], now, 12);
    expect(weeks.reduce((sum, w) => sum + w.volumeKg, 0)).toBe(0);
  });

  it('skips an unparseable timestamp rather than throwing', () => {
    expect(() => bucketByWeek([row({ finishedAt: 'kaputt', volumeKg: 10 })], now, 12)).not.toThrow();
  });
});

describe('rankMuscleGroups', () => {
  it('ranks by total volume across the window', () => {
    const now = at(2026, 8, 30);
    const weeks = bucketByWeek(
      [
        { finishedAt: at(2026, 8, 25).toISOString(), muscleGroup: 'Brust', volumeKg: 1000, distanceKm: 0 },
        { finishedAt: at(2026, 8, 18).toISOString(), muscleGroup: 'Brust', volumeKg: 200, distanceKm: 0 },
        { finishedAt: at(2026, 8, 25).toISOString(), muscleGroup: 'Beine', volumeKg: 3000, distanceKm: 0 },
      ],
      now,
      12,
    );
    expect(rankMuscleGroups(weeks)).toEqual([
      { group: 'Beine', volumeKg: 3000 },
      { group: 'Brust', volumeKg: 1200 },
    ]);
  });
});
