/** Variant E — split readout: DU / FRIEND columns per metric with the delta in between. */
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAppTheme } from '@/hooks/use-app-theme';

import { friendColor, type DuelMetric, type DuelModel } from './model';

function Row({ m, mine, theirs }: { m: DuelMetric; mine: string; theirs: string }) {
  const { colors: c } = useAppTheme();
  const arrow = m.lead === 'me' ? '▲' : m.lead === 'friend' ? '▼' : '■';
  const deltaColor = m.lead === 'me' ? c.success : m.lead === 'friend' ? c.danger : c.textSecondary;
  return (
    <View style={[styles.row, { borderTopColor: c.border }]}>
      <ThemedText variant="label" themeColor="textSecondary" style={styles.rowLabel}>
        {m.label.toUpperCase()}
      </ThemedText>
      <View style={styles.cols}>
        <ThemedText variant="numeric" style={[styles.value, { color: m.lead === 'friend' ? c.textSecondary : mine }]}>
          {m.meText}
        </ThemedText>
        <ThemedText variant="numeric" style={[styles.delta, { color: deltaColor }]}>
          {arrow} {m.deltaText}
        </ThemedText>
        <ThemedText variant="numeric" style={[styles.value, styles.right, { color: m.lead === 'me' ? c.textSecondary : theirs }]}>
          {m.friendText}
        </ThemedText>
      </View>
    </View>
  );
}

export function InstrumentDuel({ model }: { model: DuelModel }) {
  const { colors: c, variant } = useAppTheme();
  const theirs = friendColor(variant, c.accent2);
  const { kg, km, s } = model.metrics;
  return (
    <View style={styles.wrap} accessibilityLabel={model.status}>
      <View style={styles.stat}>
        <ThemedText variant="label" themeColor="textSecondary" style={styles.small}>
          DUELL · {model.weekLabel}
        </ThemedText>
      </View>
      <View style={[styles.panel, { borderColor: c.border, backgroundColor: c.card }]}>
        <View style={styles.head}>
          <ThemedText variant="label" themeColor="textSecondary" style={styles.small}>VERGLEICH</ThemedText>
          <ThemedText variant="label" style={styles.small}>
            <ThemedText variant="label" style={[styles.small, { color: c.accent }]}>DU</ThemedText>
            <ThemedText variant="label" themeColor="textSecondary" style={styles.small}> / </ThemedText>
            <ThemedText variant="label" style={[styles.small, { color: theirs }]}>
              {model.friendName.toUpperCase()}
            </ThemedText>
          </ThemedText>
        </View>
        <Row m={kg} mine={c.accent} theirs={theirs} />
        <Row m={km} mine={c.accent} theirs={theirs} />
        <Row m={s} mine={c.accent} theirs={theirs} />
      </View>
      <View style={[styles.panel, styles.statusPanel, { borderColor: c.border, backgroundColor: c.card }]}>
        <ThemedText variant="label" themeColor="textSecondary" style={styles.small}>STATUS</ThemedText>
        <ThemedText variant="numeric" style={styles.statusText}>{model.status}</ThemedText>
        {model.importedText ? (
          <ThemedText variant="label" themeColor="textSecondary" style={styles.small}>
            {model.importedText.toUpperCase()}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  stat: { flexDirection: 'row', justifyContent: 'space-between' },
  small: { fontSize: 11, letterSpacing: 1 },
  panel: { borderWidth: 1, padding: 12 },
  statusPanel: { gap: 6 },
  head: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  row: { borderTopWidth: 1, paddingVertical: 10, gap: 6 },
  rowLabel: { fontSize: 10.5, letterSpacing: 1 },
  cols: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  value: { fontSize: 20, lineHeight: 26, flex: 1 },
  right: { textAlign: 'right' },
  delta: { fontSize: 12, textAlign: 'center' },
  statusText: { fontSize: 13, lineHeight: 20 },
});
