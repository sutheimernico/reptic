/** Design picker in Einstellungen: persists the variant and hides the mode control for single-scheme themes. */
jest.mock('expo-sqlite', () => require('@/test-support/expo-sqlite-mock'));

import type { SQLiteDatabase } from 'expo-sqlite';

import SettingsScreen from '@/app/(tabs)/settings';
import { getSetting } from '@/db';
import { createTestDb } from '@/test-support/db';
import { fireEvent, renderWithProviders, waitFor } from '@/test-support/render';
import { resetRouter } from '@/test-support/router';

let db: SQLiteDatabase;

beforeEach(async () => {
  resetRouter();
  db = await createTestDb();
});

it('switches design, persists it and shows the mode control only for Repz Evolved', async () => {
  const view = await renderWithProviders(<SettingsScreen />);
  expect(view.getByText('Dunkel')).toBeTruthy();

  await fireEvent.press(view.getByRole('radio', { name: 'Instrument' }));
  await waitFor(async () => expect(await getSetting(db, 'theme_variant')).toBe('instrument'));
  expect(view.queryByText('Dunkel')).toBeNull();
  expect(view.getByRole('radio', { name: 'Instrument' }).props.accessibilityState.checked).toBe(
    true,
  );

  await fireEvent.press(view.getByRole('radio', { name: 'Repz Evolved' }));
  await waitFor(async () => expect(await getSetting(db, 'theme_variant')).toBe('evolved'));
  expect(view.getByText('Dunkel')).toBeTruthy();
});
