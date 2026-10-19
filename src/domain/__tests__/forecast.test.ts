import type { ExerciseHistoryEntry } from '@/db/workouts';
import {
  fitForecast,
  MIN_FORECAST_SESSIONS,
  strengthSeries,
  type StrengthPoint,
} from '@/domain/forecast';

function points(days: number[], values: number[]): StrengthPoint[] {
  return days.map((d, i) => ({
    date: `d${d}`,
    dayIndex: d,
    e1rm: values[i],
    gymId: null,
    workoutId: i + 1,
  }));
}

/** Deterministic noise in [-1, 1) — no Math.random in tests. */
function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return (s / 4294967296) * 2 - 1;
  };
}

const curve = (t: number) => 120 - (120 - 80) * Math.exp(-t / 60);
const DAYS12 = Array.from({ length: 12 }, (_, i) => i * 12);
const DAYS10 = Array.from({ length: 10 }, (_, i) => Math.round((i * 120) / 9));

function allFinite(f: ReturnType<typeof fitForecast>): boolean {
  if (f.kind !== 'fit') return true;
  const nums = [f.k, f.y0, f.sigma, f.gainPerMonthKg, f.plateauKg ?? 0];
  for (const c of f.curve) nums.push(c.dayIndex, c.value, c.low, c.high);
  return nums.every(Number.isFinite);
}

describe('fitForecast', () => {
  it('recovers the plateau of an exact saturating curve', () => {
    const f = fitForecast(points(DAYS10, DAYS10.map(curve)));
    expect(f.kind).toBe('fit');
    if (f.kind !== 'fit') return;
    expect(f.plateauKg).not.toBeNull();
    expect(Math.abs((f.plateauKg as number) - 120)).toBeLessThanOrEqual(2);
    expect(Math.abs(f.k - 1 / 60) / (1 / 60)).toBeLessThan(0.3);
    expect(f.curve.length).toBeGreaterThan(0);
  });

  it('stays within 6 kg of the plateau under +-1.5 kg noise', () => {
    const rnd = lcg(42);
    const f = fitForecast(
      points(
        DAYS10,
        DAYS10.map((d) => curve(d) + rnd() * 1.5),
      ),
    );
    expect(f.kind).toBe('fit');
    if (f.kind !== 'fit') return;
    expect(f.plateauKg).not.toBeNull();
    expect(Math.abs((f.plateauKg as number) - 120)).toBeLessThanOrEqual(6);
    expect(allFinite(f)).toBe(true);
  });

  it('reports no plateau for linear growth but still draws a curve', () => {
    const f = fitForecast(
      points(
        DAYS10,
        DAYS10.map((d) => 80 + (24 * d) / 120),
      ),
    );
    expect(f.kind).toBe('fit');
    if (f.kind !== 'fit') return;
    expect(f.plateauKg).toBeNull();
    expect(f.curve.length).toBeGreaterThan(0);
    expect(f.gainPerMonthKg).toBeGreaterThan(0);
    expect(allFinite(f)).toBe(true);
  });

  it('is insufficient below the session minimum', () => {
    const d = [0, 20, 40, 60, 80];
    expect(fitForecast(points(d, [80, 82, 84, 85, 86]))).toEqual({
      kind: 'insufficient',
      sessions: 5,
    });
  });

  it('is insufficient when the span is too short', () => {
    const d = [0, 3, 6, 9, 12, 15, 17, 20];
    expect(MIN_FORECAST_SESSIONS).toBeLessThanOrEqual(d.length);
    expect(fitForecast(points(d, [80, 81, 82, 82, 83, 84, 84, 85]))).toEqual({
      kind: 'insufficient',
      sessions: 8,
    });
  });

  it('handles flat data without NaN', () => {
    const f = fitForecast(
      points(
        DAYS10,
        DAYS10.map(() => 100),
      ),
    );
    expect(f.kind).toBe('fit');
    if (f.kind !== 'fit') return;
    expect(f.plateauKg).not.toBeNull();
    expect(Math.abs((f.plateauKg as number) - 100)).toBeLessThan(1);
    expect(Math.abs(f.gainPerMonthKg)).toBeLessThan(0.5);
    expect(allFinite(f)).toBe(true);
  });

  it('survives an outlier and widens sigma', () => {
    const base = [100, 101, 99, 100, 102, 100, 99, 101, 100, 100];
    const clean = fitForecast(points(DAYS10, base));
    const spiked = fitForecast(
      points(
        DAYS10,
        base.map((v, i) => (i === 5 ? 140 : v)),
      ),
    );
    expect(allFinite(spiked)).toBe(true);
    if (clean.kind !== 'fit' || spiked.kind !== 'fit') throw new Error('expected fits');
    expect(spiked.sigma).toBeGreaterThan(clean.sigma);
  });

  it('classifies a noisy plateau as plateau', () => {
    const f = fitForecast(
      points(DAYS12.slice(0, 10), [100, 101, 99, 100, 102, 100, 99, 101, 100, 100]),
    );
    if (f.kind !== 'fit') throw new Error('expected fit');
    expect(f.status).toBe('plateau');
    expect(Math.abs((f.plateauKg as number) - 100)).toBeLessThanOrEqual(1.5);
    expect(f.gainPerMonthKg).toBe(0);
    expect(f.curve.length).toBeGreaterThan(0);
  });

  it('classifies a steady decline as declining without a curve', () => {
    const f = fitForecast(
      points(
        DAYS10,
        DAYS10.map((d) => 100 - (20 * d) / 120),
      ),
    );
    if (f.kind !== 'fit') throw new Error('expected fit');
    expect(f.status).toBe('declining');
    expect(f.gainPerMonthKg).toBeCloseTo(-5.0, 1);
    expect(f.curve).toEqual([]);
    expect(f.plateauKg).toBeNull();
  });

  it('flags the last two points as unreliable when they sit far above a smooth rise', () => {
    const d = Array.from({ length: 16 }, (_, i) => i * 10);
    const y = d.map((x) => 80 + 0.2 * x);
    y[14] += 8;
    y[15] += 8;
    const f = fitForecast(points(d, y));
    if (f.kind !== 'fit') throw new Error('expected fit');
    expect(f.status).toBe('unreliable');
    expect(f.curve).toEqual([]);
    expect(f.plateauKg).toBeNull();
  });

  it('does not call a rise-then-break rising', () => {
    const f = fitForecast(
      points(DAYS12.slice(0, 10), [100, 101, 99, 100, 102, 100, 104, 107, 95, 92]),
    );
    const g = fitForecast(points(DAYS12, [100, 101, 99, 100, 102, 100, 104, 107, 95, 92, 90, 90]));
    for (const r of [f, g]) {
      if (r.kind !== 'fit') throw new Error('expected fit');
      expect(r.status).not.toBe('rising');
      expect(r.gainPerMonthKg).not.toBeGreaterThan(0);
    }
  });

  it('does not extrapolate gain from a single outlier', () => {
    const f = fitForecast(points(DAYS10, [100, 101, 99, 100, 102, 140, 99, 101, 100, 100]));
    if (f.kind !== 'fit') throw new Error('expected fit');
    expect(f.status === 'rising' && f.gainPerMonthKg > 0.5).toBe(false);
  });

  it('exact curve gain per month matches the model derivative', () => {
    const f = fitForecast(points(DAYS10, DAYS10.map(curve)));
    if (f.kind !== 'fit') throw new Error('expected fit');
    expect(f.status).toBe('rising');
    expect(Math.abs(f.gainPerMonthKg - 2.7)).toBeLessThan(0.5);
  });

  it('widens the band to sigma * (1 + 0.5 * horizon / span) at the last curve point', () => {
    const rnd = lcg(7);
    const f = fitForecast(
      points(
        DAYS10,
        DAYS10.map((d) => curve(d) + rnd() * 1.5),
      ),
    );
    if (f.kind !== 'fit') throw new Error('expected fit');
    expect(f.sigma).toBeGreaterThan(0);
    const last = f.curve[f.curve.length - 1];
    expect((last.high - last.low) / 2).toBeCloseTo(f.sigma * (1 + (0.5 * 84) / 120), 6);
  });

  it('clamps P to the observed max when the free fit would undershoot it', () => {
    // Exact curve toward 100 (k = 1/40) whose last session overshoots to 101.
    const d = [0, 10, 20, 30, 40, 50, 60, 70, 80];
    const y = d.map((x) => 100 - 30 * Math.exp(-x / 40));
    y[8] = 101;
    const f = fitForecast(points(d, y));
    if (f.kind !== 'fit') throw new Error('expected fit');
    expect(f.status).toBe('rising');
    expect(f.plateauKg).not.toBeNull();
    expect(f.plateauKg as number).toBeGreaterThanOrEqual(101 - 1e-9);
  });

  it('fits at exactly 6 sessions and exactly 28 days', () => {
    const f = fitForecast(points([0, 5, 10, 15, 20, 28], [80, 82, 84, 85, 86, 87]));
    expect(f.kind).toBe('fit');
  });

  it('starts the curve at the last point and ends at the horizon', () => {
    const f = fitForecast(points(DAYS10, DAYS10.map(curve)));
    if (f.kind !== 'fit') throw new Error('expected fit');
    expect(f.curve[0].dayIndex).toBe(120);
    expect(f.curve[f.curve.length - 1].dayIndex).toBe(120 + 84);
  });
});

function entry(
  workoutId: number,
  date: string,
  sets: { weightKg: number | null; reps: number | null }[],
  gymId: number | null = 1,
): ExerciseHistoryEntry {
  return {
    workoutId,
    date,
    gymName: 'Gym',
    gymId,
    sets: sets.map((s, i) => ({
      setNumber: i + 1,
      ...s,
      distanceKm: null,
      durationSec: null,
      level: null,
    })),
  };
}

describe('strengthSeries', () => {
  it('takes the session max, ignores reps > 12 and zero weight, sorts ascending', () => {
    const series = strengthSeries([
      entry(2, '2026-08-08T12:00:00', [
        { weightKg: 100, reps: 5 },
        { weightKg: 60, reps: 15 }, // too many reps
        { weightKg: 0, reps: 10 }, // no load
      ]),
      entry(1, '2026-08-01T12:00:00', [
        { weightKg: 80, reps: 10 },
        { weightKg: 90, reps: 3 },
      ]),
      entry(3, '2026-08-10T12:00:00', [{ weightKg: 50, reps: 20 }]), // no usable set
    ]);
    expect(series.map((p) => p.workoutId)).toEqual([1, 2]);
    expect(series[0].e1rm).toBeCloseTo(Math.max(80 * (1 + 10 / 30), 90 * (1 + 3 / 30)));
    expect(series[1].e1rm).toBeCloseTo(100 * (1 + 5 / 30));
    expect(series[0].dayIndex).toBe(0);
    expect(series[1].dayIndex).toBe(7);
    expect(series[0].gymId).toBe(1);
  });

  it('returns an empty series for no history', () => {
    expect(strengthSeries([])).toEqual([]);
  });
});
