/**
 * Theme model: a variant plus the scheme it resolves to yields one `AppTheme`
 * (colors, fonts, shape, motion). Pure — the provider only feeds it state.
 */

import type { ThemeMode } from '@/domain/types';

import { PALETTES, type ThemeColor, type ThemeColors, type ThemeVariant } from './palettes';

export type { ThemeColor, ThemeColors, ThemeVariant };

export const THEME_VARIANT_SETTING = 'theme_variant';

export interface AppTheme {
  variant: ThemeVariant;
  scheme: 'light' | 'dark';
  colors: Record<ThemeColor, string>;
  fonts: { display: string; body: string; bodyBold: string; numeric: string; label: string };
  shape: {
    radius: { sm: number; md: number; lg: number; xl: number };
    borderWidth: number;
    shadow: 'glow' | 'soft' | 'hard' | 'none';
  };
  motion: {
    spring: { damping: number; stiffness: number; mass: number };
    durationMs: { fast: number; base: number; slow: number };
    celebration: 'pill' | 'confetti' | 'starburst' | 'flash';
  };
}

const VARIANTS: ThemeVariant[] = ['evolved', 'warm', 'arcade', 'instrument'];

export function parseThemeVariant(stored: string | null): ThemeVariant {
  return VARIANTS.find((v) => v === stored) ?? 'evolved';
}

// Placeholder families until the font task bundles real ones.
const PLACEHOLDER_FONTS: AppTheme['fonts'] = {
  display: 'System',
  body: 'System',
  bodyBold: 'System',
  numeric: 'System',
  label: 'System',
};

type Style = Pick<AppTheme, 'shape' | 'motion'>;

const STYLES: Record<ThemeVariant, Style> = {
  evolved: {
    shape: { radius: { sm: 12, md: 16, lg: 20, xl: 28 }, borderWidth: 1, shadow: 'glow' },
    motion: {
      spring: { damping: 15, stiffness: 180, mass: 1 },
      durationMs: { fast: 120, base: 220, slow: 380 },
      celebration: 'pill',
    },
  },
  warm: {
    shape: { radius: { sm: 14, md: 20, lg: 26, xl: 32 }, borderWidth: 0, shadow: 'soft' },
    motion: {
      spring: { damping: 22, stiffness: 120, mass: 1 },
      durationMs: { fast: 180, base: 320, slow: 520 },
      celebration: 'confetti',
    },
  },
  arcade: {
    shape: { radius: { sm: 10, md: 14, lg: 18, xl: 22 }, borderWidth: 2.5, shadow: 'hard' },
    motion: {
      spring: { damping: 9, stiffness: 260, mass: 1 },
      durationMs: { fast: 100, base: 200, slow: 340 },
      celebration: 'starburst',
    },
  },
  instrument: {
    shape: { radius: { sm: 2, md: 3, lg: 4, xl: 6 }, borderWidth: 1, shadow: 'none' },
    motion: {
      spring: { damping: 30, stiffness: 300, mass: 1 },
      durationMs: { fast: 90, base: 180, slow: 260 },
      celebration: 'flash',
    },
  },
};

/** Only `evolved` honours the light/dark/system choice; the others are single-scheme by design. */
export function resolveTheme(
  variant: ThemeVariant,
  mode: ThemeMode,
  system: 'light' | 'dark' | null,
): AppTheme {
  let scheme: 'light' | 'dark';
  if (variant === 'instrument') scheme = 'dark';
  else if (variant !== 'evolved') scheme = 'light';
  else scheme = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;

  const colors = PALETTES[variant][scheme];
  if (!colors) throw new Error(`No ${scheme} palette for theme ${variant}`);
  return { variant, scheme, colors, fonts: PLACEHOLDER_FONTS, ...STYLES[variant] };
}

export const THEME_OPTIONS: { variant: ThemeVariant; name: string; tagline: string }[] = [
  { variant: 'evolved', name: 'Repz Evolved', tagline: 'Dunkles Glas, Indigo-Verlauf' },
  { variant: 'warm', name: 'Warm Athletic', tagline: 'Warm, ruhig, weiche Formen' },
  { variant: 'arcade', name: 'Arcade', tagline: 'Bunt, dicke Konturen, XP' },
  { variant: 'instrument', name: 'Instrument', tagline: 'Nüchtern, Daten zuerst' },
];

export type { ThemeMode };
