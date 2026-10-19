import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { ThemeColor } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { applyFontFamily } from '@/theme/typography';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'small' | 'smallBold';
  /** Picks the theme's display / numeric (tabular) / label family instead of the body one. */
  variant?: 'display' | 'numeric' | 'label';
  themeColor?: ThemeColor;
};

export function ThemedText({
  style,
  type = 'default',
  variant,
  themeColor,
  ...rest
}: ThemedTextProps) {
  const { colors, fonts } = useAppTheme();

  const flat = StyleSheet.flatten([
    { color: colors[themeColor ?? 'text'] },
    type === 'default' && styles.default,
    type === 'small' && styles.small,
    type === 'smallBold' && styles.smallBold,
    style,
  ]) as TextStyle;

  return <Text style={applyFontFamily(fonts, flat, variant)} {...rest} />;
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
});
