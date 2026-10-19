import { Platform, type ViewStyle } from 'react-native';

import type { AppTheme } from './themes';

/** True where the hard shadow needs an offset View behind the surface (Android ignores shadowOffset). */
export function hardShadowNeedsView(theme: AppTheme): boolean {
  return Platform.OS === 'android' && theme.shape.shadow === 'hard';
}
export const HARD_SHADOW_OFFSET = 3;

/** Per-theme shadow for a surface; hard shadows on Android are drawn by `ShadowFrame` instead. */
export function shadowStyle(theme: AppTheme): ViewStyle {
  const { colors, shape } = theme;
  switch (shape.shadow) {
    case 'glow':
      return {
        shadowColor: colors.accent,
        shadowOpacity: theme.scheme === 'dark' ? 0.18 : 0.1,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 4 },
        elevation: 0,
      };
    case 'soft':
      return {
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      };
    case 'hard':
      return {
        shadowColor: colors.border,
        shadowOffset: { width: HARD_SHADOW_OFFSET, height: HARD_SHADOW_OFFSET },
        shadowOpacity: 1,
        shadowRadius: 0,
        elevation: 0,
      };
    default:
      return {};
  }
}
