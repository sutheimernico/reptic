/**
 * The skinned tab bars: same five tabs, same accessible names and selected state in every
 * variant, press goes through react-navigation, and the layout honours reduced motion.
 */
jest.mock('expo-sqlite', () => require('@/test-support/expo-sqlite-mock'));
let mockTabsProps: { screenOptions?: { animation?: string } } = {};
jest.mock('expo-router', () => ({
  Tabs: Object.assign(
    (props: typeof mockTabsProps) => {
      mockTabsProps = props;
      return null;
    },
    { Screen: () => null },
  ),
}));

import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import TabsLayout from '@/app/(tabs)/_layout';
import { TabBar } from '@/components/tab-bar';
import type { TabBarProps } from '@/components/tab-bar/shared';
import { createTestDb } from '@/test-support/db';
import { act, fireEvent, renderWithProviders } from '@/test-support/render';
import { type ThemeContextValue, useThemeMode } from '@/theme/theme-provider';
import type { ThemeVariant } from '@/theme/themes';

const TITLES = ['Heute', 'Pläne', 'Übungen', 'Verlauf', 'Einstellungen'];
const probe: { theme: ThemeContextValue | null } = { theme: null };
const reanimated = require('react-native-reanimated') as { __setReducedMotion: (v: boolean) => void };

function Probe() {
  const theme = useThemeMode();
  useEffect(() => {
    probe.theme = theme;
  });
  return null;
}

function props(activeIndex: number) {
  const navigate = jest.fn();
  const routes = TITLES.map((t, i) => ({ key: `k${i}`, name: `r${i}`, params: undefined, title: t }));
  const barProps = {
    state: { index: activeIndex, routes },
    descriptors: Object.fromEntries(
      routes.map((r) => [r.key, { options: { title: r.title, tabBarIcon: () => null } }]),
    ),
    navigation: { emit: jest.fn(() => ({ defaultPrevented: false })), navigate },
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  } as unknown as TabBarProps;
  return { barProps, navigate };
}

beforeEach(async () => {
  await createTestDb();
  reanimated.__setReducedMotion(false);
});
afterAll(() => reanimated.__setReducedMotion(false));

describe('tab bar variants', () => {
  it.each<ThemeVariant>(['evolved', 'warm', 'arcade', 'instrument'])(
    '%s keeps names, selected state and press behaviour',
    async (variant) => {
      const { barProps, navigate } = props(1);
      const view = await renderWithProviders(
        <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
          <TabBar {...barProps} />
          <Probe />
        </SafeAreaProvider>,
      );
      await act(async () => probe.theme?.setVariant(variant));
      await fireEvent(view.getAllByRole('tab')[0], 'layout', {
        nativeEvent: { layout: { width: 360, height: 66 } },
      });

      const tabs = view.getAllByRole('tab');
      expect(tabs).toHaveLength(5);
      TITLES.forEach((title, i) => {
        expect(tabs[i].props.accessibilityLabel).toBe(title);
        expect(tabs[i].props.accessibilityState).toMatchObject({ selected: i === 1 });
      });
      await fireEvent.press(view.getByLabelText('Übungen'));
      expect(navigate).toHaveBeenCalledWith('r2', undefined);
    },
  );
});

describe('tab layout reduced motion', () => {
  it('fades screens on a tab switch, and not at all with reduced motion', async () => {
    await renderWithProviders(<TabsLayout />);
    expect(mockTabsProps.screenOptions?.animation).toBe('fade');

    reanimated.__setReducedMotion(true);
    await renderWithProviders(<TabsLayout />);
    expect(mockTabsProps.screenOptions?.animation).toBe('none');
  });
});
