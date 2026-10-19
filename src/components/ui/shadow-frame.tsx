import { type ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';
import { HARD_SHADOW_OFFSET, hardShadowNeedsView } from '@/theme/shape';

/**
 * Android has no hard (zero-blur) shadow, so the arcade theme gets an offset View in
 * the border colour behind the surface. A no-op for every other theme and platform.
 */
export function ShadowFrame({
  children,
  radius,
  style,
}: {
  children: ReactNode;
  radius: number;
  /** Layout style for the frame; only applied while the frame is active. */
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  if (!hardShadowNeedsView(theme)) return <>{children}</>;
  return (
    <View style={[styles.frame, style]}>
      <View
        pointerEvents="none"
        style={[styles.offset, { backgroundColor: theme.colors.border, borderRadius: radius }]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { marginRight: HARD_SHADOW_OFFSET, marginBottom: HARD_SHADOW_OFFSET },
  offset: {
    ...StyleSheet.absoluteFill,
    top: HARD_SHADOW_OFFSET,
    left: HARD_SHADOW_OFFSET,
    right: -HARD_SHADOW_OFFSET,
    bottom: -HARD_SHADOW_OFFSET,
  },
});
