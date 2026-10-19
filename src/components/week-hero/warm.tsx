/** Variant C — nested activity rings (kg outside, km inside), a legend and the week's training days. */
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { CountUp } from '@/components/motion/count-up';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { formatDistance } from '@/domain/format';
import { useAppTheme } from '@/hooks/use-app-theme';

import { DAY_LABELS, formatKg, streakLabel, type HeroModel } from './model';
import { GoalHint, Ring } from './parts';

export function WarmHero({ model }: { model: HeroModel }) {
  const { colors: c } = useAppTheme();
  const hasKm = model.km !== null && model.goalKm !== null;
  return (
    <View style={styles.wrap} accessibilityLabel={model.summary}>
      <Card style={styles.rings}>
        <View style={styles.ringBox}>
          <Ring size={150} strokeWidth={15} pct={model.kgPct} color={c.accent} trackColor={c.backgroundSelected} />
          {hasKm ? (
            <View style={styles.inner}>
              <Ring
                size={106}
                strokeWidth={15}
                pct={model.kmPct}
                color={c.accent2}
                trackColor="rgba(124,140,60,0.16)"
                delayMs={200}
              />
            </View>
          ) : null}
        </View>
        <View style={styles.legend}>
          <View style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: c.accent }]} />
            <View>
              <ThemedText type="small" themeColor="textSecondary" style={styles.small}>Bewegt</ThemedText>
              <View style={styles.value}>
                <CountUp value={model.kg} format={formatKg} variant="numeric" style={styles.big} />
                <ThemedText variant="numeric" style={styles.big}> kg</ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary" style={styles.small}>von {formatKg(model.goalKg)}</ThemedText>
            </View>
          </View>
          {hasKm && model.km !== null && model.goalKm !== null ? (
            <View style={styles.legendRow}>
              <View style={[styles.dot, { backgroundColor: c.accent2 }]} />
              <View>
                <ThemedText type="small" themeColor="textSecondary" style={styles.small}>Cardio</ThemedText>
                <ThemedText variant="numeric" style={styles.big}>{formatDistance(model.km)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.small}>von {model.goalKm}</ThemedText>
              </View>
            </View>
          ) : null}
          <GoalHint visible={model.kgIsSuggestion || (hasKm && model.kmIsSuggestion)} color={c.accent} />
        </View>
      </Card>

      <Card style={styles.week}>
        <View style={styles.weekTop}>
          <ThemedText type="smallBold">Diese Woche</ThemedText>
          <View style={styles.streak}>
            <Ionicons name="flame" size={14} color={c.accent} />
            <ThemedText type="small" variant="label" style={{ color: c.accent }}>{streakLabel(model.streak)}</ThemedText>
          </View>
        </View>
        <View style={styles.days}>
          {DAY_LABELS.map((label, i) => {
            const done = model.days[i]?.trained ?? false;
            const today = i === model.todayIndex;
            return (
              <View key={label} style={styles.day}>
                <View
                  style={[
                    styles.dayDot,
                    done && { backgroundColor: c.accent2 },
                    !done && { backgroundColor: today ? 'transparent' : c.surfaceStrong },
                    today && !done && { borderWidth: 2, borderStyle: 'dashed', borderColor: c.accent },
                  ]}>
                  {done ? <Ionicons name="checkmark" size={16} color={c.onAccent} /> : null}
                </View>
                <ThemedText
                  type="small"
                  variant={today ? 'label' : undefined}
                  style={[styles.dayLabel, { color: today ? c.accent : c.textSecondary }]}>
                  {label}
                </ThemedText>
              </View>
            );
          })}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  rings: { flexDirection: 'row', alignItems: 'center', gap: 18, padding: 18 },
  ringBox: { width: 150, height: 150 },
  inner: { position: 'absolute', top: 22, left: 22 },
  legend: { flex: 1, gap: 14, minWidth: 0 },
  legendRow: { flexDirection: 'row', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  small: { fontSize: 12, lineHeight: 16 },
  value: { flexDirection: 'row', alignItems: 'baseline' },
  big: { fontSize: 19, lineHeight: 24 },
  week: { padding: 18, gap: 12 },
  weekTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: 6, flex: 1 },
  dayDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dayLabel: { fontSize: 11, lineHeight: 14 },
});
