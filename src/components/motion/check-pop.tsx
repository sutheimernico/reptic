import { type ReactNode, useEffect, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '@/hooks/use-app-theme';
import { springFor } from '@/theme/motion';

/**
 * Wraps a checkbox: pops it when it turns checked. Mounting already checked, or
 * un-checking, does nothing — only a fresh tick is worth a flourish.
 */
export function CheckPop({
  checked,
  children,
  style,
}: {
  checked: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const wasChecked = useRef(checked);

  useEffect(() => {
    if (checked && !wasChecked.current && !reduced) {
      const peak = theme.variant === 'arcade' ? 1.35 : 1.18;
      scale.value = withSequence(
        withTiming(peak, { duration: theme.motion.durationMs.fast }),
        withSpring(1, springFor(theme)),
      );
    }
    wasChecked.current = checked;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
