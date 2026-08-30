import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Radius, Spacing } from '@/constants/theme';
import { getSetting } from '@/db';
import { formatWeight } from '@/domain/format';
import {
  parsePlateSetup,
  PLATE_SETUP_SETTING,
  type PlateSetup,
  solvePlates,
} from '@/domain/plates';
import { useTheme } from '@/hooks/use-theme';

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
  const db = useSQLiteContext();
  const [setup, setSetup] = useState<PlateSetup | null>(null);

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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Schließen">
        {/* Swallow taps inside the card so they don't dismiss the sheet. */}
        <Pressable
          style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
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
              <ThemedText style={styles.plates}>
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
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    padding: Spacing.four,
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  title: { fontSize: 17, fontWeight: '700' },
  plates: { fontSize: 20, fontWeight: '800' },
});
