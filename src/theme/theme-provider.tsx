/**
 * Theme context: resolves the system color scheme, allows a manual override
 * (system / light / dark) persisted in the SQLite `settings` table, and exposes
 * the resolved color tokens. `useTheme()` (in @/hooks/use-theme) reads the colors
 * from here; screens that toggle the theme use `useThemeMode()`.
 */

import { useSQLiteContext } from 'expo-sqlite';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { getSetting, setSetting } from '@/db';
import type { ThemeMode } from '@/domain/types';

import {
  type AppTheme,
  parseThemeVariant,
  resolveTheme,
  THEME_VARIANT_SETTING,
  type ThemeColors,
  type ThemeVariant,
} from './themes';

export type { ThemeColors };

export interface ThemeContextValue {
  mode: ThemeMode;
  variant: ThemeVariant;
  scheme: 'light' | 'dark';
  theme: AppTheme;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
  setVariant: (variant: ThemeVariant) => void;
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
  const [variant, setVariantState] = useState<ThemeVariant>('evolved');

  // Hydrate the persisted override once the db is available.
  useEffect(() => {
    let active = true;
    getSetting(db, THEME_SETTING_KEY).then((value) => {
      if (active && isThemeMode(value)) setModeState(value);
    });
    getSetting(db, THEME_VARIANT_SETTING).then((value) => {
      if (active) setVariantState(parseThemeVariant(value));
    });
    return () => {
      active = false;
    };
  }, [db]);

  const theme = resolveTheme(variant, mode, systemScheme === 'dark' ? 'dark' : 'light');

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    void setSetting(db, THEME_SETTING_KEY, next);
  };

  const setVariant = (next: ThemeVariant) => {
    setVariantState(next);
    void setSetting(db, THEME_VARIANT_SETTING, next);
  };

  return (
    <ThemeContext.Provider
      value={{ mode, variant, scheme: theme.scheme, theme, colors: theme.colors, setMode, setVariant }}>
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
