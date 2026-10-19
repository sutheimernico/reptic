/**
 * Short celebration for a personal record or a reached goal, in the active
 * theme's style. An overlay inside its parent: it never takes touches, never
 * opens a modal and is gone after ~1.2 s.
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useReducedMotion } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useAppTheme } from '@/hooks/use-app-theme';

import { ArcadeCelebration } from './arcade';
import { EvolvedCelebration } from './evolved';
import { InstrumentCelebration } from './instrument';
import { CELEBRATION_MS, type CelebrationKind, useTimeline } from './timeline';
import { WarmCelebration } from './warm';

/** Reduced motion: the label simply fades in and out, in place. */
function PlainCelebration({ label }: { kind: CelebrationKind; label: string }) {
  const { colors: c } = useAppTheme();
  const t = useTimeline();
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.15, 0.8, 1], [0, 1, 1, 0], 'clamp'),
  }));
  return (
    <Animated.View style={[styles.plain, { backgroundColor: c.card, borderColor: c.border }, style]}>
      <ThemedText variant="label">{label}</ThemedText>
    </Animated.View>
  );
}

export function Celebration({
  kind,
  label,
  visible,
  onDone,
}: {
  kind: CelebrationKind;
  label: string;
  visible: boolean;
  onDone: () => void;
}) {
  const theme = useAppTheme();
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(onDone, CELEBRATION_MS);
    return () => clearTimeout(id);
    // The timer belongs to one showing; a new onDone identity must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;
  const Skin = reduced
    ? PlainCelebration
    : { pill: EvolvedCelebration, confetti: WarmCelebration, starburst: ArcadeCelebration, flash: InstrumentCelebration }[
        theme.motion.celebration
      ];
  return (
    <View pointerEvents="none" style={styles.overlay} accessibilityLiveRegion="polite" accessibilityLabel={label}>
      <Skin kind={kind} label={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  plain: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderRadius: 99 },
});
