/**
 * The full resolved theme (colors, fonts, shape, motion). Falls back to variant A
 * for any render outside the ThemeProvider.
 */

import { useContext } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { ThemeContext } from '@/theme/theme-provider';
import { type AppTheme, resolveTheme } from '@/theme/themes';

export function useAppTheme(): AppTheme {
  const ctx = useContext(ThemeContext);
  const systemScheme = useRNColorScheme();
  if (ctx) return ctx.theme;
  return resolveTheme('evolved', 'system', systemScheme === 'dark' ? 'dark' : 'light');
}
