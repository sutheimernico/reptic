import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { getFinishedWorkoutSummaries, getPlans, type WorkoutSummary } from '@/db';
import { formatSessionDate, formatVolume } from '@/domain/format';
import type { Plan } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

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
    <Screen title="Verlauf" subtitle="Deine vergangenen Einheiten">
      {sessions.length === 0 ? (
        <EmptyState
          icon="time-outline"
          title="Noch kein Verlauf"
          message="Beende eine Einheit, dann erscheint sie hier."
        />
      ) : (
        sessions.map((s) => {
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
              key={s.id}
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
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 12, height: 12, borderRadius: 6 },
});
