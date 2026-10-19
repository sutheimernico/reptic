/** Font loading must never block the app: an error logs once and the layout still renders. */
import { render } from '@testing-library/react-native';

const mockUseFonts = jest.fn();

jest.mock('expo-font', () => ({
  useFonts: (...args: unknown[]) => mockUseFonts(...args),
}));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('expo-sqlite', () => ({
  SQLiteProvider: ({ children }: { children: unknown }) => children,
}));
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: { children: unknown }) => children,
}));
jest.mock('@/components/app-bootstrap', () => ({ AppBootstrap: () => null }));
jest.mock('@/components/rest-timer', () => ({
  RestTimerProvider: ({ children }: { children: unknown }) => children,
}));
jest.mock('@/components/splash-overlay', () => ({
  AnimatedSplashOverlay: () => null,
}));
jest.mock('@/lib/web-alert', () => ({ installWebAlert: jest.fn() }));
jest.mock('@/theme/theme-provider', () => ({
  ThemeProvider: ({ children }: { children: unknown }) => children,
  useThemeMode: () => ({
    theme: require('@/theme/themes').resolveTheme('evolved', 'light', null),
  }),
}));
jest.mock('expo-router', () => {
  const { Text: T } = require('react-native');
  return {
    DarkTheme: { colors: {} },
    DefaultTheme: { colors: {} },
    ThemeProvider: ({ children }: { children: unknown }) => children,
    Stack: () => <T>app-stack</T>,
  };
});

import RootLayout from '@/app/_layout';

afterEach(() => jest.restoreAllMocks());

it('renders nothing while fonts are loading', async () => {
  mockUseFonts.mockReturnValue([false, null]);
  const view = await render(<RootLayout />);
  expect(view.queryByText('app-stack')).toBeNull();
});

it('still renders the app and warns once when font loading fails', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockUseFonts.mockReturnValue([false, new Error('boom')]);
  const view = await render(<RootLayout />);
  expect(view.getByText('app-stack')).toBeTruthy();
  expect(warn).toHaveBeenCalledTimes(1);
});
