/**
 * Finishing a session: it is written as finished and the summary takes the
 * session screen's place. Runs against real SQLite.
 */
jest.mock('expo-sqlite', () => require('@/test-support/expo-sqlite-mock'));
// The drag and swipe libraries pull in Reanimated's native worklet runtime,
// which does not exist under Jest. Neither is what this test is about: a plain
// FlatList and a pass-through stand in for them.
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
import { createGym, getWorkout, startWorkout } from '@/db';
import { pressAlertButton, spyOnAlert } from '@/test-support/alert';
import { createTestDb } from '@/test-support/db';
import { fireEvent, renderWithProviders, waitFor } from '@/test-support/render';
import { resetRouter, routerMock, setRouteParams } from '@/test-support/router';

let db: SQLiteDatabase;

beforeEach(async () => {
  resetRouter();
  db = await createTestDb();
});

it('finishes the session and replaces it with the fresh summary', async () => {
  const gymId = await createGym(db, 'Quakenbrück');
  const workoutId = await startWorkout(db, [], gymId, new Date().toISOString());
  setRouteParams({ id: String(workoutId) });
  const alert = spyOnAlert();

  const view = await renderWithProviders(<SessionScreen />);
  await fireEvent.press(view.getByText('Einheit beenden'));
  await pressAlertButton(alert, 'Beenden');

  await waitFor(() =>
    expect(routerMock.replace).toHaveBeenCalledWith({
      pathname: '/workout/summary',
      params: { id: String(workoutId), fresh: '1' },
    }),
  );
  expect((await getWorkout(db, workoutId))?.finishedAt).not.toBeNull();
  expect(routerMock.back).not.toHaveBeenCalled();
  alert.mockRestore();
});
