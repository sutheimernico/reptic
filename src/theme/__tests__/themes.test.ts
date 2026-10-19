import { PALETTES } from '../palettes';
import { parseThemeVariant, resolveTheme, THEME_OPTIONS, type ThemeVariant } from '../themes';

const VARIANTS: ThemeVariant[] = ['evolved', 'warm', 'arcade', 'instrument'];

describe('parseThemeVariant', () => {
  it('falls back to evolved for null and unknown values', () => {
    expect(parseThemeVariant(null)).toBe('evolved');
    expect(parseThemeVariant('neon')).toBe('evolved');
  });
  it('accepts a known variant', () => {
    expect(parseThemeVariant('arcade')).toBe('arcade');
  });
});

describe('resolveTheme', () => {
  it('lets evolved follow the mode', () => {
    expect(resolveTheme('evolved', 'dark', null).scheme).toBe('dark');
    expect(resolveTheme('evolved', 'system', 'dark').scheme).toBe('dark');
    expect(resolveTheme('evolved', 'system', null).scheme).toBe('light');
  });
  it('pins the single-scheme variants', () => {
    expect(resolveTheme('warm', 'dark', 'dark').scheme).toBe('light');
    expect(resolveTheme('arcade', 'dark', 'dark').scheme).toBe('light');
    expect(resolveTheme('instrument', 'light', 'light').scheme).toBe('dark');
  });
});

describe('palettes', () => {
  const reference = Object.keys(PALETTES.evolved.light!).sort();
  const color = /^(#[0-9A-Fa-f]{6}|rgba\([^)]+\))$/;
  it.each(VARIANTS)('%s defines every color token', (variant) => {
    for (const mode of ['light', 'dark'] as const) {
      const theme = resolveTheme(variant, mode, mode);
      expect(Object.keys(theme.colors).sort()).toEqual(reference);
      for (const value of Object.values(theme.colors)) expect(value).toMatch(color);
    }
  });
});

it('lists the four variants as options', () => {
  expect(THEME_OPTIONS.map((o) => o.variant)).toEqual(VARIANTS);
  expect(THEME_OPTIONS.map((o) => o.name)).toEqual([
    'Repz Evolved',
    'Warm Athletic',
    'Arcade',
    'Instrument',
  ]);
});
