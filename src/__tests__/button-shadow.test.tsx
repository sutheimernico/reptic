/**
 * Arcade on Android draws its hard shadow as an ink block behind the surface. Secondary
 * buttons are transparent and disabled ones faded, so the block must not be there for them —
 * on the phone it showed through as a dark offset slab (Duell, Einstellungen).
 */
jest.mock('expo-sqlite', () => require('@/test-support/expo-sqlite-mock'));

import { useEffect } from 'react';
import { Platform } from 'react-native';

import { Button } from '@/components/ui/button';
import { createTestDb } from '@/test-support/db';
import { act, renderWithProviders } from '@/test-support/render';
import { type ThemeContextValue, useThemeMode } from '@/theme/theme-provider';

const probe: { theme: ThemeContextValue | null } = { theme: null };

function Probe() {
  const theme = useThemeMode();
  useEffect(() => {
    probe.theme = theme;
  });
  return null;
}

const original = Platform.OS;
beforeEach(async () => {
  await createTestDb();
  Platform.OS = 'android';
});
afterEach(() => {
  Platform.OS = original;
});

it('frames only primary, enabled buttons in arcade on Android', async () => {
  const view = await renderWithProviders(
    <>
      <Button label="Teilen" onPress={() => {}} />
      <Button label="Importieren" variant="secondary" onPress={() => {}} />
      <Button label="Gesperrt" disabled onPress={() => {}} />
      <Probe />
    </>,
  );
  await act(async () => probe.theme?.setVariant('arcade'));
  expect(view.getAllByTestId('hard-shadow')).toHaveLength(1);

  await act(async () => probe.theme?.setVariant('warm'));
  expect(view.queryAllByTestId('hard-shadow')).toHaveLength(0);
});
