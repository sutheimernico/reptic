import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';
import { HARD_SHADOW_NEEDS_VIEW, HARD_SHADOW_OFFSET } from '@/theme/shape';

/**
 * Android has no hard (zero-blur) shadow, so the arcade theme gets an offset View in
 * the border colour behind the surface. A no-op for every other theme and platform.
 */
export function ShadowFrame({ children, radius }: { children: ReactNode; radius: number }) {
  const { colors, shape } = useAppTheme();
  if (!(HARD_SHADOW_NEEDS_VIEW && shape.shadow === 'hard')) return <>{children}</>;
  return (
    <View style={styles.frame}>
      <View
        pointerEvents="none"
        style={[styles.offset, { backgroundColor: colors.border, borderRadius: radius }]}
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
