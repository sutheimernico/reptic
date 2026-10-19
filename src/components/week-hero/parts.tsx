/**
 * Building blocks the four hero skins share: SVG progress ring, a bar that fills
 * without animating layout, and the "Vorschlag · anpassen" link.
 */

import { useRouter } from 'expo-router';
import { useEffect, useId, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient, Pattern, Rect, Stop } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { useAppTheme } from '@/hooks/use-app-theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);

/** Ring and bar fills take a few base durations: the fill is the show-piece of the hero. */
function useFillTiming() {
  const theme = useAppTheme();
  return { duration: theme.motion.durationMs.slow * 3, easing: Easing.out(Easing.cubic) };
}

/** Progress value that eases from 0 to `target` (or sits at it with reduced motion). */
function useFill(target: number, delayMs: number) {
  const reduced = useReducedMotion();
  const timing = useFillTiming();
  const progress = useSharedValue(reduced ? target : 0);
  useEffect(() => {
    progress.value = reduced ? target : withDelay(delayMs, withTiming(target, timing));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reduced]);
  return progress;
}

/**
 * Circular progress. The fill is a dashed circle whose offset animates — the one
 * thing SVG gives us that a transform cannot.
 */
export function Ring({
  size,
  strokeWidth,
  pct,
  color,
  trackColor,
  gradient,
  delayMs = 0,
  cap = 'round',
}: {
  size: number;
  strokeWidth: number;
  pct: number;
  color: string;
  trackColor: string;
  gradient?: [string, string];
  delayMs?: number;
  cap?: 'round' | 'butt';
}) {
  const gradientId = useId().replace(/:/g, '');
  const half = size / 2;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = useFill(pct, delayMs);
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    // Start at 12 o'clock: rotate the whole canvas (a plain view transform; SVG's own origin prop
    // is not valid on web).
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={styles.ring}>
      {gradient ? (
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={gradient[0]} />
            <Stop offset="1" stopColor={gradient[1]} />
          </LinearGradient>
        </Defs>
      ) : null}
      <Circle cx={half} cy={half} r={r} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
      {pct > 0 ? (
        <AnimatedCircle
          cx={half}
          cy={half}
          r={r}
          stroke={gradient ? `url(#${gradientId})` : color}
          strokeWidth={strokeWidth}
          strokeLinecap={cap}
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
          fill="none"
        />
      ) : null}
    </Svg>
  );
}

/**
 * Horizontal bar. The fill is full width and slides in with translateX, so only a
 * transform animates and a striped fill keeps its stripes at any percentage.
 */
export function Bar({
  pct,
  height,
  radius,
  fillColor,
  trackColor,
  borderColor,
  borderWidth = 0,
  striped = false,
  delayMs = 0,
  style,
}: {
  pct: number;
  height: number;
  radius: number;
  fillColor: string;
  trackColor: string;
  borderColor?: string;
  borderWidth?: number;
  striped?: boolean;
  delayMs?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [width, setWidth] = useState(0);
  const progress = useFill(pct, delayMs);
  const inner = Math.max(0, width - borderWidth * 2);
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (progress.value - 1) * inner }],
  }));
  const stripeId = useId().replace(/:/g, '');

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[
        {
          height,
          borderRadius: radius,
          backgroundColor: trackColor,
          borderColor,
          borderWidth,
          overflow: 'hidden',
        },
        style,
      ]}>
      {pct > 0 && inner > 0 ? (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: fillColor,
              borderRightWidth: borderWidth,
              borderRightColor: borderColor,
            },
            fillStyle,
          ]}>
          {striped ? (
            <Svg width="100%" height="100%">
              <Defs>
                <Pattern
                  id={stripeId}
                  patternUnits="userSpaceOnUse"
                  width={16}
                  height={16}
                  patternTransform="rotate(45)">
                  <Rect width={8} height={16} fill="rgba(255,255,255,0.3)" />
                </Pattern>
              </Defs>
              <Rect width="100%" height="100%" fill={`url(#${stripeId})`} />
            </Svg>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

/** One tick of the instrument gauge; lit ticks switch on one after another. */
export function GaugeTick({
  x1, y1, x2, y2, lit, tip, index, litColor, tipColor, offColor,
}: {
  x1: number; y1: number; x2: number; y2: number;
  lit: boolean; tip: boolean; index: number;
  litColor: string; tipColor: string; offColor: string;
}) {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(lit && !reduced ? 0.1 : 1);
  useEffect(() => {
    if (lit && !reduced) opacity.value = withDelay(200 + index * 22, withTiming(1, { duration: 180 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const animatedProps = useAnimatedProps(() => ({ opacity: opacity.value }));
  return (
    <AnimatedLine
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={lit ? (tip ? tipColor : litColor) : offColor}
      strokeWidth={4}
      animatedProps={animatedProps}
    />
  );
}

/** "Vorschlag · anpassen": the goal is only a suggestion, a tap opens the settings to set it. */
export function GoalHint({ visible, color }: { visible: boolean; color?: string }) {
  const router = useRouter();
  if (!visible) return null;
  return (
    <Pressable
      onPress={() => router.push('/settings')}
      accessibilityRole="link"
      accessibilityLabel="Wochenziel ist ein Vorschlag, in den Einstellungen anpassen"
      hitSlop={8}>
      <ThemedText type="small" variant="label" style={[styles.hint, color ? { color } : null]}>
        Vorschlag · anpassen
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: { transform: [{ rotate: '-90deg' }] },
  hint: { fontSize: 12, textDecorationLine: 'underline' },
});
