import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AutoBackupOnStart } from '@/components/auto-backup-on-start';
import { AnimatedSplashOverlay } from '@/components/splash-overlay';
import { DATABASE_NAME } from '@/constants/app';
import { migrateDbIfNeeded } from '@/db';
import { ThemeProvider, useThemeMode } from '@/theme/theme-provider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    // Required for react-native-gesture-handler; without it swipe gestures
    // (e.g. swipe-to-delete in a session) silently do nothing.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded}>
        <ThemeProvider>
          <AutoBackupOnStart />
          <ThemedNavigation />
        </ThemeProvider>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}

function ThemedNavigation() {
  const { scheme, colors } = useThemeMode();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
    },
  };
  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }} />
    </NavThemeProvider>
  );
}
