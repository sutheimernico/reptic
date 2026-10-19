import { type ReactNode, useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '@/hooks/use-app-theme';
import { MAX_STAGGERED_ITEMS, springFor, staggerDelay, timingFor } from '@/theme/motion';

const RISE_PX = 10;

/**
 * Entrance for one list row: fade in and rise a few pixels, staggered by index.
 * It plays once, when the row mounts. Rows past the stagger cap render at rest, so
 * a virtualised list scrolling new rows into view stays calm.
 */
export function FadeInListItem({
  index,
  children,
  style,
}: {
  index: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  const reduced = useReducedMotion();
  const animated = index < MAX_STAGGERED_ITEMS;
  const opacity = useSharedValue(animated ? 0 : 1);
  const rise = useSharedValue(animated && !reduced ? RISE_PX : 0);

  // Mount-only on purpose: a theme switch or a re-render must not replay the entrance.
  useEffect(() => {
    if (!animated) return;
    const delay = staggerDelay(index, theme);
    opacity.value = withDelay(delay, withTiming(1, timingFor(theme, 'base')));
    if (!reduced) rise.value = withDelay(delay, withSpring(0, springFor(theme)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: rise.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
