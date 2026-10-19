import { StyleSheet, View } from 'react-native';

import { FadeInListItem } from '@/components/motion/fade-in-list-item';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spacing } from '@/constants/theme';
import { breakPercent } from '@/domain/break';

/**
 * After a long break: offers to start lighter, then confirms. Not a modal — it
 * sits above the exercise list and the session stays usable while it waits.
 */
export function BreakBanner({
  days,
  factor,
  applied,
  onApply,
  onLater,
}: {
  days: number;
  factor: number;
  applied: boolean;
  onApply: () => void;
  onLater: () => void;
}) {
  const percent = breakPercent(factor);
  return (
    <FadeInListItem index={0} style={styles.wrap}>
      <Card style={styles.card}>
        {applied ? (
          <ThemedText type="smallBold">{`Gewichte um ${percent} % gesenkt`}</ThemedText>
        ) : (
          <>
            <View style={styles.texts}>
              <ThemedText type="smallBold">{`Du warst ${days} Tage nicht im Gym`}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {`Heute rund ${percent} % leichter starten?`}
              </ThemedText>
            </View>
            <View style={styles.buttons}>
              <Button label="Übernehmen" onPress={onApply} style={styles.button} />
              <Button label="Später" variant="secondary" onPress={onLater} style={styles.button} />
            </View>
          </>
        )}
      </Card>
    </FadeInListItem>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.three },
  card: { gap: Spacing.three },
  texts: { gap: Spacing.one },
  buttons: { flexDirection: 'row', gap: Spacing.two },
  button: { flex: 1 },
});
