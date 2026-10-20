/**
 * Reaching the weekly kg goal while logging celebrates once — then never again
 * this week. Against real SQLite; see `session-exercise.test` for the setup.
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

jest.mock('@/db/week-stats', () => {
  const actual = jest.requireActual('@/db/week-stats');
  return { ...actual, getWeekProgress: jest.fn(actual.getWeekProgress) };
});

import type { SQLiteDatabase } from 'expo-sqlite';

import SessionScreen from '@/app/session/[id]';
import { addWorkoutExercise, createExercise, createGym, getSetting, setSetting, startWorkout } from '@/db';
import { getWeekProgress } from '@/db/week-stats';
import { isoWeekKey, isoWeekOf } from '@/domain/weeks';
import { createTestDb } from '@/test-support/db';
import { fireEvent, renderWithProviders, waitFor } from '@/test-support/render';
import { resetRouter, setRouteParams } from '@/test-support/router';

let db: SQLiteDatabase;

beforeEach(async () => {
  jest.clearAllMocks();
  resetRouter();
  db = await createTestDb();
});

async function openSession() {
  const gymId = await createGym(db, 'Quakenbrück');
  const exerciseId = await createExercise(db, 'Bankdrücken', 'Brust');
  const workoutId = await startWorkout(db, [], gymId, new Date().toISOString());
  await addWorkoutExercise(db, workoutId, exerciseId);
  setRouteParams({ id: String(workoutId) });
  const view = await renderWithProviders(<SessionScreen />);
  await fireEvent.press(await view.findByLabelText('Bankdrücken, Sätze aufklappen'));
  await waitFor(() => expect(view.getByLabelText('Satz 1 erledigt')).toBeTruthy());
  return view;
}

describe('week goal celebration in the session', () => {
  it('celebrates when the tick crosses the kg goal and remembers it', async () => {
    await setSetting(db, 'week_goal_kg', '500');
    const view = await openSession();

    await fireEvent.changeText(view.getByLabelText('KG'), '60');
    await fireEvent.changeText(view.getByLabelText('WDH'), '10'); // 600 kg > 500
    await fireEvent.press(view.getByLabelText('Satz 1 erledigt'));

    await waitFor(() => expect(view.getByText('Wochenziel geschafft')).toBeTruthy());
    const flags = await db.getAllAsync<{ key: string }>("SELECT key FROM settings WHERE key LIKE 'celebrated_kg_%'");
    expect(flags).toHaveLength(1);
    expect(await getSetting(db, flags[0].key)).toBe('1');
  });

  it('stays quiet below the goal', async () => {
    await setSetting(db, 'week_goal_kg', '5000');
    const view = await openSession();

    await fireEvent.changeText(view.getByLabelText('KG'), '60');
    await fireEvent.changeText(view.getByLabelText('WDH'), '10');
    await fireEvent.press(view.getByLabelText('Satz 1 erledigt'));

    await waitFor(() => expect(view.getByLabelText('Satz 1 erledigt').props.accessibilityState.checked).toBe(true));
    expect(view.queryByText('Wochenziel geschafft')).toBeNull();
  });

  it('does not look at the week again once both goals are celebrated', async () => {
    await setSetting(db, 'week_goal_kg', '500');
    const view = await openSession();
    const week = isoWeekKey(isoWeekOf(new Date()));
    await setSetting(db, `celebrated_kg_${week}`, '1');
    await setSetting(db, `celebrated_km_${week}`, '1');
    (getWeekProgress as jest.Mock).mockClear();

    await fireEvent.changeText(view.getByLabelText('KG'), '60');
    await fireEvent.changeText(view.getByLabelText('WDH'), '10');
    await fireEvent.press(view.getByLabelText('Satz 1 erledigt'));

    await waitFor(() => expect(view.getByLabelText('Satz 1 erledigt').props.accessibilityState.checked).toBe(true));
    expect(getWeekProgress).not.toHaveBeenCalled();
  });

  it('re-checks once after a tick that arrived while a check was in flight', async () => {
    await setSetting(db, 'week_goal_kg', '500');
    const view = await openSession();
    const actual = jest.requireActual('@/db/week-stats').getWeekProgress;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    (getWeekProgress as jest.Mock).mockClear();
    (getWeekProgress as jest.Mock).mockImplementationOnce(async (...args: unknown[]) => {
      await gate;
      return actual(...args);
    });

    await fireEvent.changeText(view.getByLabelText('KG'), '60');
    await fireEvent.changeText(view.getByLabelText('WDH'), '10');
    await fireEvent.press(view.getByLabelText('Satz 1 erledigt')); // check A starts, blocked on the gate
    await waitFor(() => expect(getWeekProgress).toHaveBeenCalledTimes(1));
    await fireEvent.press(view.getByLabelText('Satz 1 erledigt')); // untick while A is in flight
    expect(getWeekProgress).toHaveBeenCalledTimes(1); // not run concurrently

    release();
    await waitFor(() => expect(getWeekProgress).toHaveBeenCalledTimes(2)); // the follow-up run
  });
});
