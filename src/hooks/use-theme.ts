/**
 * Resolved color tokens for the current theme. Reads the ThemeProvider when present
 * (respecting the persisted system/light/dark override); falls back to the raw system
 * scheme for any render that happens before the provider mounts.
 *
 * Learn more: https://docs.expo.dev/guides/color-schemes/
 */

import { useContext } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { type ThemeColors, ThemeContext } from '@/theme/theme-provider';

export function useTheme(): ThemeColors {
  const ctx = useContext(ThemeContext);
  const systemScheme = useRNColorScheme();
  if (ctx) return ctx.colors;
  return Colors[systemScheme === 'dark' ? 'dark' : 'light'];
}
