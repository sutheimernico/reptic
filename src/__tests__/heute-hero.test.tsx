/**
 * The Heute week hero in all four skins, against real SQLite: sane empty state
 * on a fresh install (no NaN, no "0 von 0") and real numbers once a week exists.
 */
jest.mock('expo-sqlite', () => require('@/test-support/expo-sqlite-mock'));

import type { SQLiteDatabase } from 'expo-sqlite';

import { WeekHero } from '@/components/week-hero';
import { addWorkoutExercise, createExercise, createGym, finishWorkout, getWeekOverview, insertSet, setSetting, startWorkout } from '@/db';
import { createTestDb } from '@/test-support/db';
import { renderWithProviders, waitFor, fireEvent } from '@/test-support/render';
import { resetRouter, routerMock } from '@/test-support/router';

const reanimated = require('react-native-reanimated') as { __setReducedMotion: (v: boolean) => void };

let db: SQLiteDatabase;

beforeEach(async () => {
  resetRouter();
  db = await createTestDb();
  reanimated.__setReducedMotion(true); // CountUp renders its final value straight away
});
afterEach(() => reanimated.__setReducedMotion(false));

async function seedWeek() {
  const gymId = await createGym(db, 'Gym');
  const exerciseId = await createExercise(db, 'Bankdrücken', 'Brust');
  const now = new Date();
  const workoutId = await startWorkout(db, [], gymId, now.toISOString());
  const workoutExerciseId = await addWorkoutExercise(db, workoutId, exerciseId);
  await insertSet(db, {
    workoutId, workoutExerciseId, exerciseId, setNumber: 1, weightKg: 92, reps: 200, done: true,
  });
  await finishWorkout(db, workoutId, now.toISOString());
}

async function renderHero(variant: string) {
  await setSetting(db, 'theme_variant', variant);
  const overview = await getWeekOverview(db, new Date());
  const view = await renderWithProviders(<WeekHero overview={overview} />);
  // The provider hydrates its variant from settings after the first paint.
  return view;
}

const VARIANTS = ['evolved', 'warm', 'arcade', 'instrument'] as const;

describe.each(VARIANTS)('WeekHero (%s)', (variant) => {
  it('shows an honest empty week without NaN', async () => {
    const view = await renderHero(variant);
    await waitFor(() => expect(view.getByLabelText(/Wochenfortschritt: 0 kg von 10\.000 kg/)).toBeTruthy());
    expect(view.getByText('Vorschlag · anpassen')).toBeTruthy();
    expect(view.queryByText(/NaN|undefined|0 von 0/)).toBeNull();
    expect(view.queryByText(/ km/)).toBeNull(); // no cardio logged -> no km goal at all
  });

  it('shows volume and the stored goal', async () => {
    await seedWeek();
    await setSetting(db, 'week_goal_kg', '25000');
    const view = await renderHero(variant);
    await waitFor(() => expect(view.getByLabelText(/Wochenfortschritt: 18\.400 kg von 25\.000 kg/)).toBeTruthy());
    expect(view.getAllByText(/18\.400/).length).toBeGreaterThan(0);
    expect(view.getAllByText(/25\.000/).length).toBeGreaterThan(0);
    expect(view.queryByText('Vorschlag · anpassen')).toBeNull();
  });
});

describe('WeekHero skins', () => {
  it('arcade speaks Level', async () => {
    const view = await renderHero('arcade');
    await waitFor(() => expect(view.getByText(/Level 1/)).toBeTruthy());
  });

  it('instrument speaks KW', async () => {
    const view = await renderHero('instrument');
    await waitFor(() => expect(view.getByText(/KW \d+/)).toBeTruthy());
  });

  it('opens the settings from the suggestion label', async () => {
    const view = await renderHero('evolved');
    await fireEvent.press(view.getByText('Vorschlag · anpassen'));
    expect(routerMock.push).toHaveBeenCalledWith('/settings');
  });

  it('shows the km goal once cardio was logged', async () => {
    const gymId = await createGym(db, 'Gym');
    const run = await createExercise(db, 'Laufband', 'Cardio');
    const workoutId = await startWorkout(db, [], gymId, new Date().toISOString());
    const workoutExerciseId = await addWorkoutExercise(db, workoutId, run);
    await insertSet(db, {
      workoutId, workoutExerciseId, exerciseId: run, setNumber: 1, weightKg: null, reps: null, distanceKm: 5, durationSec: 1800, done: true,
    });
    await finishWorkout(db, workoutId, new Date().toISOString());
    const view = await renderHero('evolved');
    await waitFor(() => expect(view.getAllByText(/5 km/).length).toBeGreaterThan(0));
  });
});
