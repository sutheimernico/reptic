import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconButton } from '@/components/ui/icon-button';
import { ListRow } from '@/components/ui/list-row';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { getFinishedWorkoutSummaries, getPlans, type WorkoutSummary } from '@/db';
import { buildMonthGrid, localDayOf, monthTitle, shiftMonth } from '@/domain/calendar';
import { formatSessionDate, formatVolume } from '@/domain/format';
import type { Plan } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

const WEEKDAY_HEADERS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export default function HistoryCalendarScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useTheme();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month0, setMonth0] = useState(now.getMonth());
  const [sessions, setSessions] = useState<WorkoutSummary[]>([]);
  const [plansById, setPlansById] = useState<Map<number, Plan>>(new Map());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const load = useCallback(() => {
    const from = new Date(year, month0, 1).toISOString();
    const to = new Date(year, month0 + 1, 1).toISOString();
    getFinishedWorkoutSummaries(db, { from, to }).then(setSessions);
    getPlans(db).then((plans) => setPlansById(new Map(plans.map((p) => [p.id, p]))));
  }, [db, year, month0]);

  useFocusEffect(useCallback(() => load(), [load]));

  const shift = (delta: -1 | 1) => {
    const next = shiftMonth(year, month0, delta);
    setYear(next.year);
    setMonth0(next.month0);
    setSelectedDay(null);
  };

  // Sessions per local day of month; marker colors come from the plan dots.
  const byDay = new Map<number, WorkoutSummary[]>();
  for (const s of sessions) {
    const day = localDayOf(s.finishedAt ?? s.startedAt);
    byDay.set(day, [...(byDay.get(day) ?? []), s]);
  }

  const markerColors = (day: number): string[] => {
    const daySessions = byDay.get(day) ?? [];
    const colors = daySessions.flatMap((s) =>
      s.planIds.length > 0
        ? s.planIds.map((id) => plansById.get(id)?.color ?? c.textSecondary)
        : [c.textSecondary],
    );
    return colors.slice(0, 3);
  };

  const isToday = (day: number) =>
    day === now.getDate() && month0 === now.getMonth() && year === now.getFullYear();

  const weeks = buildMonthGrid(year, month0);
  const selectedSessions = selectedDay !== null ? (byDay.get(selectedDay) ?? []) : [];

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Stack.Screen options={{ headerShown: true, title: 'Kalender' }} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.monthBar}>
          <IconButton name="chevron-back" accessibilityLabel="Voriger Monat" onPress={() => shift(-1)} />
          <ThemedText type="smallBold" style={styles.monthTitle}>
            {monthTitle(year, month0)}
          </ThemedText>
          <IconButton name="chevron-forward" accessibilityLabel="Nächster Monat" onPress={() => shift(1)} />
        </View>

        <View style={styles.weekRow}>
          {WEEKDAY_HEADERS.map((wd) => (
            <ThemedText key={wd} type="small" themeColor="textSecondary" style={styles.weekday}>
              {wd}
            </ThemedText>
          ))}
        </View>

        {weeks.map((week, wi) => (
          <View key={wi} style={styles.weekRow}>
            {week.map((cell) => {
              if (cell.day === null) return <View key={cell.key} style={styles.cell} />;
              const day = cell.day;
              const colors = markerColors(day);
              const selected = selectedDay === day;
              return (
                <Pressable
                  key={cell.key}
                  onPress={() => setSelectedDay(colors.length > 0 ? day : null)}
                  accessibilityLabel={
                    `${day}. ${monthTitle(year, month0)}` +
                    (colors.length > 0 ? ', Training' : ', kein Training')
                  }
                  style={[
                    styles.cell,
                    selected ? { backgroundColor: c.backgroundSelected } : null,
                    isToday(day) ? { borderColor: c.accent, borderWidth: 1 } : null,
                  ]}>
                  <ThemedText type="small">{day}</ThemedText>
                  <View style={styles.dotRow}>
                    {colors.map((col, i) => (
                      <View key={i} style={[styles.dot, { backgroundColor: col }]} />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}

        {selectedDay !== null && selectedSessions.length > 0 ? (
          <View style={styles.dayList}>
            {selectedSessions.map((s) => (
              <ListRow
                key={s.id}
                title={formatSessionDate(s.finishedAt ?? s.startedAt)}
                subtitle={
                  `${s.gymName} · ${s.exerciseCount} Übungen · ${s.setCount} Sätze` +
                  (s.volume > 0 ? ` · ${formatVolume(s.volume)}` : '')
                }
                right={<Ionicons name="chevron-forward" size={18} color={c.textSecondary} />}
                onPress={() =>
                  router.push({ pathname: '/workout/[id]', params: { id: String(s.id) } })
                }
              />
            ))}
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            Tippe auf einen markierten Tag, um die Einheiten zu sehen.
          </ThemedText>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: {
    padding: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.two,
  },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthTitle: { fontSize: 16 },
  weekRow: { flexDirection: 'row', gap: 4 },
  weekday: { flex: 1, textAlign: 'center' },
  cell: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dotRow: { flexDirection: 'row', gap: 2, minHeight: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dayList: { marginTop: Spacing.three, gap: Spacing.two },
  hint: { marginTop: Spacing.three, textAlign: 'center' },
});
