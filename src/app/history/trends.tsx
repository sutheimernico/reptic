import { Stack, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { getSessionMuscleTotals } from '@/db';
import { formatVolume, formatWeight } from '@/domain/format';
import {
  bucketByWeek,
  rankMuscleGroups,
  startOfWeekWindow,
  type WeekTotals,
} from '@/domain/weeks';
import { useTheme } from '@/hooks/use-theme';

const WEEKS = 12;

/** A labelled bar, scaled against the largest value in its own series. */
function Bar({ label, value, max, caption }: { label: string; value: number; max: number; caption: string }) {
  const c = useTheme();
  // Zero stays visibly zero: a week without training is information, and a
  // minimum-width stub would read as "trained a little".
  const widthPct = max > 0 && value > 0 ? Math.max((value / max) * 100, 3) : 0;
  return (
    <View style={styles.barRow} accessibilityLabel={`${label}: ${caption}`}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.barLabel}>
        {label}
      </ThemedText>
      <View style={[styles.track, { backgroundColor: c.backgroundSelected }]}>
        <View style={[styles.fill, { backgroundColor: c.accent, width: `${widthPct}%` }]} />
      </View>
      <ThemedText type="small" themeColor={value > 0 ? 'text' : 'placeholder'} style={styles.barValue}>
        {caption}
      </ThemedText>
    </View>
  );
}

export default function TrendsScreen() {
  const db = useSQLiteContext();
  const c = useTheme();
  const [weeks, setWeeks] = useState<WeekTotals[]>([]);

  const load = useCallback(() => {
    const now = new Date();
    const since = startOfWeekWindow(now, WEEKS).toISOString();
    getSessionMuscleTotals(db, since).then((rows) => setWeeks(bucketByWeek(rows, now, WEEKS)));
  }, [db]);

  useFocusEffect(useCallback(() => load(), [load]));

  const maxVolume = weeks.reduce((m, w) => Math.max(m, w.volumeKg), 0);
  const maxDistance = weeks.reduce((m, w) => Math.max(m, w.distanceKm), 0);
  const totalVolume = weeks.reduce((sum, w) => sum + w.volumeKg, 0);
  const trainedWeeks = weeks.filter((w) => w.volumeKg > 0 || w.distanceKm > 0).length;
  const muscles = rankMuscleGroups(weeks);
  const maxMuscle = muscles[0]?.volumeKg ?? 0;

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Stack.Screen options={{ headerShown: true, title: 'Trends' }} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {totalVolume === 0 && maxDistance === 0 ? (
          <EmptyState
            icon="stats-chart-outline"
            title="Noch keine Trends"
            message="Sobald du Einheiten abschließt, siehst du hier dein Volumen der letzten 12 Wochen."
          />
        ) : (
          <>
            <Card style={styles.card}>
              <ThemedText type="smallBold">Volumen pro Woche</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {`Gewicht × Wiederholungen, letzte ${WEEKS} Wochen. In ${trainedWeeks} davon hast du trainiert.`}
              </ThemedText>
              {weeks.map((w) => (
                <Bar
                  key={w.key}
                  label={w.label}
                  value={w.volumeKg}
                  max={maxVolume}
                  caption={w.volumeKg > 0 ? formatVolume(w.volumeKg) : '—'}
                />
              ))}
            </Card>

            {muscles.length > 0 ? (
              <Card style={styles.card}>
                <ThemedText type="smallBold">Volumen nach Muskelgruppe</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {`Summe über die letzten ${WEEKS} Wochen.`}
                </ThemedText>
                {muscles.map((m) => (
                  <Bar
                    key={m.group}
                    label={m.group}
                    value={m.volumeKg}
                    max={maxMuscle}
                    caption={formatVolume(m.volumeKg)}
                  />
                ))}
              </Card>
            ) : null}

            {maxDistance > 0 ? (
              <Card style={styles.card}>
                <ThemedText type="smallBold">Cardio pro Woche</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Zurückgelegte Strecke.
                </ThemedText>
                {weeks.map((w) => (
                  <Bar
                    key={w.key}
                    label={w.label}
                    value={w.distanceKm}
                    max={maxDistance}
                    caption={w.distanceKm > 0 ? `${formatWeight(w.distanceKm)} km` : '—'}
                  />
                ))}
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: {
    padding: Spacing.four,
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  card: { gap: Spacing.two },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  barLabel: { width: 58 },
  barValue: { width: 74, textAlign: 'right' },
  track: { flex: 1, height: 8, borderRadius: Radius.sm, overflow: 'hidden' },
  fill: { height: 8, borderRadius: Radius.sm },
});
