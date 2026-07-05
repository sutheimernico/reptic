import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
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
  const { scheme } = useThemeMode();
  return (
    <NavThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </NavThemeProvider>
  );
}
