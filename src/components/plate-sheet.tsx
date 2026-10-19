import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { getSetting } from '@/db';
import { formatWeight } from '@/domain/format';
import {
  parsePlateSetup,
  PLATE_SETUP_SETTING,
  type PlateSetup,
  solvePlates,
} from '@/domain/plates';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useTheme } from '@/hooks/use-theme';
import { timingFor } from '@/theme/motion';

const SLIDE_PX = 36;
const AnimatedCard = Animated.createAnimatedComponent(Pressable);

/**
 * Display-only sheet showing how to load a barbell for the weight in the kg
 * field. It never writes back to the input — it answers "which plates?", it
 * does not decide the weight.
 */
export function PlateSheet({
  targetKg,
  visible,
  onClose,
}: {
  targetKg: number | null;
  visible: boolean;
  onClose: () => void;
}) {
  const c = useTheme();
  const theme = useAppTheme();
  const { shape } = theme;
  const reduced = useReducedMotion();
  const db = useSQLiteContext();
  const [setup, setSetup] = useState<PlateSetup | null>(null);

  // The Modal stays mounted while the close animation plays, then unmounts.
  const [prevVisible, setPrevVisible] = useState(visible);
  const [lingering, setLingering] = useState(false);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (!visible) setLingering(true);
  }
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withTiming(visible ? 1 : 0, timingFor(theme, 'base')));
    if (visible) return;
    const handle = setTimeout(() => setLingering(false), theme.motion.durationMs.base);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: reduced ? 0 : (1 - progress.get()) * SLIDE_PX }],
  }));

  useEffect(() => {
    if (!visible) return;
    let active = true;
    getSetting(db, PLATE_SETUP_SETTING).then((stored) => {
      if (active) setSetup(parsePlateSetup(stored));
    });
    return () => {
      active = false;
    };
  }, [db, visible]);

  const solution = setup && targetKg !== null ? solvePlates(targetKg, setup) : null;

  return (
    <Modal
      visible={visible || lingering}
      transparent
      animationType="none"
      onRequestClose={onClose}>
      <Animated.View style={[styles.dim, backdropStyle]} pointerEvents="none" />
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Schließen">
        {/* Swallow taps inside the card so they don't dismiss the sheet. */}
        <AnimatedCard
          style={[
            styles.card,
            {
              backgroundColor: c.card,
              borderColor: c.border,
              borderWidth: shape.borderWidth,
              borderRadius: shape.radius.lg,
            },
            cardStyle,
          ]}
          onPress={() => {}}>
          <ThemedText style={styles.title}>
            {targetKg === null ? 'Hantelscheiben' : `${formatWeight(targetKg)} kg auflegen`}
          </ThemedText>

          {!setup ? (
            <ThemedText type="small" themeColor="textSecondary">
              Lade …
            </ThemedText>
          ) : solution === null ? (
            <ThemedText type="small" themeColor="textSecondary">
              {targetKg === null
                ? 'Trag erst ein Gewicht ein.'
                : `Leichter als die Stange (${formatWeight(setup.barKg)} kg).`}
            </ThemedText>
          ) : (
            <>
              <ThemedText variant="numeric" style={styles.plates}>
                {solution.perSide.length === 0
                  ? 'Nur die Stange'
                  : `pro Seite: ${solution.perSide.map(formatWeight).join(' + ')}`}
              </ThemedText>
              {solution.exact ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {`Stange ${formatWeight(setup.barKg)} kg + beide Seiten = ${formatWeight(solution.totalKg)} kg.`}
                </ThemedText>
              ) : (
                <ThemedText type="small" themeColor="danger">
                  {`Mit deinen Scheiben nicht exakt stellbar. Nächste: ${formatWeight(solution.totalKg)} kg${
                    solution.nextHigherKg === null
                      ? ''
                      : ` oder ${formatWeight(solution.nextHigherKg)} kg`
                  }.`}
                </ThemedText>
              )}
            </>
          )}

          <Button label="Schließen" variant="secondary" onPress={onClose} />
        </AnimatedCard>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: Spacing.four,
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.four,
  },
  title: { fontSize: 17, fontWeight: '700' },
  plates: { fontSize: 20 },
});
