/**
 * Switching the theme while a session is open must not cost the user anything:
 * typed values stay, the set rows stay, the rest timer keeps running.
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
import { useEffect } from 'react';

import SessionScreen from '@/app/session/[id]';
import { addWorkoutExercise, createExercise, createGym, startWorkout } from '@/db';
import { createTestDb } from '@/test-support/db';
import { act, fireEvent, renderWithProviders, waitFor } from '@/test-support/render';
import { resetRouter, setRouteParams } from '@/test-support/router';
import { type ThemeContextValue, useThemeMode } from '@/theme/theme-provider';

let db: SQLiteDatabase;
const probe: { theme: ThemeContextValue | null } = { theme: null };

function ThemeProbe() {
  const theme = useThemeMode();
  useEffect(() => {
    probe.theme = theme;
  });
  return null;
}

beforeEach(async () => {
  resetRouter();
  db = await createTestDb();
  const gymId = await createGym(db, 'Quakenbrück');
  const exerciseId = await createExercise(db, 'Bankdrücken', 'Brust');
  const workoutId = await startWorkout(db, [], gymId, '2026-08-09T10:00:00.000Z');
  await addWorkoutExercise(db, workoutId, exerciseId);
  setRouteParams({ id: String(workoutId) });
});

describe('theme switch inside a running session', () => {
  it('keeps typed input, the set row and the rest timer', async () => {
    const view = await renderWithProviders(
      <>
        <SessionScreen />
        <ThemeProbe />
      </>,
    );
    await fireEvent.press(await view.findByLabelText('Bankdrücken, Sätze aufklappen'));
    await waitFor(() => expect(view.getByLabelText('Satz 1 erledigt')).toBeTruthy());

    await fireEvent.changeText(view.getByLabelText('KG'), '82,5');
    await fireEvent.press(view.getByLabelText('Satz 1 erledigt')); // starts the rest timer
    await waitFor(() => expect(view.getByLabelText(/^Pause, noch/)).toBeTruthy());

    await act(async () => probe.theme?.setVariant('arcade'));

    expect(probe.theme?.variant).toBe('arcade');
    expect(view.getByLabelText('KG').props.value).toBe('82,5');
    expect(view.getByLabelText('Satz 1 erledigt')).toBeTruthy();
    expect(view.getByLabelText(/^Pause, noch/)).toBeTruthy();
  });
});
