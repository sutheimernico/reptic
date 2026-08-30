import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { ListRow } from '@/components/ui/list-row';
import { Screen, SCREEN_BODY_PADDING } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { getFinishedWorkoutSummaries, getPlans, type WorkoutSummary } from '@/db';
import { formatSessionDate, formatVolume, plural } from '@/domain/format';
import type { Plan } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

export default function HistoryScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useTheme();
  const [sessions, setSessions] = useState<WorkoutSummary[]>([]);
  const [plansById, setPlansById] = useState<Map<number, Plan>>(new Map());

  const load = useCallback(() => {
    getFinishedWorkoutSummaries(db).then(setSessions);
    getPlans(db).then((plans) => setPlansById(new Map(plans.map((p) => [p.id, p]))));
  }, [db]);

  useFocusEffect(useCallback(() => load(), [load]));

  return (
    <Screen
      title="Verlauf"
      subtitle="Deine vergangenen Einheiten"
      headerRight={
        <View style={styles.headerActions}>
          <IconButton
            name="stats-chart-outline"
            accessibilityLabel="Trends öffnen"
            onPress={() => router.push('/history/trends')}
          />
          <IconButton
            name="calendar-outline"
            accessibilityLabel="Kalenderansicht öffnen"
            onPress={() => router.push('/history/calendar')}
          />
        </View>
      }
      scroll={false}
      padded={false}>
      <FlatList
        data={sessions}
        keyExtractor={(s) => String(s.id)}
        contentContainerStyle={SCREEN_BODY_PADDING}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: s }) => {
          const plans = s.planIds
            .map((id) => plansById.get(id))
            .filter((p): p is Plan => Boolean(p));
          const colors = plans.map((p) => p.color);
          const dateLabel = formatSessionDate(s.finishedAt ?? s.startedAt);
          const summary =
            `${s.gymName} · ` +
            `${plural(s.exerciseCount, 'Übung', 'Übungen')} · ${plural(s.setCount, 'Satz', 'Sätze')}` +
            (s.volume > 0 ? ` · ${formatVolume(s.volume)}` : '');
          const a11yLabel =
            `${dateLabel}. ` +
            (plans.length ? `Pläne: ${plans.map((p) => p.name).join(', ')}. ` : '') +
            summary;
          return (
            <ListRow
              title={dateLabel}
              subtitle={summary}
              accessibilityLabel={a11yLabel}
              left={
                colors.length > 0 ? (
                  <View style={styles.dots}>
                    {colors.map((col, i) => (
                      <View key={i} style={[styles.dot, { backgroundColor: col }]} />
                    ))}
                  </View>
                ) : undefined
              }
              right={<Ionicons name="chevron-forward" size={18} color={c.textSecondary} />}
              onPress={() => router.push({ pathname: '/workout/[id]', params: { id: String(s.id) } })}
            />
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="time-outline"
            title="Noch kein Verlauf"
            message="Beende eine Einheit, dann erscheint sie hier."
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', gap: Spacing.three },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 12, height: 12, borderRadius: 6 },
});
