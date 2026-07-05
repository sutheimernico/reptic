/**
 * Theme context: resolves the system color scheme, allows a manual override
 * (system / light / dark) persisted in the SQLite `settings` table, and exposes
 * the resolved color tokens. `useTheme()` (in @/hooks/use-theme) reads the colors
 * from here; screens that toggle the theme use `useThemeMode()`.
 */

import { useSQLiteContext } from 'expo-sqlite';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { Colors, type ThemeColor } from '@/constants/theme';
import { getSetting, setSetting } from '@/db';
import type { ThemeMode } from '@/domain/types';

type ResolvedScheme = 'light' | 'dark';

/** Widened token map (the `as const` palette has per-hex literal types otherwise). */
export type ThemeColors = Record<ThemeColor, string>;

export interface ThemeContextValue {
  mode: ThemeMode;
  scheme: ResolvedScheme;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_SETTING_KEY = 'theme_mode';

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const systemScheme = useRNColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  // Hydrate the persisted override once the db is available.
  useEffect(() => {
    let active = true;
    getSetting(db, THEME_SETTING_KEY).then((value) => {
      if (active && isThemeMode(value)) setModeState(value);
    });
    return () => {
      active = false;
    };
  }, [db]);

  const scheme: ResolvedScheme =
    mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    void setSetting(db, THEME_SETTING_KEY, next);
  };

  return (
    <ThemeContext.Provider value={{ mode, scheme, colors: Colors[scheme], setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Full theme control — requires the ThemeProvider. Used by the settings toggle. */
export function useThemeMode(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode must be used within a ThemeProvider');
  return ctx;
}
