/** Variant A — glass card, two avatars facing off, a pair of thin bars per metric. */
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Bar } from '@/components/week-hero/parts';
import { useAppTheme } from '@/hooks/use-app-theme';

import { friendColor, initialOf, type DuelMetric, type DuelModel } from './model';

function Metric({ m, mine, theirs, delay }: { m: DuelMetric; mine: string; theirs: string; delay: number }) {
  const { colors: c } = useAppTheme();
  const dim = c.textSecondary;
  return (
    <View style={styles.metric}>
      <View style={styles.row}>
        <ThemedText variant="numeric" style={[styles.value, { color: m.lead === 'friend' ? dim : c.text }]}>
          {m.meText}
        </ThemedText>
        <ThemedText type="small" variant="label" themeColor="textSecondary" style={styles.metricLabel}>
          {m.label.toUpperCase()}
        </ThemedText>
        <ThemedText variant="numeric" style={[styles.value, { color: m.lead === 'me' ? dim : c.text }]}>
          {m.friendText}
        </ThemedText>
      </View>
      <Bar pct={m.mePct} height={8} radius={4} fillColor={mine} trackColor={c.surfaceStrong} delayMs={delay} />
      <Bar pct={m.friendPct} height={8} radius={4} fillColor={theirs} trackColor={c.surfaceStrong} delayMs={delay + 80} />
    </View>
  );
}

function Player({ name, initial = name, color }: { name: string; initial?: string; color: string }) {
  return (
    <View style={styles.player}>
      <View style={[styles.avatar, { backgroundColor: color }]}>
        <ThemedText variant="display" style={styles.avatarText}>{initialOf(initial)}</ThemedText>
      </View>
      <ThemedText type="smallBold" numberOfLines={1}>{name}</ThemedText>
    </View>
  );
}

export function EvolvedDuel({ model }: { model: DuelModel }) {
  const { colors: c, variant } = useAppTheme();
  const theirs = friendColor(variant, c.accent2);
  return (
    <View style={styles.wrap} accessibilityLabel={model.status}>
      <Card style={styles.card}>
        <View style={styles.top}>
          <Player name="Du" initial={model.meName} color={c.accent} />
          <View style={[styles.vs, { borderColor: c.border }]}>
            <ThemedText type="small" variant="label" themeColor="textSecondary">VS</ThemedText>
          </View>
          <Player name={model.friendName} color={theirs} />
        </View>
        <Metric m={model.metrics.kg} mine={c.accent} theirs={theirs} delay={100} />
        <Metric m={model.metrics.km} mine={c.accent} theirs={theirs} delay={250} />
      </Card>
      <Card style={styles.lead}>
        <Ionicons name="flash" size={16} color={c.warning} style={styles.bolt} />
        <ThemedText type="small" style={styles.flex}>{model.status}</ThemedText>
      </Card>
      {model.importedText ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.imported}>
          {model.importedText}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  flex: { flex: 1 },
  card: { paddingVertical: 18, paddingHorizontal: 16, gap: 6 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  player: { alignItems: 'center', gap: 6, width: 84 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 20 },
  vs: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  metric: { gap: 5, marginTop: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  value: { fontSize: 22, lineHeight: 28 },
  metricLabel: { fontSize: 10.5, letterSpacing: 1.1 },
  lead: { flexDirection: 'row', gap: 10, paddingVertical: 14 },
  bolt: { marginTop: 2 },
  imported: { marginHorizontal: 4, fontSize: 12 },
});
