import type { ExerciseHistoryEntry } from '@/db/workouts';
import { epleyE1rm } from '@/domain/personal-records';

export interface StrengthPoint {
  date: string;
  /** Whole local calendar days since the first point. */
  dayIndex: number;
  e1rm: number;
  gymId: number | null;
  workoutId: number;
}

export const MIN_FORECAST_SESSIONS = 6;
export const MIN_FORECAST_SPAN_DAYS = 28;
export const FORECAST_HORIZON_DAYS = 84;

export interface ForecastPoint {
  dayIndex: number;
  value: number;
  low: number;
  high: number;
}

export type ForecastStatus = 'rising' | 'plateau' | 'declining' | 'unreliable';

/**
 * `declining` and `unreliable` carry no curve and no plateau.
 * Otherwise `plateauKg === null` means "no plateau recognisable yet". */
export type Forecast =
  | { kind: 'insufficient'; sessions: number }
  | {
      kind: 'fit';
      status: ForecastStatus;
      plateauKg: number | null;
      k: number;
      y0: number;
      sigma: number;
      gainPerMonthKg: number;
      curve: ForecastPoint[];
    };

const K_MIN = 1 / 1000;
const K_MAX = 1 / 7;
const K_STEPS = 60;
const CURVE_STEP_DAYS = 7;
const PLATEAU_MAX_RATIO = 1.5;
// SSE ties (e.g. perfectly flat data fits every k) go to the larger k: "already saturated".
const SSE_TIE = 1e-9;

const RECENT_WINDOW_DAYS = 42;
const RECENT_MIN_POINTS = 3;
const MIN_SIGMA_KG = 0.5; // exact data has sigma 0; thresholds must still mean something

const DAY_MS = 86_400_000;

/** Local calendar day number; avoids the 23/25 h days around DST that raw ms / 86400000 hits. */
function localDayNumber(iso: string): number {
  const d = new Date(iso);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
}

/** Best estimated 1RM per finished session, oldest first. Sessions without a usable set are dropped. */
export function strengthSeries(entries: ExerciseHistoryEntry[]): StrengthPoint[] {
  const raw: {
    date: string;
    day: number;
    e1rm: number;
    gymId: number | null;
    workoutId: number;
  }[] = [];
  for (const entry of entries) {
    let best: number | null = null;
    for (const s of entry.sets) {
      const v = epleyE1rm(s.weightKg, s.reps);
      if (v !== null && (best === null || v > best)) best = v;
    }
    if (best === null) continue;
    raw.push({
      date: entry.date,
      day: localDayNumber(entry.date),
      e1rm: best,
      gymId: entry.gymId,
      workoutId: entry.workoutId,
    });
  }
  raw.sort((a, b) => a.day - b.day || (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (raw.length === 0) return [];
  const first = raw[0].day;
  return raw.map((r) => ({
    date: r.date,
    dayIndex: r.day - first,
    e1rm: r.e1rm,
    gymId: r.gymId,
    workoutId: r.workoutId,
  }));
}

interface Fit {
  k: number;
  p: number;
  y0: number;
  sse: number;
}

function sse(t: number[], y: number[], k: number, p: number, y0: number): number {
  let sum = 0;
  for (let i = 0; i < t.length; i++) {
    const r = y[i] - (p - (p - y0) * Math.exp(-k * t[i]));
    sum += r * r;
  }
  return sum;
}

/** Fit y0 alone with P fixed: y - P·a = y0·b. */
function refitY0(t: number[], y: number[], k: number, p: number): number {
  let sbb = 0;
  let sby = 0;
  for (let i = 0; i < t.length; i++) {
    const e = Math.exp(-k * t[i]);
    sbb += e * e;
    sby += e * (y[i] - p * (1 - e));
  }
  return sbb > 1e-12 ? sby / sbb : y[0];
}

/** Least squares for (P, y0) at fixed k; the model is linear in both. */
function fitAtK(t: number[], y: number[], k: number, maxY: number): Fit {
  let saa = 0;
  let sab = 0;
  let sbb = 0;
  let say = 0;
  let sby = 0;
  for (let i = 0; i < t.length; i++) {
    const b = Math.exp(-k * t[i]);
    const a = 1 - b;
    saa += a * a;
    sab += a * b;
    sbb += b * b;
    say += a * y[i];
    sby += b * y[i];
  }
  const det = saa * sbb - sab * sab;
  let p = NaN;
  let y0 = NaN;
  // Near-singular when all t are equal or k·t is tiny for every point.
  if (Math.abs(det) > 1e-12 * Math.max(saa * sbb, 1e-300)) {
    p = (say * sbb - sab * sby) / det;
    y0 = (saa * sby - sab * say) / det;
  }
  if (!Number.isFinite(p) || !Number.isFinite(y0) || p < maxY) {
    p = maxY;
    y0 = refitY0(t, y, k, p);
  }
  return { k, p, y0, sse: sse(t, y, k, p, y0) };
}

/** OLS slope (kg per day); 0 when the x values do not vary. */
function olsSlope(t: number[], y: number[]): number {
  const n = t.length;
  const mt = t.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (t[i] - mt) * (y[i] - my);
    den += (t[i] - mt) ** 2;
  }
  return den > 0 ? num / den : 0;
}

export function fitForecast(points: StrengthPoint[]): Forecast {
  const n = points.length;
  const span = n > 0 ? points[n - 1].dayIndex - points[0].dayIndex : 0;
  if (n < MIN_FORECAST_SESSIONS || span < MIN_FORECAST_SPAN_DAYS) {
    return { kind: 'insufficient', sessions: n };
  }

  const t = points.map((p) => p.dayIndex - points[0].dayIndex);
  const y = points.map((p) => p.e1rm);
  const maxY = Math.max(...y);

  const ratio = K_MAX / K_MIN;
  const ks = Array.from({ length: K_STEPS }, (_, i) => K_MIN * ratio ** (i / (K_STEPS - 1)));
  const fits = ks.map((k) => fitAtK(t, y, k, maxY));
  const minSse = Math.min(...fits.map((f) => f.sse));
  let chosenIdx = 0;
  fits.forEach((f, i) => {
    if (f.sse <= minSse + SSE_TIE) chosenIdx = i;
  });
  const chosen = fits[chosenIdx];

  const sigma = Math.sqrt(chosen.sse / (n - 2));
  const value = (day: number) => chosen.p - (chosen.p - chosen.y0) * Math.exp(-chosen.k * day);
  const lastT = t[n - 1];
  const sigmaEff = Math.max(sigma, MIN_SIGMA_KG);
  const base = { kind: 'fit' as const, k: chosen.k, y0: chosen.y0, sigma };

  // The clamped rising model alone would turn a decline or a break into invented gain.
  let recentFrom = t.findIndex((x) => x >= lastT - RECENT_WINDOW_DAYS);
  recentFrom = Math.min(recentFrom, n - RECENT_MIN_POINTS);
  const recentSlope30 = olsSlope(t.slice(recentFrom), y.slice(recentFrom)) * 30;
  if (recentSlope30 < -Math.max(1, sigmaEff / 2)) {
    return {
      ...base,
      status: 'declining',
      plateauKg: null,
      gainPerMonthKg: recentSlope30,
      curve: [],
    };
  }
  // Compare against the model at the same two times, not its last value: on a steady rise the
  // mean of two actuals lags the last point by half a step and would read as a miss.
  const lastTwoResidual = (y[n - 1] - value(t[n - 1]) + (y[n - 2] - value(t[n - 2]))) / 2;
  if (Math.abs(lastTwoResidual) > 2 * sigmaEff) {
    return {
      ...base,
      status: 'unreliable',
      plateauKg: null,
      gainPerMonthKg: 0,
      curve: [],
    };
  }

  const isPlateau = chosenIdx === 0 && olsSlope(t, y) * span < 2 * sigmaEff;
  const level = (y[n - 1] + y[n - 2] + y[n - 3]) / 3;
  const curve: ForecastPoint[] = [];
  for (let dt = 0; dt <= FORECAST_HORIZON_DAYS; dt += CURVE_STEP_DAYS) {
    const v = isPlateau ? level : value(lastT + dt);
    const half = sigma * (1 + (0.5 * dt) / span);
    curve.push({
      dayIndex: points[n - 1].dayIndex + dt,
      value: v,
      low: v - half,
      high: v + half,
    });
  }
  if (isPlateau) {
    return {
      ...base,
      status: 'plateau',
      plateauKg: level,
      gainPerMonthKg: 0,
      curve,
    };
  }
  const plateauKg = chosenIdx === 0 || chosen.p > PLATEAU_MAX_RATIO * maxY ? null : chosen.p;
  const gainPerMonthKg = (chosen.p - chosen.y0) * chosen.k * Math.exp(-chosen.k * lastT) * 30;
  return { ...base, status: 'rising', plateauKg, gainPerMonthKg, curve };
}
