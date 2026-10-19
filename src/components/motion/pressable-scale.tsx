import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useAppTheme } from '@/hooks/use-app-theme';
import { springFor } from '@/theme/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Arcade presses harder (chunky buttons), everyone else just dips. */
function pressedScale(variant: string): number {
  return variant === 'arcade' ? 0.94 : 0.97;
}

/** A Pressable that springs down while held. With reduced motion it does not move. */
export function PressableScale({
  style,
  onPressIn,
  onPressOut,
  ...rest
}: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> }) {
  const theme = useAppTheme();
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        if (!reduced) scale.set(withSpring(pressedScale(theme.variant), springFor(theme)));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!reduced) scale.set(withSpring(1, springFor(theme)));
        onPressOut?.(e);
      }}
      style={[style, animatedStyle]}
    />
  );
}
