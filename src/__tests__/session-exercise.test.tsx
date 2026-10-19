/**
 * Logging sets inside the session — the flow the whole app exists for. A tap on
 * an exercise folds its sets open under the row. Runs against real SQLite
 * (see `@/test-support/db`), so these tests break when the actual queries or
 * the carry-over rules break, not when a stub drifts.
 *
 * Kept out of `src/app/` on purpose: every file under that tree is a route.
 */
jest.mock('expo-sqlite', () => require('@/test-support/expo-sqlite-mock'));
// Reanimated's worklet runtime does not exist under Jest; see session-finish.test.
jest.mock('react-native-reorderable-list', () => ({
  __esModule: true,
  default: require('react-native').FlatList,
  reorderItems: <T,>(items: T[]) => items,
  useReorderableDrag: () => () => {},
}));
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => ({
  __esModule: true,
  default: ({ children }: { children: unknown }) => children,
}));

import type { SQLiteDatabase } from 'expo-sqlite';

import SessionScreen from '@/app/session/[id]';
import {
  addWorkoutExercise,
  createExercise,
  createGym,
  finishWorkout,
  getSetsForWorkoutExercise,
  insertSet,
  setSetting,
  startWorkout,
} from '@/db';
import { breakDismissedKey } from '@/domain/break';
import { spyOnAlert } from '@/test-support/alert';
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

/** Open a fresh session, fold the exercise open and wait for its first set row. */
async function openExercise() {
  const workoutId = await startWorkout(db, [], gymId, '2026-08-09T10:00:00.000Z');
  const workoutExerciseId = await addWorkoutExercise(db, workoutId, exerciseId);
  // The fixed 2026-08 history is months before the real clock; the break banner is not under test here.
  await setSetting(db, breakDismissedKey(workoutId), '1');
  setRouteParams({ id: String(workoutId) });
  const view = await renderWithProviders(<SessionScreen />);
  await fireEvent.press(await view.findByLabelText('Bankdrücken, Sätze aufklappen'));
  await waitFor(() => expect(view.getByLabelText('Satz 1 erledigt')).toBeTruthy());
  return { view, workoutId, workoutExerciseId };
}

beforeEach(async () => {
  resetRouter();
  db = await createTestDb();
  gymId = await createGym(db, 'Quakenbrück');
  exerciseId = await createExercise(db, 'Bankdrücken', 'Brust');
});

describe('sets in the session', () => {
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

  it('suggests going heavier once last time hit the rep target, and applies it only on tap', async () => {
    await pastSession(1, 80, 12);
    const { view, workoutExerciseId } = await openExercise();

    expect(view.getByText('Vorschlag: 82,5 kg')).toBeTruthy();
    // Advice, not an edit: the field still carries last time's weight.
    expect(view.getByLabelText('KG').props.value).toBe('80');

    await fireEvent.press(view.getByLabelText('Vorschlag übernehmen: 82,5 kg'));

    expect(view.getByLabelText('KG').props.value).toBe('82,5');
    await waitFor(async () => {
      const [saved] = await getSetsForWorkoutExercise(db, workoutExerciseId);
      expect(saved).toMatchObject({ weightKg: 82.5, reps: null, done: false });
    });
    expect(view.queryByText('Übernehmen')).toBeNull(); // nothing left to move
  });

  it('says to stay at the weight while the reps are short, with nothing to apply', async () => {
    await pastSession(1, 80, 9);
    const { view } = await openExercise();

    expect(view.getByText('Vorschlag: bei 80 kg bleiben')).toBeTruthy();
    expect(view.queryByText('Übernehmen')).toBeNull();
  });

  it('gives no progression advice built on another gym', async () => {
    const otherGym = await createGym(db, 'Bersenbrück');
    const workoutId = await startWorkout(db, [], otherGym, '2026-08-01T10:00:00.000Z');
    const we = await addWorkoutExercise(db, workoutId, exerciseId);
    await insertSet(db, {
      workoutId,
      workoutExerciseId: we,
      exerciseId,
      setNumber: 1,
      weightKg: 80,
      reps: 12,
      done: true,
    });
    await finishWorkout(db, workoutId, '2026-08-01T11:00:00.000Z');

    const { view } = await openExercise();

    expect(view.getByText(/letztes Mal im Bersenbrück/)).toBeTruthy();
    expect(view.queryByText(/^Vorschlag/)).toBeNull();
  });

  it('starts the rest timer when a set is ticked, not when it is un-ticked', async () => {
    const { view } = await openExercise();

    await fireEvent.press(view.getByLabelText('Satz 1 erledigt'));
    await waitFor(() => expect(view.getByText(/^Pause /)).toBeTruthy());

    await fireEvent.press(view.getByLabelText('Pause beenden'));
    await fireEvent.press(view.getByLabelText('Satz 1 erledigt')); // un-tick
    expect(view.queryByText(/^Pause /)).toBeNull();
  });

  it('folds the sets away on a second tap and keeps what was typed', async () => {
    const { view, workoutExerciseId } = await openExercise();

    await fireEvent.changeText(view.getByLabelText('KG'), '60');
    await fireEvent.press(view.getByLabelText('Bankdrücken, Sätze zuklappen'));
    expect(view.queryByLabelText('Satz 1 erledigt')).toBeNull();

    // Stored on the keystroke, not on leaving — there is no leaving any more.
    await waitFor(async () => {
      const [saved] = await getSetsForWorkoutExercise(db, workoutExerciseId);
      expect(saved.weightKg).toBe(60);
    });
    await fireEvent.press(view.getByLabelText('Bankdrücken, Sätze aufklappen'));
    await waitFor(() => expect(view.getByLabelText('KG').props.value).toBe('60'));
  });

  it('keeps the newest value when keystrokes are written back to back', async () => {
    const { view, workoutExerciseId } = await openExercise();

    for (const text of ['1', '10', '100', '102', '102,5']) {
      await fireEvent.changeText(view.getByLabelText('KG'), text);
    }

    await waitFor(async () => {
      const [saved] = await getSetsForWorkoutExercise(db, workoutExerciseId);
      expect(saved.weightKg).toBe(102.5);
    });
  });

  it('counts ticked sets on the row as they happen', async () => {
    const { view } = await openExercise();

    await waitFor(() => expect(view.getByText('0/1 Sätze')).toBeTruthy());
    await fireEvent.press(view.getByLabelText('Satz 1 erledigt'));
    await waitFor(() => expect(view.getByText('1/1 Sätze')).toBeTruthy());
  });

  it('keeps only one exercise open at a time', async () => {
    const rowingId = await createExercise(db, 'Rudern', 'Rücken');
    const workoutId = await startWorkout(db, [], gymId, '2026-08-09T10:00:00.000Z');
    await addWorkoutExercise(db, workoutId, exerciseId);
    await addWorkoutExercise(db, workoutId, rowingId);
    setRouteParams({ id: String(workoutId) });
    const view = await renderWithProviders(<SessionScreen />);

    await fireEvent.press(await view.findByLabelText('Bankdrücken, Sätze aufklappen'));
    await fireEvent.press(view.getByLabelText('Rudern, Sätze aufklappen'));

    expect(view.getByLabelText('Bankdrücken, Sätze aufklappen')).toBeTruthy();
    expect(view.getByLabelText('Rudern, Sätze zuklappen')).toBeTruthy();
    await waitFor(() => expect(view.getAllByLabelText('Satz 1 erledigt')).toHaveLength(1));
  });

  it('takes the record badge back when the set is un-ticked, and gives it again on re-tick', async () => {
    await pastSession(1, 80, 8);
    await pastSession(2, 80, 8);
    await pastSession(3, 80, 8);
    const { view } = await openExercise();

    await fireEvent.changeText(view.getByLabelText('KG'), '100');
    await fireEvent.changeText(view.getByLabelText('WDH'), '5');
    await fireEvent.press(view.getByLabelText('Satz 1 erledigt'));
    await waitFor(() => expect(view.getByText('PR')).toBeTruthy());

    await fireEvent.press(view.getByLabelText('Satz 1 erledigt'));
    expect(view.queryByText('PR')).toBeNull();

    await fireEvent.press(view.getByLabelText('Satz 1 erledigt'));
    await waitFor(() => expect(view.getByText('PR')).toBeTruthy());
  });

  it('keeps the last set — deleting it would re-seed it on the next open', async () => {
    const alert = spyOnAlert();
    const { view, workoutExerciseId } = await openExercise();

    await fireEvent(view.getByText('1'), 'longPress');

    expect(alert).toHaveBeenCalledWith('Letzter Satz', expect.any(String));
    expect(await getSetsForWorkoutExercise(db, workoutExerciseId)).toHaveLength(1);
    alert.mockRestore();
  });

  it('keeps what was typed in a set when another one is added', async () => {
    const { view, workoutExerciseId } = await openExercise();

    await fireEvent.changeText(view.getByLabelText('WDH'), '7');
    await fireEvent.press(view.getByText('Satz'));

    await waitFor(() => expect(view.getAllByLabelText('WDH')).toHaveLength(2));
    expect(view.getAllByLabelText('WDH')[0].props.value).toBe('7');
    await waitFor(async () => {
      const saved = await getSetsForWorkoutExercise(db, workoutExerciseId);
      expect(saved.map((x) => x.reps)).toEqual([7, null]);
    });
  });
});

describe('cardio time input', () => {
  it('shows the time the way it was stored once the field is left', async () => {
    const treadmill = await createExercise(db, 'Laufband', 'Cardio');
    const workoutId = await startWorkout(db, [], gymId, '2026-08-09T10:00:00.000Z');
    await addWorkoutExercise(db, workoutId, treadmill);
    setRouteParams({ id: String(workoutId) });
    const view = await renderWithProviders(<SessionScreen />);
    await fireEvent.press(await view.findByLabelText('Laufband, Sätze aufklappen'));
    const time = await view.findByLabelText('ZEIT (min:s)');

    await fireEvent.changeText(time, '32');
    await fireEvent(time, 'blur');
    expect(view.getByLabelText('ZEIT (min:s)').props.value).toBe('32:00');

    await fireEvent.changeText(view.getByLabelText('ZEIT (min:s)'), '1:75');
    await fireEvent(view.getByLabelText('ZEIT (min:s)'), 'blur');
    expect(view.getByLabelText('ZEIT (min:s)').props.value).toBe('');
  });
});

