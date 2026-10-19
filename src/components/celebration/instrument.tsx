/** Variant E — a readout line types itself in, with one hard flash. No easing, no bounce. */
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useReducedMotion } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useAppTheme } from '@/hooks/use-app-theme';

import { type SkinProps, useTimeline } from './timeline';

const TYPE_MS = 480;

function useTyped(text: string): string {
  const reduced = useReducedMotion();
  const [n, setN] = useState(reduced ? text.length : 0);
  useEffect(() => {
    if (reduced) return;
    const step = TYPE_MS / Math.max(1, text.length);
    const id = setInterval(() => setN((v) => Math.min(text.length, v + 1)), step);
    return () => clearInterval(id);
  }, [text, reduced]);
  return text.slice(0, n);
}

export function InstrumentCelebration({ label }: SkinProps) {
  const { colors: c, fonts } = useAppTheme();
  const t = useTimeline();
  const line = `▲ ${label.toUpperCase()}`;
  const typed = useTyped(line);
  const style = useAnimatedStyle(() => ({
    // Hard on/off, like a lamp: 4 flashes in the first 200 ms, then steady, then off.
    opacity: interpolate(t.value, [0, 0.02, 0.05, 0.08, 0.11, 0.14, 0.17, 0.82, 0.85, 1], [0, 1, 0.4, 1, 0.4, 1, 1, 1, 0, 0], 'clamp'),
  }));
  return (
    <Animated.View style={[styles.box, { backgroundColor: c.card, borderColor: c.accent }, style]}>
      <ThemedText style={[styles.text, { color: c.accent2, fontFamily: fonts.numeric }]}>{typed}</ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, minWidth: 180 },
  text: { fontSize: 11.5, letterSpacing: 0.5, lineHeight: 16 },
});
