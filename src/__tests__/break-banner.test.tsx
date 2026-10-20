/**
 * The break banner on the session screen: after two weeks away it offers to
 * start lighter. Real SQLite, so the seeding and persistence rules are exercised.
 */
jest.mock('expo-sqlite', () => require('@/test-support/expo-sqlite-mock'));
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
import { SetEditor } from '@/components/set-editor';
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
import { breakAppliedKey } from '@/domain/break';
import { pressAlertButton, spyOnAlert } from '@/test-support/alert';
import { createTestDb } from '@/test-support/db';
import { act, fireEvent, renderWithProviders, waitFor } from '@/test-support/render';
import { resetRouter, setRouteParams } from '@/test-support/router';

let db: SQLiteDatabase;
let gymId: number;
let pressId: number;
let rowId: number;

const DAY_MS = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS).toISOString();

/** A finished session `daysBack` ago: the exercise with one set per entry of `weights`. */
async function pastSession(
  exerciseId: number,
  daysBack: number,
  weights: (number | null)[],
  reps = 8,
) {
  const workoutId = await startWorkout(db, [], gymId, daysAgo(daysBack));
  const we = await addWorkoutExercise(db, workoutId, exerciseId);
  for (const [i, weightKg] of weights.entries()) {
    await insertSet(db, {
      workoutId,
      workoutExerciseId: we,
      exerciseId,
      setNumber: i + 1,
      weightKg,
      reps,
      done: true,
    });
  }
  await finishWorkout(db, workoutId, daysAgo(daysBack));
}

async function newSession(exerciseIds: number[]) {
  const workoutId = await startWorkout(db, [], gymId, new Date().toISOString());
  const wes: number[] = [];
  for (const id of exerciseIds) wes.push(await addWorkoutExercise(db, workoutId, id));
  return { workoutId, wes };
}

async function openScreen(workoutId: number) {
  setRouteParams({ id: String(workoutId) });
  return renderWithProviders(<SessionScreen />);
}

async function open(view: Awaited<ReturnType<typeof openScreen>>, name: string, sets: number) {
  await fireEvent.press(await view.findByLabelText(`${name}, Sätze aufklappen`));
  await waitFor(() => expect(view.getAllByLabelText(/Satz \d+ erledigt/)).toHaveLength(sets));
}

beforeEach(async () => {
  resetRouter();
  db = await createTestDb();
  gymId = await createGym(db, 'Quakenbrück');
  pressId = await createExercise(db, 'Brustpresse', 'Brust');
  rowId = await createExercise(db, 'Rudern', 'Rücken');
});

describe('break banner', () => {
  it('shows nothing on the very first session', async () => {
    const { workoutId } = await newSession([pressId]);
    const view = await openScreen(workoutId);
    await view.findByLabelText('Brustpresse, Sätze aufklappen');
    expect(view.queryByText(/nicht im Gym/)).toBeNull();
  });

  it('shows nothing when the last session was recent', async () => {
    await pastSession(pressId, 3, [82.5]);
    const { workoutId } = await newSession([pressId]);
    const view = await openScreen(workoutId);
    await view.findByLabelText('Brustpresse, Sätze aufklappen');
    expect(view.queryByText(/nicht im Gym/)).toBeNull();
  });

  it('lowers the open exercise, hides the progression hint and remembers the choice', async () => {
    await pastSession(pressId, 16, [82.5], 12); // 12 reps would trigger an increase hint
    const { workoutId } = await newSession([pressId]);
    const view = await openScreen(workoutId);

    expect(await view.findByText(/Du warst 16 Tage nicht im Gym/)).toBeTruthy();
    expect(view.getByText('Heute rund 10 % leichter starten?')).toBeTruthy();
    await open(view, 'Brustpresse', 1);
    expect(view.getByLabelText('KG').props.value).toBe('82,5');
    expect(view.queryByText(/Vorschlag:/)).toBeNull();

    await fireEvent.press(view.getByText('Übernehmen'));

    await waitFor(() => expect(view.getByLabelText('KG').props.value).toBe('72,5'));
    expect(view.getByText('Gewichte um 10 % gesenkt')).toBeTruthy();
    expect(view.queryByText(/Vorschlag:/)).toBeNull();

    await act(async () => view.unmount());
    const again = await openScreen(workoutId);
    await again.findByLabelText('Brustpresse, Sätze aufklappen');
    expect(again.queryByText(/nicht im Gym/)).toBeNull();
    await open(again, 'Brustpresse', 1);
    expect(again.getByLabelText('KG').props.value).toBe('72,5');
    expect(again.queryByText(/Vorschlag:/)).toBeNull();
  });

  it('keeps typed and performed values, and lowers only untouched sets', async () => {
    await pastSession(pressId, 20, [82.5, 82.5, 82.5]);
    const { workoutId, wes } = await newSession([pressId]);
    const view = await openScreen(workoutId);
    await view.findByText(/nicht im Gym/);
    await open(view, 'Brustpresse', 3);

    const kg = view.getAllByLabelText('KG');
    await fireEvent.changeText(kg[1], '100'); // typed, no reps yet
    await fireEvent.changeText(view.getAllByLabelText('WDH')[2], '8'); // performed
    await fireEvent.press(view.getByText('Übernehmen'));

    await waitFor(() => expect(view.getAllByLabelText('KG')[0].props.value).toBe('72,5'));
    const values = view.getAllByLabelText('KG').map((i) => i.props.value);
    expect(values).toEqual(['72,5', '100', '82,5']);
    await waitFor(async () => {
      const saved = await getSetsForWorkoutExercise(db, wes[0]);
      expect(saved.map((s) => s.weightKg)).toEqual([72.5, 100, 82.5]);
    });
  });

  it('applies the factor to an exercise that is opened later, and to a collapsed seeded one', async () => {
    await pastSession(pressId, 16, [82.5]);
    await pastSession(rowId, 16, [60]);
    const { workoutId, wes } = await newSession([pressId, rowId]);
    const view = await openScreen(workoutId);
    await view.findByText(/nicht im Gym/);
    await open(view, 'Brustpresse', 1); // seeds Brustpresse
    await fireEvent.press(view.getByLabelText('Rudern, Sätze aufklappen')); // collapses Brustpresse
    await waitFor(() => expect(view.getByLabelText('KG').props.value).toBe('60'));

    await fireEvent.press(view.getByText('Übernehmen'));
    await waitFor(() => expect(view.getByLabelText('KG').props.value).toBe('52,5')); // open Rudern: 60 → 54, floored to the 2,5 grid

    await waitFor(async () => {
      const [press] = await getSetsForWorkoutExercise(db, wes[0]);
      expect(press.weightKg).toBe(72.5);
    });
  });

  it('keeps a kg typed into a collapsed exercise and still lowers its carried-over sets', async () => {
    await pastSession(pressId, 16, [82.5, 82.5]);
    await pastSession(rowId, 16, [60]);
    const { workoutId, wes } = await newSession([pressId, rowId]);
    const view = await openScreen(workoutId);
    await view.findByText(/nicht im Gym/);
    await open(view, 'Brustpresse', 2);
    await fireEvent.changeText(view.getAllByLabelText('KG')[0], '100'); // typed, no reps
    await waitFor(async () => {
      const saved = await getSetsForWorkoutExercise(db, wes[0]);
      expect(saved[0].weightKg).toBe(100);
    });
    await open(view, 'Rudern', 1); // collapses Brustpresse

    await fireEvent.press(view.getByText('Übernehmen'));

    await waitFor(() => expect(view.getByLabelText('KG').props.value).toBe('52,5'));
    await waitFor(async () => {
      const saved = await getSetsForWorkoutExercise(db, wes[0]);
      expect(saved.map((x) => x.weightKg)).toEqual([100, 72.5]);
    });
    await open(view, 'Brustpresse', 2);
    expect(view.getAllByLabelText('KG').map((i) => i.props.value)).toEqual(['100', '72,5']);
  });

  it('seeds a never-opened exercise lowered after Übernehmen', async () => {
    await pastSession(pressId, 16, [82.5]);
    const { workoutId } = await newSession([pressId]);
    const view = await openScreen(workoutId);
    await fireEvent.press(await view.findByText('Übernehmen'));
    await view.findByText('Gewichte um 10 % gesenkt');
    await open(view, 'Brustpresse', 1);
    expect(view.getByLabelText('KG').props.value).toBe('72,5');
  });

  it('does not lower twice when an exercise opens in the moment Übernehmen is tapped', async () => {
    await pastSession(pressId, 16, [100]);
    const { workoutId, wes } = await newSession([pressId]);
    // The factor is already stored, so the editor seeds lowered (100 -> 90) ...
    await setSetting(db, breakAppliedKey(workoutId), '0.9');
    const props = { workoutId, workoutExerciseId: wes[0], exerciseId: pressId };
    const view = await renderWithProviders(<SetEditor {...props} breakApplyToken={0} />);
    await waitFor(() => expect(view.getByLabelText('KG').props.value).toBe('90'));

    // ... and then the banner's apply token arrives for the same factor.
    await view.rerender(<SetEditor {...props} breakApplyToken={1} />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(view.getByLabelText('KG').props.value).toBe('90');
    expect((await getSetsForWorkoutExercise(db, wes[0]))[0].weightKg).toBe(90);
  });

  it('keeps the weight of a set the user added with "Satz"', async () => {
    await pastSession(pressId, 16, [100]);
    const { workoutId, wes } = await newSession([pressId]);
    const view = await openScreen(workoutId);
    await view.findByText(/nicht im Gym/);
    await open(view, 'Brustpresse', 1);
    await fireEvent.press(view.getByText('Satz'));
    await waitFor(() => expect(view.getAllByLabelText('KG')).toHaveLength(2));
    expect(view.getAllByLabelText('KG').map((i) => i.props.value)).toEqual(['100', '100']);

    await fireEvent.press(view.getByText('Übernehmen'));

    await waitFor(() => expect(view.getAllByLabelText('KG')[0].props.value).toBe('90'));
    expect(view.getAllByLabelText('KG').map((i) => i.props.value)).toEqual(['90', '100']);
    await waitFor(async () => {
      const saved = await getSetsForWorkoutExercise(db, wes[0]);
      expect(saved.map((s) => s.weightKg)).toEqual([90, 100]);
    });
  });

  it('lowers the right carried-over sets after set 1 was deleted', async () => {
    await pastSession(pressId, 16, [80, 90, 100]);
    const { workoutId } = await newSession([pressId]);
    const alert = spyOnAlert();
    const view = await openScreen(workoutId);
    await view.findByText(/nicht im Gym/);
    await open(view, 'Brustpresse', 3);
    await fireEvent(view.getByText('1'), 'longPress'); // the set-number badge of set 1
    await act(async () => pressAlertButton(alert, 'Löschen'));
    await waitFor(() => expect(view.getAllByLabelText('KG')).toHaveLength(2));
    expect(view.getAllByLabelText('KG').map((i) => i.props.value)).toEqual(['90', '100']);

    await fireEvent.press(view.getByText('Übernehmen'));

    // 90 -> 81 -> 80 and 100 -> 90 on the plate grid, each once and none left behind.
    await waitFor(() =>
      expect(view.getAllByLabelText('KG').map((i) => i.props.value)).toEqual(['80', '90']),
    );
  });

  it('uses 15 % after eight weeks', async () => {
    await pastSession(pressId, 60, [80]);
    const { workoutId } = await newSession([pressId]);
    const view = await openScreen(workoutId);
    expect(await view.findByText('Heute rund 15 % leichter starten?')).toBeTruthy();
    await open(view, 'Brustpresse', 1);
    await fireEvent.press(view.getByText('Übernehmen'));
    await waitFor(() => expect(view.getByLabelText('KG').props.value).toBe('67,5'));
  });

  it('leaves weights and the banner alone after Später', async () => {
    await pastSession(pressId, 16, [82.5]);
    const { workoutId } = await newSession([pressId]);
    const view = await openScreen(workoutId);
    await fireEvent.press(await view.findByText('Später'));
    await waitFor(() => expect(view.queryByText(/nicht im Gym/)).toBeNull());
    await open(view, 'Brustpresse', 1);
    expect(view.getByLabelText('KG').props.value).toBe('82,5');

    await act(async () => view.unmount());
    const again = await openScreen(workoutId);
    await again.findByLabelText('Brustpresse, Sätze aufklappen');
    expect(again.queryByText(/nicht im Gym/)).toBeNull();
  });

  it('never produces NaN or negative weights for empty and zero weights', async () => {
    await pastSession(pressId, 16, [null, 0, 2]);
    const { workoutId, wes } = await newSession([pressId]);
    const view = await openScreen(workoutId);
    await view.findByText(/nicht im Gym/);
    await open(view, 'Brustpresse', 3);
    await fireEvent.press(view.getByText('Übernehmen'));
    await waitFor(() => expect(view.getAllByLabelText('KG')[2].props.value).toBe('0'));
    expect(view.getAllByLabelText('KG').map((i) => i.props.value)).toEqual(['', '0', '0']);
    const saved = await getSetsForWorkoutExercise(db, wes[0]);
    expect(saved.map((s) => s.weightKg)).toEqual([null, 0, 0]);
  });
});
