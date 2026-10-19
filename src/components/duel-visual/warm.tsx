/** Variant C — tug-of-war: a rope per metric, the knot sits where the week's balance tips. */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { useAppTheme } from '@/hooks/use-app-theme';

import { friendColor, initialOf, type DuelMetric, type DuelModel } from './model';

const KNOT = 20;

/** The rope's left part is mine, the rest is theirs; the knot rides the boundary (transform only). */
function Rope({ pct, mine, theirs, delayMs }: { pct: number; mine: string; theirs: string; delayMs: number }) {
  const { motion } = useAppTheme();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(reduced ? pct : 0.5);
  useEffect(() => {
    progress.value = reduced
      ? pct
      : withDelay(
          delayMs,
          withTiming(pct, { duration: motion.durationMs.slow * 3, easing: Easing.out(Easing.cubic) }),
        );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pct, reduced]);
  const fill = useAnimatedStyle(() => ({ transform: [{ translateX: (progress.value - 1) * width }] }));
  const knot = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * width - KNOT / 2 }],
  }));
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={styles.rope}>
      <View style={[styles.ropeTrack, { backgroundColor: theirs }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: mine }, fill]} />
      </View>
      <Animated.View style={[styles.knot, { borderColor: theirs }, knot]} />
    </View>
  );
}

function Tug({ m, mine, theirs, delay }: { m: DuelMetric; mine: string; theirs: string; delay: number }) {
  const { colors: c } = useAppTheme();
  return (
    <View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>{m.label}</ThemedText>
      <Rope pct={m.sharePct} mine={mine} theirs={theirs} delayMs={delay} />
      <View style={styles.values}>
        <ThemedText variant="numeric" style={[styles.value, { color: m.lead === 'friend' ? c.textSecondary : c.text }]}>
          {m.meText}
        </ThemedText>
        <ThemedText variant="numeric" style={[styles.value, { color: m.lead === 'me' ? c.textSecondary : c.text }]}>
          {m.friendText}
        </ThemedText>
      </View>
    </View>
  );
}

function Avatar({ name, color }: { name: string; color: string }) {
  return (
    <View style={[styles.avatar, { backgroundColor: color }]}>
      <ThemedText variant="display" style={styles.avatarText}>{initialOf(name)}</ThemedText>
    </View>
  );
}

export function WarmDuel({ model }: { model: DuelModel }) {
  const { colors: c, variant } = useAppTheme();
  const theirs = friendColor(variant, c.accent2);
  return (
    <View style={styles.wrap} accessibilityLabel={model.status}>
      <Card style={styles.card}>
        <View style={styles.top}>
          <View style={styles.side}>
            <Avatar name={model.meName} color={c.accent} />
            <ThemedText type="smallBold">Du</ThemedText>
          </View>
          <View style={styles.side}>
            <ThemedText type="smallBold" numberOfLines={1}>{model.friendName}</ThemedText>
            <Avatar name={model.friendName} color={theirs} />
          </View>
        </View>
        <Tug m={model.metrics.kg} mine={c.accent} theirs={theirs} delay={100} />
        <Tug m={model.metrics.km} mine={c.accent} theirs={theirs} delay={250} />
      </Card>
      <ThemedText style={styles.msg}>{model.status}</ThemedText>
      {model.importedText ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.imported}>
          {model.importedText}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  card: { padding: 18, gap: 4 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  side: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '48%' },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 17 },
  label: { marginTop: 16, marginBottom: 8, fontSize: 12 },
  rope: { height: KNOT, justifyContent: 'center' },
  ropeTrack: { height: 10, borderRadius: 5, overflow: 'hidden' },
  knot: {
    position: 'absolute',
    left: 0,
    width: KNOT,
    height: KNOT,
    borderRadius: KNOT / 2,
    backgroundColor: '#FFFBF6',
    borderWidth: 3,
  },
  values: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  value: { fontSize: 18, lineHeight: 24 },
  msg: { marginHorizontal: 6, lineHeight: 24 },
  imported: { marginHorizontal: 6, fontSize: 12 },
});
