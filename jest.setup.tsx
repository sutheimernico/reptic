/**
 * Global test setup: replaces the native modules a screen touches but that a
 * component test has no business driving. The database is NOT mocked — see
 * `src/test-support/db.ts`.
 */
// Haptics reach the vibration motor; there is nothing to assert and nothing to
// drive, so they become no-ops that still let the call sites run.
jest.mock('expo-haptics', () => ({
  AndroidHaptics: { Confirm: 'confirm', Long_Press: 'long-press' },
  performAndroidHapticsAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-router', () => {
  const React = require('react');
  const { getRouteParams, routerMock } = require('@/test-support/router');
  return {
    // useFocusEffect is the screens' "load your data" hook; in a test the
    // screen is always focused, so it is just an effect.
    useFocusEffect: (callback: () => void | (() => void)) => React.useEffect(callback, [callback]),
    useIsFocused: () => true,
    useRouter: () => routerMock,
    useNavigation: () => ({ addListener: jest.fn(() => jest.fn()), dispatch: jest.fn() }),
    useLocalSearchParams: () => getRouteParams(),
    Stack: { Screen: () => null },
    Link: ({ children }: { children: unknown }) => children,
  };
});

// Reanimated's worklet runtime does not exist under Jest; components render in their end state.
jest.mock('react-native-reanimated', () => require('@/test-support/reanimated-mock'));
