/**
 * Native-stack header look per theme. Screens only set a title; background, tint,
 * title font and the bottom rule come from here so all four themes stay consistent.
 */

import type { NativeStackNavigationOptions } from 'expo-router';

import type { AppTheme } from './themes';

export function stackHeaderOptions(theme: AppTheme): NativeStackNavigationOptions {
  const { colors, fonts, variant, shape } = theme;
  // Instrument reads as a panel; warm and arcade sit on the page colour so the header is not a slab.
  const backgroundColor =
    variant === 'warm' || variant === 'arcade' ? colors.background : colors.card;
  const titleFont =
    variant === 'instrument' ? fonts.label : variant === 'evolved' ? fonts.bodyBold : fonts.display;
  return {
    headerStyle: {
      backgroundColor,
      // Web only; native stacks ignore the border props and use the shadow switch below.
      ...(shape.borderWidth > 0 && {
        borderBottomColor: colors.border,
        borderBottomWidth: shape.borderWidth,
      }),
    } as NativeStackNavigationOptions['headerStyle'],
    headerShadowVisible: false,
    headerTintColor: variant === 'arcade' || variant === 'warm' ? colors.text : colors.accent,
    headerTitleStyle: {
      fontFamily: titleFont,
      color: colors.text,
      fontSize: variant === 'instrument' ? 15 : 18,
    },
  };
}
