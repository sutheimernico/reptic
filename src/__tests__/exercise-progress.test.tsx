/**
 * Exercise progress: forecast states, the saved per-exercise gym filter, and the
 * zero-history empty state, against real SQLite.
 */
jest.mock('expo-sqlite', () => require('@/test-support/expo-sqlite-mock'));

import type { SQLiteDatabase } from 'expo-sqlite';

import ExerciseProgressScreen from '@/app/exercise/progress';
import {
  addWorkoutExercise,
  createExercise,
  createGym,
  finishWorkout,
  getSetting,
  insertSet,
  startWorkout,
} from '@/db';
import { createTestDb } from '@/test-support/db';
import { act, fireEvent, renderWithProviders, waitFor } from '@/test-support/render';
import { resetRouter, setRouteParams } from '@/test-support/router';

const reanimated = require('react-native-reanimated') as {
  __setReducedMotion: (v: boolean) => void;
};

let db: SQLiteDatabase;
let exerciseId: number;
let gymA: number;
let gymB: number;

async function logSession(gymId: number, daysAgo: number, weightKg: number, reps = 8) {
  const at = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
  const workoutId = await startWorkout(db, [], gymId, at);
  const workoutExerciseId = await addWorkoutExercise(db, workoutId, exerciseId);
  await insertSet(db, {
    workoutId,
    workoutExerciseId,
    exerciseId,
    setNumber: 1,
    weightKg,
    reps,
    done: true,
  });
  await finishWorkout(db, workoutId, at);
}

/** 8 sessions over 63 days; the last two (most recent) are in gym B. */
async function seedEight() {
  const plan: [number, number, number][] = [
    [gymA, 63, 60],
    [gymA, 54, 62.5],
    [gymA, 45, 65],
    [gymA, 36, 67.5],
    [gymA, 27, 70],
    [gymA, 18, 72.5],
    [gymB, 9, 75],
    [gymB, 1, 77.5],
  ];
  for (const [g, d, w] of plan) await logSession(g, d, w);
}

/** Log sessions by target e1RM (6 reps -> e1RM = 1.2 x weight) at `day` days after the first one. */
async function logCurve(days: number[], e1rms: number[], gymId = gymA) {
  const last = days[days.length - 1];
  for (let i = 0; i < days.length; i++) {
    await logSession(gymId, last - days[i] + 1, e1rms[i] / 1.2, 6);
  }
}

async function renderScreen() {
  setRouteParams({ id: String(exerciseId), name: 'Bankdrücken' });
  return renderWithProviders(<ExerciseProgressScreen />);
}

beforeEach(async () => {
  resetRouter();
  reanimated.__setReducedMotion(true);
  db = await createTestDb();
  gymA = await createGym(db, 'Studio Nord');
  gymB = await createGym(db, 'Hotel-Gym');
  exerciseId = await createExercise(db, 'Bankdrücken', 'Brust');
});
afterEach(() => reanimated.__setReducedMotion(false));

describe('exercise progress', () => {
  it('shows an honest empty state without history', async () => {
    const view = await renderScreen();
    await waitFor(() => expect(view.getByText('Noch kein Fortschritt')).toBeTruthy());
    expect(view.queryByText(/NaN|Prognose/)).toBeNull();
  });

  it('shows header, forecast readouts and session count', async () => {
    await seedEight();
    const view = await renderScreen();
    await waitFor(() => expect(view.getAllByText('Prognose').length).toBeGreaterThan(0));
    expect(view.getByText('8 Einheiten')).toBeTruthy();
    expect(view.getByText(/pro Monat/)).toBeTruthy();
    // Linear growth: a curve is drawn, but no plateau is claimed.
    expect(view.getByText('Noch kein Plateau erkennbar')).toBeTruthy();
    expect(view.queryByText(/Plateau ~/)).toBeNull();
    expect(view.queryByText(/NaN/)).toBeNull();
  });

  it('stores the gym filter per exercise and restores it on remount', async () => {
    await seedEight();
    const view = await renderScreen();
    await waitFor(() => expect(view.getByLabelText('Hotel-Gym')).toBeTruthy());
    await fireEvent.press(view.getByLabelText('Hotel-Gym'));
    await waitFor(async () =>
      expect(await getSetting(db, `progress_gyms_${exerciseId}`)).toBe(JSON.stringify([gymB])),
    );
    // Two sessions are too few for a forecast.
    await waitFor(() =>
      expect(
        view.getByText('Noch zu wenig Daten für eine Prognose (2 von 6 Einheiten)'),
      ).toBeTruthy(),
    );
    await act(async () => view.unmount());

    const again = await renderScreen();
    await waitFor(() =>
      expect(again.getByText(/Noch zu wenig Daten für eine Prognose \(2 von 6/)).toBeTruthy(),
    );
    expect(again.getByLabelText('Hotel-Gym').props.accessibilityState.selected).toBe(true);

    await fireEvent.press(again.getByLabelText('Alle Gyms'));
    await waitFor(async () =>
      expect(await getSetting(db, `progress_gyms_${exerciseId}`)).toBeNull(),
    );
    await waitFor(() => expect(again.getByText('8 Einheiten')).toBeTruthy());
  });

  it('draws a one-session chart without NaN geometry', async () => {
    await logSession(gymA, 3, 82.5);
    const view = await renderScreen();
    const chart = await waitFor(() => view.getByLabelText('Kraftverlauf mit Prognose'));
    await fireEvent(chart, 'layout', { nativeEvent: { layout: { width: 340, height: 210 } } });
    expect(JSON.stringify(view.toJSON())).not.toMatch(/NaN/);
    expect(
      view.getByText('Noch zu wenig Daten für eine Prognose (1 von 6 Einheiten)'),
    ).toBeTruthy();
  });

  it('shows a plateau for flat noisy data', async () => {
    await logCurve(
      [0, 12, 24, 36, 48, 60, 72, 84, 96, 108],
      [100, 101, 99, 100, 102, 100, 99, 101, 100, 100],
    );
    const view = await renderScreen();
    await waitFor(() => expect(view.getByText(/^Plateau ~\d+(,\d)? kg$/)).toBeTruthy());
    expect(view.queryByText('Noch kein Plateau erkennbar')).toBeNull();
  });

  it('declining: shows the pause copy, no plateau, no curve legend', async () => {
    await logCurve(
      [0, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120],
      [100, 101, 102, 103, 104, 105, 100, 97, 94, 91, 88],
    );
    const view = await renderScreen();
    await waitFor(() =>
      expect(
        view.getByText(
          'Zuletzt rückläufig — nach einer Pause oder einem Deload normal. Die Prognose kommt wieder, sobald es aufwärts geht.',
        ),
      ).toBeTruthy(),
    );
    expect(view.queryByText(/Plateau/)).toBeNull();
    expect(view.queryByText('Prognose')).toBeNull(); // no legend, no heading: nothing is forecast
    expect(view.getByText(/^−\d+(,\d)? kg pro Monat$/)).toBeTruthy();
  });

  it('unreliable: shows the noise copy, no plateau, no gain', async () => {
    const days = Array.from({ length: 16 }, (_, i) => i * 10);
    const e1 = days.map((d) => 80 + 0.2 * d);
    e1[14] += 8;
    e1[15] += 8;
    await logCurve(days, e1);
    const view = await renderScreen();
    await waitFor(() =>
      expect(view.getByText('Der Verlauf ist gerade zu unruhig für eine Prognose.')).toBeTruthy(),
    );
    expect(view.queryByText(/Plateau/)).toBeNull();
    expect(view.queryByText(/pro Monat/)).toBeNull();
    expect(view.queryByText('Unsicherheit')).toBeNull();
    expect(view.getByText('16 Einheiten')).toBeTruthy();
  });

  it('filters the session list with the gym filter', async () => {
    await seedEight();
    const view = await renderScreen();
    await waitFor(() => expect(view.getByLabelText('Hotel-Gym')).toBeTruthy());
    expect(view.getAllByText(/ · Studio Nord$/)).toHaveLength(6);
    await fireEvent.press(view.getByLabelText('Hotel-Gym'));
    await waitFor(() => expect(view.queryAllByText(/ · Studio Nord$/)).toHaveLength(0));
    expect(view.getAllByText(/ · Hotel-Gym$/)).toHaveLength(2);
  });

  it('keeps the per-session list', async () => {
    await seedEight();
    const view = await renderScreen();
    await waitFor(() => expect(view.getByText('77,5 kg')).toBeTruthy());
  });
});
