/**
 * The set screen — the flow the whole app exists for. Runs against real SQLite
 * (see `@/test-support/db`), so these tests break when the actual queries or
 * the carry-over rules break, not when a stub drifts.
 *
 * Kept out of `src/app/` on purpose: every file under that tree is a route.
 */
jest.mock('expo-sqlite', () => require('@/test-support/expo-sqlite-mock'));

import type { SQLiteDatabase } from 'expo-sqlite';

import ExerciseSetScreen from '@/app/session/exercise';
import {
  addWorkoutExercise,
  createExercise,
  createGym,
  finishWorkout,
  getSetsForWorkoutExercise,
  insertSet,
  startWorkout,
} from '@/db';
import { createTestDb } from '@/test-support/db';
import { fireEvent, renderWithProviders, waitFor } from '@/test-support/render';
import { resetRouter, setRouteParams } from '@/test-support/router';

let db: SQLiteDatabase;
let gymId: number;
let exerciseId: number;

/** A finished session logging the exercise at the given weight × reps. */
async function pastSession(day: number, weightKg: number, reps: number) {
  const workoutId = await startWorkout(db, [], gymId, `2026-08-0${day}T10:00:00.000Z`);
  const we = await addWorkoutExercise(db, workoutId, exerciseId);
  await insertSet(db, {
    workoutId,
    workoutExerciseId: we,
    exerciseId,
    setNumber: 1,
    weightKg,
    reps,
    done: true,
  });
  await finishWorkout(db, workoutId, `2026-08-0${day}T11:00:00.000Z`);
}

/** Open the set screen for a fresh session and wait for its first set row. */
async function openExercise() {
  const workoutId = await startWorkout(db, [], gymId, '2026-08-09T10:00:00.000Z');
  const workoutExerciseId = await addWorkoutExercise(db, workoutId, exerciseId);
  setRouteParams({
    workoutId: String(workoutId),
    workoutExerciseId: String(workoutExerciseId),
    exerciseId: String(exerciseId),
    name: 'Bankdrücken',
  });
  const view = await renderWithProviders(<ExerciseSetScreen />);
  await waitFor(() => expect(view.getByLabelText('Satz 1 erledigt')).toBeTruthy());
  return { view, workoutId, workoutExerciseId };
}

beforeEach(async () => {
  resetRouter();
  db = await createTestDb();
  gymId = await createGym(db, 'Quakenbrück');
  exerciseId = await createExercise(db, 'Bankdrücken', 'Brust');
});

describe('set screen', () => {
  it('pre-fills the weight from last time and leaves the reps empty', async () => {
    await pastSession(1, 80, 8);
    const { view } = await openExercise();

    expect(view.getByLabelText('KG').props.value).toBe('80');
    expect(view.getByLabelText('WDH').props.value).toBe('');
    expect(view.getByText(/letztes Mal/)).toBeTruthy();
    expect(view.getByText(/80 kg × 8/)).toBeTruthy();
  });

  it('persists what was typed when the set is ticked done', async () => {
    const { view, workoutExerciseId } = await openExercise();

    await fireEvent.changeText(view.getByLabelText('KG'), '72,5');
    await fireEvent.changeText(view.getByLabelText('WDH'), '9');
    await fireEvent.press(view.getByLabelText('Satz 1 erledigt'));

    await waitFor(async () => {
      const [saved] = await getSetsForWorkoutExercise(db, workoutExerciseId);
      expect(saved).toMatchObject({ weightKg: 72.5, reps: 9, done: true });
    });
  });

  it('marks a personal record once the exercise has enough history', async () => {
    await pastSession(1, 80, 8);
    await pastSession(2, 80, 8);
    await pastSession(3, 80, 8);
    const { view } = await openExercise();

    await fireEvent.changeText(view.getByLabelText('KG'), '100');
    await fireEvent.changeText(view.getByLabelText('WDH'), '5');
    await fireEvent.press(view.getByLabelText('Satz 1 erledigt'));

    await waitFor(() => expect(view.getByText('PR')).toBeTruthy());
  });

  it('stays quiet about records while the exercise is still new', async () => {
    await pastSession(1, 80, 8); // one session of history is not enough
    const { view, workoutExerciseId } = await openExercise();

    await fireEvent.changeText(view.getByLabelText('KG'), '200');
    await fireEvent.changeText(view.getByLabelText('WDH'), '5');
    await fireEvent.press(view.getByLabelText('Satz 1 erledigt'));

    await waitFor(async () => {
      const [saved] = await getSetsForWorkoutExercise(db, workoutExerciseId);
      expect(saved.done).toBe(true);
    });
    expect(view.queryByText('PR')).toBeNull();
  });

  it('does not call a repeat of an old best a record', async () => {
    await pastSession(1, 80, 8);
    await pastSession(2, 80, 8);
    await pastSession(3, 80, 8);
    const { view, workoutExerciseId } = await openExercise();

    // Exactly last time's set, carried over: a tie is not a record.
    await fireEvent.changeText(view.getByLabelText('WDH'), '8');
    await fireEvent.press(view.getByLabelText('Satz 1 erledigt'));

    await waitFor(async () => {
      const [saved] = await getSetsForWorkoutExercise(db, workoutExerciseId);
      expect(saved.done).toBe(true);
    });
    expect(view.queryByText('PR')).toBeNull();
  });

  it('adds another set carrying the weight over, with reps left empty', async () => {
    await pastSession(1, 80, 8);
    const { view, workoutExerciseId } = await openExercise();

    await fireEvent.press(view.getByText('Satz'));

    await waitFor(async () => {
      const saved = await getSetsForWorkoutExercise(db, workoutExerciseId);
      expect(saved).toHaveLength(2);
      expect(saved[1]).toMatchObject({ weightKg: 80, reps: null, done: false });
    });
  });

  it('starts the rest timer when a set is ticked, not when it is un-ticked', async () => {
    const { view } = await openExercise();

    await fireEvent.press(view.getByLabelText('Satz 1 erledigt'));
    await waitFor(() => expect(view.getByText(/^Pause /)).toBeTruthy());

    await fireEvent.press(view.getByLabelText('Pause beenden'));
    await fireEvent.press(view.getByLabelText('Satz 1 erledigt')); // un-tick
    expect(view.queryByText(/^Pause /)).toBeNull();
  });
});
