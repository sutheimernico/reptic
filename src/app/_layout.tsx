import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { DATABASE_NAME } from '@/constants/app';
import { migrateDbIfNeeded } from '@/db';
import { ThemeProvider, useThemeMode } from '@/theme/theme-provider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded}>
      <ThemeProvider>
        <ThemedNavigation />
      </ThemeProvider>
    </SQLiteProvider>
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
