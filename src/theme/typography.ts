import type { TextStyle } from 'react-native';

import type { AppTheme } from './themes';

type Fonts = AppTheme['fonts'];

/** Bundled families carry their weight in the file, so a numeric weight picks a family instead. */
export function bodyFamily(fonts: Fonts, bold: boolean): string {
  return bold ? fonts.bodyBold : fonts.body;
}

/** Splits `fontWeight` off a flattened text style and swaps it for the matching family. */
export function applyFontFamily(
  fonts: Fonts,
  style: TextStyle,
  variant?: 'display' | 'numeric' | 'label',
): TextStyle {
  const { fontWeight, ...rest } = style;
  const weight = fontWeight === 'bold' ? 700 : Number(fontWeight ?? 400);
  if (variant === 'display') return { ...rest, fontFamily: fonts.display };
  if (variant === 'numeric') {
    return { ...rest, fontFamily: fonts.numeric, fontVariant: ['tabular-nums'] };
  }
  if (variant === 'label') return { ...rest, fontFamily: fonts.label };
  return { ...rest, fontFamily: bodyFamily(fonts, weight >= 600) };
}
