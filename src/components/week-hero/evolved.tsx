/** Variant A — glass card, one gradient ring with the week's kilos, cardio as a small second ring. */
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { CountUp } from '@/components/motion/count-up';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { useAppTheme } from '@/hooks/use-app-theme';
import { formatDistance } from '@/domain/format';

import { formatKg, streakLabel, type HeroModel } from './model';
import { GoalHint, Ring } from './parts';

export function EvolvedHero({ model }: { model: HeroModel }) {
  const { colors: c, scheme } = useAppTheme();
  const ringEnd = scheme === 'dark' ? '#C4B5FD' : c.accentEnd;
  // No streak yet: a muted chip, not a flame that suggests one.
  const lit = model.streak > 0;
  const flame = lit ? '#FB923C' : c.textSecondary;
  return (
    <Card style={styles.card} accessibilityLabel={model.summary}>
      <View style={styles.ringWrap}>
        <Ring
          size={146}
          strokeWidth={13}
          pct={model.kgPct}
          color={c.accent}
          gradient={[c.accent, ringEnd]}
          trackColor={c.surfaceStrong}
        />
        <View style={styles.ringCenter}>
          <CountUp value={model.kg} format={(n) => formatKg(n)} variant="numeric" style={styles.big} />
          <ThemedText type="small" themeColor="textSecondary">kg bewegt</ThemedText>
          <ThemedText type="small" variant="label" style={{ color: c.accent }}>
            Ziel {formatKg(model.goalKg)}
          </ThemedText>
        </View>
      </View>

      <View style={styles.side}>
        {model.km !== null && model.goalKm !== null ? (
          <View style={styles.mini}>
            <Ring
              size={50}
              strokeWidth={6}
              pct={model.kmPct}
              color={c.accent2}
              gradient={['#22D3EE', c.accent]}
              trackColor={c.surfaceStrong}
              delayMs={150}
            />
            <View style={styles.flex}>
              <ThemedText variant="numeric" style={styles.miniValue}>{formatDistance(model.km)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.miniLabel}>
                Cardio, Ziel {model.goalKm}
              </ThemedText>
            </View>
          </View>
        ) : null}
        <View style={[styles.streak, { backgroundColor: lit ? 'rgba(251,146,60,0.14)' : c.surfaceStrong }]}>
          <Ionicons name="flame" size={15} color={flame} />
          <ThemedText type="small" variant="label" style={{ color: flame }}>{streakLabel(model.streak)}</ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          {model.remainingKg > 0 ? `Noch ${formatKg(model.remainingKg)} kg bis zum Ziel` : 'Wochenziel geschafft'}
        </ThemedText>
        <GoalHint visible={model.kgIsSuggestion || (model.km !== null && model.kmIsSuggestion)} color={c.accent} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 18, paddingHorizontal: 16 },
  flex: { flex: 1 },
  ringWrap: { width: 146, height: 146 },
  ringCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  big: { fontSize: 26, lineHeight: 30, letterSpacing: -0.5 },
  side: { flex: 1, gap: 10, minWidth: 0 },
  mini: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  miniValue: { fontSize: 17, lineHeight: 22 },
  miniLabel: { fontSize: 12, lineHeight: 16 },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
  },
  note: { fontSize: 12, lineHeight: 17 },
});
