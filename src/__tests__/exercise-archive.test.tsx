/**
 * Delete-vs-archive: the decision that has to be right, because getting it
 * wrong either loses history or leaves dead entries in the picker. Runs
 * against real SQLite, so the membership query is exercised, not stubbed.
 */
jest.mock('expo-sqlite', () => require('@/test-support/expo-sqlite-mock'));

import type { SQLiteDatabase } from 'expo-sqlite';

import ExercisesScreen from '@/app/(tabs)/exercises';
import ExerciseEditScreen from '@/app/exercise/edit';
import {
  addWorkoutExercise,
  createExercise,
  createGym,
  getExercise,
  getExercises,
  setExerciseArchived,
  startWorkout,
} from '@/db';
import { pressAlertButton, spyOnAlert } from '@/test-support/alert';
import { createTestDb } from '@/test-support/db';
import { fireEvent, renderWithProviders, waitFor } from '@/test-support/render';
import { resetRouter, setRouteParams } from '@/test-support/router';

let db: SQLiteDatabase;
let alert: jest.SpyInstance;

async function openEditor(exerciseId: number) {
  setRouteParams({ id: String(exerciseId) });
  const view = await renderWithProviders(<ExerciseEditScreen />);
  await waitFor(() => expect(view.getByLabelText('Name')).toBeTruthy());
  return view;
}

beforeEach(async () => {
  resetRouter();
  db = await createTestDb();
  alert = spyOnAlert();
});

afterEach(() => {
  alert.mockRestore();
});

describe('exercise editor', () => {
  it('deletes an exercise that was never used', async () => {
    const id = await createExercise(db, 'Fehlkauf', 'Bauch');
    const view = await openEditor(id);

    await fireEvent.press(view.getByText('Löschen'));
    await pressAlertButton(alert, 'Löschen');

    await waitFor(async () => expect(await getExercise(db, id)).toBeNull());
  });

  it('archives instead of deleting once the exercise sits in a session', async () => {
    const gymId = await createGym(db, 'Gym');
    const id = await createExercise(db, 'Bankdrücken', 'Brust');
    const workoutId = await startWorkout(db, [], gymId, '2026-08-01T10:00:00.000Z');
    // In the session but never opened, so no sets exist yet — the case that
    // used to hit a raw foreign-key error.
    await addWorkoutExercise(db, workoutId, id);

    const view = await openEditor(id);
    await fireEvent.press(view.getByText('Archivieren'));
    await pressAlertButton(alert, 'Archivieren');

    await waitFor(async () => expect((await getExercise(db, id))?.archived).toBe(true));
  });

  it('reactivates an archived exercise', async () => {
    const id = await createExercise(db, 'Alt', 'Beine');
    await setExerciseArchived(db, id, true);

    const view = await openEditor(id);
    await fireEvent.press(view.getByText('Reaktivieren'));

    await waitFor(async () => expect((await getExercise(db, id))?.archived).toBe(false));
  });

  it('creates a new exercise from an empty editor', async () => {
    setRouteParams({});
    const view = await renderWithProviders(<ExerciseEditScreen />);
    await waitFor(() => expect(view.getByLabelText('Name')).toBeTruthy());

    await fireEvent.changeText(view.getByLabelText('Name'), 'Klimmzüge');
    await fireEvent.press(view.getByText('Speichern'));

    await waitFor(async () => {
      const names = (await getExercises(db)).map((e) => e.name);
      expect(names).toContain('Klimmzüge');
    });
  });
});

describe('exercise list', () => {
  it('separates archived exercises into their own section so they stay reachable', async () => {
    // Clear the seeded starter library: the list is virtualized, so with 18
    // extra rows the archived section below them is not rendered yet.
    await db.runAsync('DELETE FROM exercises');
    await createExercise(db, 'Aktiv', 'Brust');
    const archivedId = await createExercise(db, 'Stillgelegt', 'Beine');
    await setExerciseArchived(db, archivedId, true);

    const view = await renderWithProviders(<ExercisesScreen />);

    await waitFor(() => expect(view.getByText('Aktiv')).toBeTruthy());
    expect(view.getByText('Archiviert')).toBeTruthy();
    expect(view.getByText('Stillgelegt')).toBeTruthy();
    // The archived one is not counted — "2 Übungen" would mean archiving does
    // not remove it from the picker.
    expect(view.getByText('1 Übung')).toBeTruthy();
  });
});
