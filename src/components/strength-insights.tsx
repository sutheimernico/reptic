/**
 * Strength section of the exercise progress screen: e1RM headline, range and gym
 * chips, the chart, and the forecast readouts. The forecast is always fitted on
 * the full gym-filtered series; the range only crops what is drawn, so toggling
 * it never moves the prediction.
 */

import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { StrengthChart } from '@/components/strength-chart';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import {
  deleteSetting,
  type ExerciseHistoryEntry,
  getExerciseHistoryAll,
  getGyms,
  getSetting,
  setSetting,
} from '@/db';
import { fitForecast, MIN_FORECAST_SESSIONS, strengthSeries } from '@/domain/forecast';
import { formatKg, formatSigned, MONTHS_DE, plural } from '@/domain/format';
import {
  applyGymFilter,
  type GymFilter,
  gymFilterKey,
  parseGymFilter,
  toggleGym,
} from '@/domain/gym-filter';
import { useAppTheme } from '@/hooks/use-app-theme';
import { Spacing } from '@/constants/theme';

const RANGES = [
  { label: '3M', days: 91 },
  { label: '6M', days: 182 },
  { label: '1J', days: 365 },
  { label: 'Alles', days: null },
] as const;

const kg = formatKg;

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, shape } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderRadius: shape.radius.sm,
          borderWidth: Math.max(shape.borderWidth, 1),
          borderColor: selected ? colors.accent : colors.border,
          backgroundColor: selected ? colors.accent : 'transparent',
        },
      ]}
    >
      <ThemedText
        type="smallBold"
        style={{ color: selected ? colors.onAccent : colors.textSecondary }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function StrengthInsights({
  exerciseId,
  onGymFilter,
}: {
  exerciseId: number;
  /** Workout ids the active gym filter keeps, or null for "all" — the screen filters its list with it. */
  onGymFilter?: (workoutIds: Set<number> | null) => void;
}) {
  const db = useSQLiteContext();
  const { colors } = useAppTheme();
  const [history, setHistory] = useState<ExerciseHistoryEntry[] | null>(null);
  const [gyms, setGyms] = useState<{ id: number; name: string }[]>([]);
  const [filter, setFilter] = useState<GymFilter>('all');
  const [rangeIdx, setRangeIdx] = useState(3);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      (async () => {
        const [all, allGyms, stored] = await Promise.all([
          getExerciseHistoryAll(db, exerciseId),
          getGyms(db, { includeArchived: true }),
          getSetting(db, gymFilterKey(exerciseId)),
        ]);
        if (!live) return;
        const used = new Set(all.map((e) => e.gymId));
        const withHistory = allGyms.filter((g) => used.has(g.id));
        setHistory(all);
        setGyms(withHistory);
        setFilter(
          parseGymFilter(
            stored,
            withHistory.map((g) => g.id),
          ),
        );
      })();
      return () => {
        live = false;
      };
    }, [db, exerciseId]),
  );

  const onToggle = (gymId: number | 'all') => {
    const next = toggleGym(filter, gymId);
    setFilter(next);
    if (next === 'all') void deleteSetting(db, gymFilterKey(exerciseId));
    else void setSetting(db, gymFilterKey(exerciseId), JSON.stringify(next));
  };

  const series = useMemo(
    () => applyGymFilter(strengthSeries(history ?? []), filter),
    [history, filter],
  );
  const forecast = useMemo(() => fitForecast(series), [series]);

  useEffect(() => {
    if (!onGymFilter) return;
    onGymFilter(
      filter === 'all' || history === null
        ? null
        : new Set(applyGymFilter(history, filter).map((e) => e.workoutId)),
    );
  }, [history, filter, onGymFilter]);

  if (history === null) return null;

  const last = series[series.length - 1];
  const rangeDays = RANGES[rangeIdx].days;
  const visible =
    last && rangeDays !== null
      ? series.filter((p) => p.dayIndex >= last.dayIndex - rangeDays)
      : series;
  const first = visible[0];
  const delta = last && first && visible.length > 1 ? last.e1rm - first.e1rm : null;
  const sinceMonth = first ? MONTHS_DE[new Date(first.date).getMonth()] : '';

  const fit = forecast.kind === 'fit' ? forecast : null;
  const sessions = series.length;

  return (
    <View style={styles.wrap}>
      <View style={styles.chips}>
        {RANGES.map((r, i) => (
          <Chip
            key={r.label}
            label={r.label}
            selected={i === rangeIdx}
            onPress={() => setRangeIdx(i)}
          />
        ))}
      </View>
      {gyms.length > 1 ? (
        <View style={styles.chips}>
          <Chip label="Alle Gyms" selected={filter === 'all'} onPress={() => onToggle('all')} />
          {gyms.map((g) => (
            <Chip
              key={g.id}
              label={g.name}
              selected={filter !== 'all' && filter.includes(g.id)}
              onPress={() => onToggle(g.id)}
            />
          ))}
        </View>
      ) : null}

      {last ? (
        <View>
          <ThemedText variant="numeric" style={styles.big}>
            {kg(last.e1rm)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            geschätztes 1RM (e1RM)
            {delta !== null ? ` · ${formatSigned(delta, kg)} seit ${sinceMonth}` : ''}
          </ThemedText>
        </View>
      ) : null}

      {last ? (
        <Card style={styles.chartCard}>
          <StrengthChart
            points={visible}
            curve={fit?.curve ?? []}
            plateauKg={fit?.plateauKg ?? null}
            originDate={series[0].date}
          />
          {fit && fit.curve.length > 0 ? (
            <View style={styles.legend}>
              <LegendItem color={colors.chartLine} label="Verlauf" />
              <LegendItem color={colors.accent2} label="Prognose" dashed />
              <LegendItem color={colors.chartBand} label="Unsicherheit" block />
            </View>
          ) : null}
        </Card>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          Keine auswertbaren Sätze (Gewicht und 1–12 Wiederholungen) in dieser Auswahl.
        </ThemedText>
      )}

      {forecast.kind === 'insufficient' ? (
        <ThemedText type="small" themeColor="textSecondary">
          {`Noch zu wenig Daten für eine Prognose (${Math.min(sessions, MIN_FORECAST_SESSIONS)} von ${MIN_FORECAST_SESSIONS} Einheiten)`}
        </ThemedText>
      ) : null}

      {fit?.status === 'declining' ? (
        <ThemedText type="small" themeColor="warning">
          Zuletzt rückläufig — nach einer Pause oder einem Deload normal. Die Prognose kommt wieder,
          sobald es aufwärts geht.
        </ThemedText>
      ) : null}
      {fit?.status === 'unreliable' ? (
        <ThemedText type="small" themeColor="warning">
          Der Verlauf ist gerade zu unruhig für eine Prognose.
        </ThemedText>
      ) : null}

      {fit ? (
        <>
          {fit.status === 'rising' || fit.status === 'plateau' ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.heading}>
              Prognose
            </ThemedText>
          ) : null}
          <View style={styles.stats}>
            {fit.status === 'rising' || fit.status === 'plateau' ? (
              <Stat
                value={
                  fit.plateauKg !== null
                    ? `Plateau ~${kg(fit.plateauKg)}`
                    : 'Noch kein Plateau erkennbar'
                }
                small={fit.plateauKg === null}
              />
            ) : null}
            {fit.status !== 'unreliable' ? (
              <Stat value={`${formatSigned(fit.gainPerMonthKg, kg)} pro Monat`} />
            ) : null}
            <Stat value={plural(sessions, 'Einheit', 'Einheiten')} />
          </View>
          {fit.status === 'rising' ? (
            <ThemedText type="small" themeColor="textSecondary">
              {fit.plateauKg !== null
                ? 'Die Kurve flacht ab: je näher du deinem Limit kommst, desto langsamer geht es.'
                : 'Der Verlauf ist noch fast geradlinig, ein Plateau lässt sich noch nicht abschätzen.'}
            </ThemedText>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function Stat({ value, small }: { value: string; small?: boolean }) {
  const { shape, colors } = useAppTheme();
  return (
    <View
      style={[
        styles.stat,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: shape.borderWidth,
          borderRadius: shape.radius.md,
        },
      ]}
    >
      <ThemedText type={small ? 'small' : 'smallBold'} variant={small ? undefined : 'numeric'}>
        {value}
      </ThemedText>
    </View>
  );
}

function LegendItem({
  color,
  label,
  dashed,
  block,
}: {
  color: string;
  label: string;
  dashed?: boolean;
  block?: boolean;
}) {
  return (
    <View style={styles.legendItem}>
      <View
        style={
          block
            ? { width: 14, height: 10, backgroundColor: color }
            : {
                width: 16,
                height: 0,
                borderTopWidth: 3,
                borderColor: color,
                borderStyle: dashed ? 'dashed' : 'solid',
              }
        }
      />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    minHeight: 32,
    justifyContent: 'center',
  },
  big: { fontSize: 44, lineHeight: 50, fontWeight: 700 },
  chartCard: { gap: Spacing.two, paddingHorizontal: Spacing.two },
  legend: {
    flexDirection: 'row',
    // Wraps instead of running out of the card on a 360 dp phone.
    flexWrap: 'wrap',
    columnGap: Spacing.three,
    rowGap: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heading: { marginTop: Spacing.one },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  stat: { paddingHorizontal: 12, paddingVertical: 10 },
});
