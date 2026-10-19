/** Variant A — a gold pill rises over the set with a short burst of rays. */
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';

import { type SkinProps, useTimeline } from './timeline';

const RAYS = 10;

function Ray({ t, angle }: { t: SharedValue<number>; angle: number }) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.06, 0.4], [0, 0.9, 0], 'clamp'),
    transform: [
      { rotate: `${angle}deg` },
      { translateX: interpolate(t.value, [0, 0.4], [34, 74], 'clamp') },
    ],
  }));
  return <Animated.View style={[styles.ray, style]} />;
}

export function EvolvedCelebration({ kind, label }: SkinProps) {
  const t = useTimeline();
  const pill = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.1, 0.78, 1], [0, 1, 1, 0], 'clamp'),
    transform: [
      { translateY: interpolate(t.value, [0, 0.25], [16, 0], 'clamp') },
      { scale: interpolate(t.value, [0, 0.14, 0.28], [0.7, 1.08, 1], 'clamp') },
    ],
  }));
  return (
    <View style={styles.center}>
      {Array.from({ length: RAYS }, (_, i) => (
        <Ray key={i} t={t} angle={(360 / RAYS) * i} />
      ))}
      <Animated.View style={[styles.pill, pill]}>
        <Ionicons name={kind === 'pr' ? 'trophy' : 'ribbon'} size={14} color="#1A1300" />
        <ThemedText variant="label" style={styles.text}>{label}</ThemedText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: '#FBBF24',
    shadowColor: '#FBBF24',
    shadowOpacity: 0.7,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  text: { color: '#1A1300', fontSize: 13 },
  ray: { position: 'absolute', width: 12, height: 3, borderRadius: 2, backgroundColor: '#FBBF24' },
});
