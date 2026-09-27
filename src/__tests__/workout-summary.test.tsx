/**
 * The session summary, rendered against real SQLite: the numbers, the
 * comparison with the last session of the same plans, and the records.
 *
 * Kept out of `src/app/`: every file in that tree is a route.
 */
jest.mock('expo-sqlite', () => require('@/test-support/expo-sqlite-mock'));

import type { SQLiteDatabase } from 'expo-sqlite';

import WorkoutSummaryScreen from '@/app/workout/summary';
import {
  addWorkoutExercise,
  createExercise,
  createGym,
  createPlan,
  finishWorkout,
  insertSet,
  startWorkout,
} from '@/db';
import { createTestDb } from '@/test-support/db';
import { fireEvent, renderWithProviders, waitFor } from '@/test-support/render';
import { resetRouter, routerMock, setRouteParams } from '@/test-support/router';

let db: SQLiteDatabase;
let gymId: number;
let pressId: number;
let pushPlan: number;

/** A finished session on `plans`: Brustpresse at weight × reps per set, `minutes` long. */
async function session(
  day: string,
  plans: number[],
  sets: [number, number][],
  minutes = 60,
): Promise<number> {
  const start = new Date(`${day}T10:00:00.000Z`);
  const workoutId = await startWorkout(db, plans, gymId, start.toISOString());
  const we = await addWorkoutExercise(db, workoutId, pressId);
  let setNumber = 1;
  for (const [weightKg, reps] of sets) {
    await insertSet(db, {
      workoutId,
      workoutExerciseId: we,
      exerciseId: pressId,
      setNumber: setNumber++,
      weightKg,
      reps,
      done: true,
    });
  }
  await finishWorkout(db, workoutId, new Date(start.getTime() + minutes * 60_000).toISOString());
  return workoutId;
}

async function openSummary(id: number, fresh = true) {
  setRouteParams({ id: String(id), ...(fresh ? { fresh: '1' } : {}) });
  const view = await renderWithProviders(<WorkoutSummaryScreen />);
  await waitFor(() => expect(view.getByText('NEUE REKORDE')).toBeTruthy());
  return view;
}

beforeEach(async () => {
  resetRouter();
  db = await createTestDb();
  gymId = await createGym(db, 'Quakenbrück');
  pressId = await createExercise(db, 'Brustpresse', 'Brust');
  pushPlan = await createPlan(db, 'Push', '#6366F1');
});

describe('session summary', () => {
  it('shows the numbers and the change against the last session with the same plans', async () => {
    await session('2026-09-13', [pushPlan], [[50, 10], [50, 10]], 60); // 1000 kg
    const id = await session('2026-09-20', [pushPlan], [[50, 10], [50, 10], [55, 8]], 55); // 1440 kg

    const view = await openSummary(id);

    expect(view.getByText('Einheit geschafft')).toBeTruthy();
    expect(view.getByText('Push')).toBeTruthy();
    expect(view.getByText('55 min')).toBeTruthy();
    expect(view.getByText('−5 min')).toBeTruthy();
    expect(view.getByText('3')).toBeTruthy(); // sets
    expect(view.getByText('+1')).toBeTruthy();
    expect(view.getByText('1.440 kg')).toBeTruthy();
    expect(view.getByText('+440 kg · +44 %')).toBeTruthy();
    expect(view.getByText(/^Vergleich mit So, 13\. September 2026/)).toBeTruthy();
  });

  it('lists a record the session set, judged only against earlier sessions', async () => {
    for (const day of ['2026-09-01', '2026-09-03', '2026-09-05']) {
      await session(day, [pushPlan], [[50, 10]]);
    }
    const id = await session('2026-09-07', [pushPlan], [[57.5, 8]]);
    await session('2026-09-09', [pushPlan], [[70, 5]]); // later and heavier — irrelevant here

    const view = await openSummary(id, false);

    expect(view.getByText('Deine Einheit')).toBeTruthy();
    expect(view.getByText('Brustpresse')).toBeTruthy();
    expect(view.getByText(/schwerstes Gewicht/)).toBeTruthy();
    expect(view.queryByText('Fertig')).toBeNull(); // only right after finishing
  });

  it('explains the missing comparison for an empty session and says when there are no records', async () => {
    const id = await session('2026-09-20', [], [[50, 10]]);

    const view = await openSummary(id);

    expect(view.getByText(/^Leere Einheit/)).toBeTruthy();
    expect(view.getByText(/keine neuen Rekorde/)).toBeTruthy();
    expect(view.queryByText(/^\+/)).toBeNull(); // no deltas without a comparison
  });

  it('names the first session of a plan set as such', async () => {
    const id = await session('2026-09-20', [pushPlan], [[50, 10]]);

    const view = await openSummary(id);

    expect(view.getByText(/^Erste Einheit mit diesen Plänen/)).toBeTruthy();
  });

  it('goes back to Heute from the fresh summary', async () => {
    const id = await session('2026-09-20', [pushPlan], [[50, 10]]);
    const view = await openSummary(id);

    await fireEvent.press(view.getByText('Fertig'));

    expect(routerMock.back).toHaveBeenCalledTimes(1);
  });
});
