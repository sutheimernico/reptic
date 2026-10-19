/** Variant D — a yellow starburst stamps onto the screen with the XP reward. */
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { useAppTheme } from '@/hooks/use-app-theme';
import { XP_PER_PR } from '@/domain/week-stats';

import { type SkinProps, useTimeline } from './timeline';

const W = 224;
const H = 152;

const STAR = Array.from({ length: 36 }, (_, i) => {
  const a = (i / 36) * Math.PI * 2;
  const r = i % 2 ? 1 : 0.76;
  return `${(W / 2 + Math.cos(a) * 104 * r).toFixed(1)},${(H / 2 + Math.sin(a) * 70 * r).toFixed(1)}`;
}).join(' ');

export function ArcadeCelebration({ kind, label }: SkinProps) {
  const { colors: c } = useAppTheme();
  const t = useTimeline();
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.04, 0.8, 1], [0, 1, 1, 0], 'clamp'),
    transform: [
      { scale: interpolate(t.value, [0, 0.1, 0.17, 1], [0.2, 1.15, 1, 0.9], 'clamp') },
      { rotate: `${interpolate(t.value, [0, 0.17, 0.8, 1], [-20, 0, 0, 4], 'clamp')}deg` },
    ],
  }));
  return (
    <Animated.View style={[styles.burst, style]}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={StyleSheet.absoluteFill}>
        <Polygon points={STAR} fill={c.warning} stroke={c.border} strokeWidth={3} strokeLinejoin="round" />
      </Svg>
      <View style={styles.text}>
        <ThemedText variant="display" style={[styles.label, { color: c.text }]}>
          {label.toUpperCase()}!
        </ThemedText>
        {kind === 'pr' ? (
          <ThemedText variant="display" style={[styles.xp, { color: c.celebrate }]}>+{XP_PER_PR} XP</ThemedText>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  burst: { width: W, height: H, alignItems: 'center', justifyContent: 'center' },
  text: { alignItems: 'center', maxWidth: 150, transform: [{ rotate: '-6deg' }] },
  label: { fontSize: 19, lineHeight: 21, textAlign: 'center' },
  xp: { fontSize: 14, lineHeight: 17, marginTop: 2 },
});
