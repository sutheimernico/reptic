import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Radius, Spacing } from '@/constants/theme';
import {
  getGym,
  getPlans,
  getPreviousSamePlanWorkout,
  getSessionRecordInputs,
  getSessionTotals,
  getWorkout,
} from '@/db';
import {
  formatDistance,
  formatSessionDate,
  formatSessionDuration,
  formatSigned,
  formatVolume,
} from '@/domain/format';
import { describeRecords, MIN_SESSIONS_FOR_PR } from '@/domain/personal-records';
import {
  NO_TOTALS,
  sessionDurationSec,
  type SessionSummary,
  summarizeSession,
} from '@/domain/session';
import type { Plan, Workout } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

type Trend = 'up' | 'down' | 'neutral';

const trendOf = (delta: number): Trend => (delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral');

/** One number with its label and, when there is a comparison, the change since last time. */
function StatTile({
  icon,
  label,
  value,
  delta,
  trend = 'neutral',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  delta?: string | null;
  trend?: Trend;
}) {
  const c = useTheme();
  // Only "more work" is coloured. Less than last time stays neutral grey — a
  // lighter day is information, not a failure.
  const deltaColor = trend === 'up' ? c.success : c.textSecondary;
  return (
    <View
      style={[styles.tile, { backgroundColor: c.card, borderColor: c.border }]}
      accessible
      accessibilityLabel={`${label}: ${value}${delta ? `, ${delta} gegenüber letztem Mal` : ''}`}>
      <View style={styles.tileHead}>
        <Ionicons name={icon} size={14} color={c.textSecondary} />
        <Text style={[styles.tileLabel, { color: c.textSecondary }]}>{label}</Text>
      </View>
      <Text style={[styles.tileValue, { color: c.text }]}>{value}</Text>
      {delta ? <Text style={[styles.tileDelta, { color: deltaColor }]}>{delta}</Text> : null}
    </View>
  );
}

/**
 * What a session added up to: duration, sets, volume, cardio distance, the
 * records it set and the change against the last session with the same plans.
 * Shown right after "Einheit beenden" (`fresh`) and reachable again from the
 * history detail.
 */
export default function WorkoutSummaryScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useTheme();
  const params = useLocalSearchParams<{ id: string; fresh?: string }>();
  const workoutId = Number(params.id);
  const fresh = params.fresh === '1';

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [gymName, setGymName] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  const load = useCallback(() => {
    let active = true;
    (async () => {
      const current = await getWorkout(db, workoutId);
      if (!current) return;
      const [gym, allPlans, previous, recordInputs] = await Promise.all([
        getGym(db, current.gymId),
        getPlans(db),
        getPreviousSamePlanWorkout(db, current),
        getSessionRecordInputs(db, current),
      ]);
      const totals = await getSessionTotals(
        db,
        previous ? [current.id, previous.id] : [current.id],
      );
      const next = summarizeSession({
        current: {
          startedAt: current.startedAt,
          durationSec: sessionDurationSec(current.startedAt, current.finishedAt),
          totals: totals.get(current.id) ?? NO_TOTALS,
        },
        previous: previous
          ? {
              startedAt: previous.startedAt,
              durationSec: sessionDurationSec(previous.startedAt, previous.finishedAt),
              totals: totals.get(previous.id) ?? NO_TOTALS,
            }
          : null,
        recordInputs,
      });
      if (!active) return;
      setWorkout(current);
      setGymName(gym?.name ?? null);
      setPlans(
        current.planIds
          .map((id) => allPlans.find((p) => p.id === id))
          .filter((p): p is Plan => Boolean(p)),
      );
      setSummary(next);
    })();
    return () => {
      active = false;
    };
  }, [db, workoutId]);

  useFocusEffect(load);

  const cmp = summary?.comparison ?? null;
  const totals = summary?.totals ?? NO_TOTALS;
  const dateLabel = workout ? formatSessionDate(workout.finishedAt ?? workout.startedAt) : '';

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Stack.Screen
        options={{ headerShown: true, title: fresh ? 'Einheit beendet' : 'Zusammenfassung' }}
      />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <ThemedText style={styles.heroTitle}>
            {fresh ? 'Einheit geschafft' : 'Deine Einheit'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {gymName ? `${dateLabel} · ${gymName}` : dateLabel}
          </ThemedText>
          {plans.length > 0 ? (
            <View style={styles.plans}>
              {plans.map((plan) => (
                <View key={plan.id} style={[styles.planChip, { borderColor: c.border }]}>
                  <View style={[styles.dot, { backgroundColor: plan.color }]} />
                  <ThemedText type="small">{plan.name}</ThemedText>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {summary ? (
          <>
            <View style={styles.grid}>
              <StatTile
                icon="time-outline"
                label="DAUER"
                value={formatSessionDuration(summary.durationSec)}
                delta={
                  cmp?.durationSec != null
                    ? formatSigned(Math.round(cmp.durationSec / 60), (m) => `${m} min`)
                    : null
                }
              />
              <StatTile
                icon="layers-outline"
                label="SÄTZE"
                value={String(totals.setCount)}
                delta={cmp ? formatSigned(cmp.setCount, String) : null}
                trend={cmp ? trendOf(cmp.setCount) : 'neutral'}
              />
              <StatTile
                icon="barbell-outline"
                label="VOLUMEN"
                value={formatVolume(totals.volume)}
                delta={
                  cmp
                    ? formatSigned(cmp.volume, formatVolume) +
                      (cmp.volumePct !== null
                        ? ` · ${formatSigned(cmp.volumePct, (p) => `${p} %`)}`
                        : '')
                    : null
                }
                trend={cmp ? trendOf(cmp.volume) : 'neutral'}
              />
              <StatTile icon="list-outline" label="ÜBUNGEN" value={String(totals.exerciseCount)} />
              {totals.distanceKm > 0 ? (
                <StatTile
                  icon="bicycle-outline"
                  label="STRECKE"
                  value={formatDistance(totals.distanceKm)}
                  delta={cmp ? formatSigned(cmp.distanceKm, formatDistance) : null}
                  trend={cmp ? trendOf(cmp.distanceKm) : 'neutral'}
                />
              ) : null}
            </View>

            <ThemedText type="small" themeColor="textSecondary" style={styles.caption}>
              {cmp
                ? `Vergleich mit ${formatSessionDate(cmp.previousStartedAt)} — gleiche Pläne.`
                : workout && workout.planIds.length === 0
                  ? 'Leere Einheit — ohne Plan gibt es keinen Vergleich.'
                  : 'Erste Einheit mit diesen Plänen — nächstes Mal steht hier der Vergleich.'}
            </ThemedText>

            <Card style={styles.records}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                NEUE REKORDE
              </ThemedText>
              {summary.records.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {`Diesmal keine neuen Rekorde. Rekorde zählen ab der ${MIN_SESSIONS_FOR_PR + 1}. Einheit einer Übung.`}
                </ThemedText>
              ) : (
                summary.records.map((r) => (
                  <View key={r.exerciseId} style={styles.recordRow}>
                    <View style={[styles.trophy, { backgroundColor: c.success }]}>
                      <Ionicons name="trophy" size={14} color={c.onAccent} />
                    </View>
                    <View style={styles.recordTexts}>
                      <ThemedText style={styles.recordName}>{r.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {describeRecords(r.kinds)}
                      </ThemedText>
                    </View>
                  </View>
                ))
              )}
            </Card>
          </>
        ) : null}
      </ScrollView>

      {fresh ? (
        <SafeAreaView
          edges={['bottom']}
          style={[styles.footer, { borderTopColor: c.border, backgroundColor: c.background }]}>
          <Button label="Fertig" icon="checkmark" onPress={() => router.back()} />
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: Spacing.four, gap: Spacing.three },
  hero: { gap: 2 },
  heroTitle: { fontSize: 26, lineHeight: 32, fontWeight: '800', letterSpacing: -0.4 },
  plans: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.two },
  planChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tile: {
    flexGrow: 1,
    flexBasis: '46%',
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: 2,
  },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tileLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  tileValue: { fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
  tileDelta: { fontSize: 13, fontWeight: '700' },
  caption: { marginTop: -Spacing.one },
  records: { gap: Spacing.two },
  recordRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  trophy: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordTexts: { flex: 1 },
  recordName: { fontSize: 16, fontWeight: '600' },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
  },
});
