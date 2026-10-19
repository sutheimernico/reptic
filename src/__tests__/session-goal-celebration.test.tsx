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

import type { SQLiteDatabase } from 'expo-sqlite';

import SessionScreen from '@/app/session/[id]';
import { addWorkoutExercise, createExercise, createGym, getSetting, setSetting, startWorkout } from '@/db';
import { createTestDb } from '@/test-support/db';
import { fireEvent, renderWithProviders, waitFor } from '@/test-support/render';
import { resetRouter, setRouteParams } from '@/test-support/router';

let db: SQLiteDatabase;

beforeEach(async () => {
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
});
