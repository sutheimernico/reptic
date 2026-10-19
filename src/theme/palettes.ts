/**
 * Color tokens per theme variant and scheme. Variant A ("evolved") keeps today's
 * palette; C/D/E come from the design mockup and are single-scheme.
 */

export type ThemeVariant = 'evolved' | 'warm' | 'arcade' | 'instrument';

export type ThemeColor =
  | 'text'
  | 'textSecondary'
  | 'background'
  | 'backgroundElement'
  | 'backgroundSelected'
  | 'card'
  | 'border'
  | 'placeholder'
  | 'accent'
  | 'accentEnd'
  | 'onAccent'
  | 'success'
  | 'danger'
  | 'accent2'
  | 'warning'
  | 'chartLine'
  | 'chartBand'
  | 'grid'
  | 'celebrate'
  | 'surfaceStrong';

export type ThemeColors = Record<ThemeColor, string>;

const evolvedLight: ThemeColors = {
  text: '#0F172A',
  textSecondary: '#64748B',
  background: '#F4F5F7',
  backgroundElement: '#FFFFFF',
  backgroundSelected: '#E0E7FF',
  card: '#FFFFFF',
  border: '#E2E8F0',
  placeholder: '#CBD5E1',
  accent: '#4F46E5',
  accentEnd: '#7C3AED',
  onAccent: '#FFFFFF',
  success: '#16A34A',
  danger: '#DC2626',
  accent2: '#7C3AED',
  warning: '#D97706',
  chartLine: '#4F46E5',
  chartBand: 'rgba(79,70,229,0.14)',
  grid: '#E2E8F0',
  celebrate: '#7C3AED',
  surfaceStrong: '#EEF0F4',
};

const evolvedDark: ThemeColors = {
  text: '#F3F5F9',
  textSecondary: '#7C8398',
  background: '#0B0D14',
  backgroundElement: '#151925',
  backgroundSelected: '#18203A',
  card: '#151925',
  border: '#232838',
  placeholder: '#454B5E',
  accent: '#6366F1',
  accentEnd: '#8B5CF6',
  onAccent: '#FFFFFF',
  success: '#3DDC84',
  danger: '#F87171',
  accent2: '#8B5CF6',
  warning: '#FBBF24',
  chartLine: '#818CF8',
  chartBand: 'rgba(99,102,241,0.22)',
  grid: '#232838',
  celebrate: '#8B5CF6',
  surfaceStrong: '#1D2232',
};

const warmLight: ThemeColors = {
  text: '#2B2521',
  textSecondary: '#8C8075',
  background: '#F3ECE2',
  backgroundElement: '#FFFBF6',
  backgroundSelected: '#F6DDD0',
  card: '#FFFBF6',
  border: '#E6DACB',
  placeholder: '#C9BCAD',
  accent: '#CF5F3F',
  accentEnd: '#E0805F',
  onAccent: '#FFFFFF',
  success: '#7C8C3C',
  danger: '#B4402E',
  accent2: '#7C8C3C',
  warning: '#D9962B',
  chartLine: '#CF5F3F',
  chartBand: 'rgba(207,95,63,0.16)',
  grid: '#E6DACB',
  celebrate: '#E0805F',
  surfaceStrong: '#EADFD0',
};

const arcadeLight: ThemeColors = {
  text: '#161616',
  textSecondary: '#6B5E48',
  background: '#FFF3DC',
  backgroundElement: '#FFFFFF',
  backgroundSelected: '#FFDDE9',
  card: '#FFFFFF',
  border: '#161616',
  placeholder: '#BDAE92',
  accent: '#FF4F8B',
  accentEnd: '#FF4F8B',
  onAccent: '#161616',
  success: '#2FD08A',
  danger: '#E5383B',
  accent2: '#3EC1FF',
  warning: '#FFCF33',
  chartLine: '#FF4F8B',
  chartBand: 'rgba(62,193,255,0.25)',
  grid: '#E8D9B8',
  celebrate: '#7B5CFF',
  surfaceStrong: '#FFE7B3',
};

const instrumentDark: ThemeColors = {
  text: '#D9DEE5',
  textSecondary: '#6B7480',
  background: '#0E1116',
  backgroundElement: '#14171C',
  backgroundSelected: '#1B2128',
  card: '#14171C',
  border: '#232830',
  placeholder: '#444C57',
  accent: '#4DD4EA',
  accentEnd: '#4DD4EA',
  onAccent: '#0E1116',
  success: '#34D399',
  danger: '#FF6B6B',
  accent2: '#F5A524',
  warning: '#F5A524',
  chartLine: '#4DD4EA',
  chartBand: 'rgba(77,212,234,0.16)',
  grid: '#232830',
  celebrate: '#4DD4EA',
  surfaceStrong: '#1B1F26',
};

export const PALETTES: Record<ThemeVariant, { light?: ThemeColors; dark?: ThemeColors }> = {
  evolved: { light: evolvedLight, dark: evolvedDark },
  warm: { light: warmLight },
  arcade: { light: arcadeLight },
  instrument: { dark: instrumentDark },
};

/** Variant A's palette — kept as `Colors` for the code that predates themes. */
export const Colors = { light: evolvedLight, dark: evolvedDark } as const;
