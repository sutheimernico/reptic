import {
  countPersonalRecords,
  currentWeekProgress,
  levelFor,
  resolveWeekGoal,
  suggestGoalKg,
  suggestGoalKm,
  weekStreak,
  xpFor,
  type PrReplaySet,
} from '@/domain/week-stats';
import type { SessionMuscleTotals, WeekTotals } from '@/domain/weeks';

const local = (y: number, m0: number, d: number, h = 12, min = 0) =>
  new Date(y, m0, d, h, min).toISOString();

const row = (finishedAt: string, volumeKg: number, distanceKm = 0): SessionMuscleTotals => ({
  finishedAt,
  muscleGroup: 'Brust',
  volumeKg,
  distanceKm,
});

const week = (volumeKg: number, distanceKm = 0): WeekTotals => ({
  key: 'k',
  label: 'l',
  week: { year: 2026, week: 1 },
  volumeKg,
  distanceKm,
  byMuscle: {},
});

describe('currentWeekProgress', () => {
  it('counts Sunday 23:30 for that week and Monday 00:10 as a fresh week', () => {
    const rows = [row(local(2026, 9, 18, 23, 30), 1000)];
    const sunday = currentWeekProgress(rows, new Date(2026, 9, 18, 23, 45));
    expect(sunday).toMatchObject({ weekKey: '2026-W42', volumeKg: 1000, sessions: 1 });
    const monday = currentWeekProgress(rows, new Date(2026, 9, 19, 0, 10));
    expect(monday).toMatchObject({ weekKey: '2026-W43', volumeKg: 0, distanceKm: 0, sessions: 0 });
  });

  it('counts a session once however many muscle groups it touched', () => {
    const at = local(2026, 9, 19, 9);
    const p = currentWeekProgress([row(at, 500), row(at, 300, 2)], new Date(2026, 9, 19, 10));
    expect(p).toMatchObject({ volumeKg: 800, distanceKm: 2, sessions: 1 });
  });
});

describe('weekStreak', () => {
  const w41 = local(2026, 9, 7);
  const w42 = local(2026, 9, 14);
  const monday = new Date(2026, 9, 19, 9);

  it('keeps last week\'s run alive on a Monday without a session yet', () => {
    expect(weekStreak([w41, w42], monday)).toBe(2);
  });
  it('adds the current week once it has a session', () => {
    expect(weekStreak([w41, w42, local(2026, 9, 19, 8)], monday)).toBe(3);
  });
  it('resets on a gap week', () => {
    expect(weekStreak([local(2026, 9, 1), w42], monday)).toBe(1);
    expect(weekStreak([local(2026, 9, 1)], monday)).toBe(0);
  });
  it('is 0 without sessions', () => {
    expect(weekStreak([], monday)).toBe(0);
  });
});

describe('goal suggestion', () => {
  it('suggests the median of the last weeks with volume, rounded up to 500', () => {
    const weeks = [0, 8200, 9100, 0, 12000, 7600].map((v) => week(v));
    expect(suggestGoalKg(weeks)).toBe(9500);
  });
  it('falls back to 10000', () => {
    expect(suggestGoalKg([])).toBe(10000);
    expect(suggestGoalKg([week(0), week(5000)])).toBe(10000);
  });
  it('suggests km only when distance ever existed', () => {
    expect(suggestGoalKm([week(1, 0), week(1, 0)])).toBeNull();
    expect(suggestGoalKm([week(0, 3.2), week(0, 5), week(0, 0)])).toBe(5);
    expect(suggestGoalKm([week(0, 0), week(0, 4)])).toBe(10);
  });
});

describe('resolveWeekGoal', () => {
  const weeks = [8200, 9100, 12000, 0].map((v) => week(v));
  it('prefers a valid stored goal', () => {
    expect(resolveWeekGoal('20000', null, weeks)).toMatchObject({
      kg: 20000,
      kgIsSuggestion: false,
      kmIsSuggestion: true,
    });
  });
  it('suggests when nothing or garbage is stored', () => {
    expect(resolveWeekGoal(null, null, weeks)).toMatchObject({ kg: 9500, kgIsSuggestion: true });
    expect(resolveWeekGoal('abc', '0', weeks)).toMatchObject({ kg: 9500, kgIsSuggestion: true });
  });
  it('honours a stored km goal', () => {
    expect(resolveWeekGoal(null, '12.5', weeks)).toMatchObject({ km: 12.5, kmIsSuggestion: false });
  });
});

describe('xp and level', () => {
  it('weights sets and records', () => {
    expect(xpFor(3, 2)).toBe(130);
    expect(xpFor(0, 0)).toBe(0);
  });
  it('derives levels from cumulative XP', () => {
    expect(levelFor(0).level).toBe(1);
    expect(levelFor(99).level).toBe(1);
    expect(levelFor(100).level).toBe(2);
    expect(levelFor(282).level).toBe(2);
    expect(levelFor(283)).toEqual({ level: 3, xpIntoLevel: 0, xpForNext: 237 });
    expect(levelFor(300)).toEqual({ level: 3, xpIntoLevel: 17, xpForNext: 237 });
  });
});

describe('countPersonalRecords', () => {
  const set = (workoutId: number, weightKg: number, reps = 5, exerciseId = 1): PrReplaySet => ({
    workoutId,
    exerciseId,
    weightKg,
    reps,
    distanceKm: null,
    durationSec: null,
  });

  it('stays silent until three prior sessions, like the live badge', () => {
    expect(countPersonalRecords([set(1, 50), set(2, 60), set(3, 70)])).toBe(0);
  });
  it('counts a set that beats everything before, including earlier sets of its session', () => {
    const sets = [set(1, 50), set(2, 50), set(3, 50), set(4, 60), set(4, 60), set(4, 65)];
    // 60 beats 50 (record); second 60 ties; 65 beats 60 (record)
    expect(countPersonalRecords(sets)).toBe(2);
  });
  it('tracks exercises independently', () => {
    const sets = [set(1, 50), set(2, 50), set(3, 50), set(4, 60, 5, 2)];
    expect(countPersonalRecords(sets)).toBe(0);
  });
});
