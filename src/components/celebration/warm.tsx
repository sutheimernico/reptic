/** Variant C — confetti dots drift out and settle, a soft label sits in the middle. */
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useAppTheme } from '@/hooks/use-app-theme';

import { type SkinProps, useTimeline } from './timeline';

const DOTS = 16;

function Dot({ t, index, color }: { t: SharedValue<number>; index: number; color: string }) {
  const angle = (index / DOTS) * Math.PI * 2 + 0.2;
  const reach = 70 + (index % 3) * 26;
  const dx = Math.cos(angle) * reach;
  const dy = Math.sin(angle) * reach * 0.7 - 12;
  const lag = (index % 4) * 0.03;
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [lag, lag + 0.04, 0.7, 1], [0, 1, 1, 0], 'clamp'),
    transform: [
      { translateX: interpolate(t.value, [lag, 0.5], [0, dx], 'clamp') },
      { translateY: interpolate(t.value, [lag, 0.45, 1], [0, dy, dy + 80], 'clamp') },
      { scale: interpolate(t.value, [lag, lag + 0.1], [0.3, 1], 'clamp') },
    ],
  }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

export function WarmCelebration({ label }: SkinProps) {
  const { colors: c } = useAppTheme();
  const t = useTimeline();
  const palette = [c.accent, c.accent2, c.warning, c.accentEnd, '#5C7C8A'];
  const card = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.12, 0.8, 1], [0, 1, 1, 0], 'clamp'),
    transform: [{ translateY: interpolate(t.value, [0, 0.3], [10, 0], 'clamp') }],
  }));
  return (
    <View style={styles.center}>
      {Array.from({ length: DOTS }, (_, i) => (
        <Dot key={i} t={t} index={i} color={palette[i % palette.length]} />
      ))}
      <Animated.View style={[styles.label, { backgroundColor: c.card }, card]}>
        <ThemedText variant="label" style={{ color: c.accent, fontSize: 14 }}>{label}</ThemedText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', width: 9, height: 9, borderRadius: 5 },
  label: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 99,
    shadowColor: '#5A3C1E',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
});
