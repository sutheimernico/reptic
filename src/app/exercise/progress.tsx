import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { type ExerciseSessionEntry, getExerciseSessionHistory } from '@/db';
import { formatSessionDate, formatSetSummary, formatWeight } from '@/domain/format';
import { topSetWeight } from '@/domain/sets';
import { useTheme } from '@/hooks/use-theme';

export default function ExerciseProgressScreen() {
  const db = useSQLiteContext();
  const c = useTheme();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const exerciseId = Number(id);

  const [entries, setEntries] = useState<ExerciseSessionEntry[]>([]);

  const load = useCallback(() => {
    getExerciseSessionHistory(db, exerciseId).then(setEntries);
  }, [db, exerciseId]);

  useFocusEffect(useCallback(() => load(), [load]));

  const tops = entries.map((e) => topSetWeight(e.sets));
  const maxTop = tops.reduce<number>((m, t) => (t !== null && t > m ? t : m), 0);

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Stack.Screen options={{ headerShown: true, title: name || 'Fortschritt' }} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {entries.length === 0 ? (
          <EmptyState
            icon="trending-up"
            title="Noch kein Fortschritt"
            message="Sobald du diese Übung in einer Einheit protokollierst, siehst du hier die Entwicklung."
          />
        ) : (
          entries.map((entry, i) => {
            const top = tops[i];
            const summary = formatSetSummary(entry.sets);
            const widthPct = top !== null && maxTop > 0 ? Math.max(top / maxTop, 0.08) : 0;
            return (
              <Card key={entry.workoutId} style={styles.card}>
                <View style={styles.header}>
                  <ThemedText type="smallBold">{formatSessionDate(entry.date)}</ThemedText>
                  {top !== null ? (
                    <ThemedText type="small" themeColor="accent">
                      {formatWeight(top)} kg
                    </ThemedText>
                  ) : null}
                </View>
                <View style={[styles.track, { backgroundColor: c.backgroundSelected }]}>
                  <View
                    style={[styles.fill, { backgroundColor: c.accent, width: `${widthPct * 100}%` }]}
                  />
                </View>
                {summary ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {summary}
                  </ThemedText>
                ) : null}
              </Card>
            );
          })
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 8, borderRadius: Radius.sm, overflow: 'hidden' },
  fill: { height: 8, borderRadius: Radius.sm },
});
