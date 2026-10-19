/** Variant D — boss fight: two fighters, an HP bar per metric, a sticker for who leads. */
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Bar } from '@/components/week-hero/parts';
import { useAppTheme } from '@/hooks/use-app-theme';

import { friendColor, initialOf, type DuelMetric, type DuelModel } from './model';

function Hp({ m, name, mine, theirs, delay }: { m: DuelMetric; name: string; mine: string; theirs: string; delay: number }) {
  const { colors: c } = useAppTheme();
  const rows = [
    { who: 'Du', pct: m.mePct, text: m.meText, color: mine },
    { who: name, pct: m.friendPct, text: m.friendText, color: theirs },
  ];
  return (
    <View style={styles.hp}>
      <ThemedText variant="label" style={styles.hpLabel}>{m.label.toUpperCase()}</ThemedText>
      {rows.map((row, i) => (
        <View key={row.who} style={styles.hpRow}>
          <ThemedText type="small" style={styles.who} numberOfLines={1}>{row.who}</ThemedText>
          <Bar
            pct={row.pct}
            height={20}
            radius={10}
            fillColor={row.color}
            trackColor="#F2EADB"
            borderColor={c.border}
            borderWidth={2.5}
            delayMs={delay + i * 80}
            style={styles.flex}
          />
          <ThemedText variant="numeric" style={styles.hpValue}>{row.text}</ThemedText>
        </View>
      ))}
    </View>
  );
}

function Fighter({ name, initial = name, color, flip }: { name: string; initial?: string; color: string; flip?: boolean }) {
  const { colors: c } = useAppTheme();
  return (
    <View style={styles.fighter}>
      <View
        style={[
          styles.face,
          { backgroundColor: color, borderColor: c.border, transform: [{ rotate: flip ? '4deg' : '-4deg' }] },
        ]}>
        <ThemedText variant="display" style={styles.faceText}>{initialOf(initial)}</ThemedText>
      </View>
      <ThemedText variant="label" style={styles.fighterName} numberOfLines={1}>{name}</ThemedText>
    </View>
  );
}

export function ArcadeDuel({ model }: { model: DuelModel }) {
  const { colors: c, variant } = useAppTheme();
  const theirs = friendColor(variant, c.accent2);
  return (
    <View style={styles.wrap} accessibilityLabel={model.status}>
      <View style={styles.vs}>
        <Fighter name="Du" initial={model.meName} color={c.accent} />
        <ThemedText variant="display" style={[styles.vsX, { color: c.celebrate }]}>VS</ThemedText>
        <Fighter name={model.friendName} color={theirs} flip />
      </View>
      <Card style={styles.card}>
        <View style={[styles.sticker, { backgroundColor: c.warning, borderColor: c.border }]}>
          <ThemedText variant="label" style={styles.stickerText}>{model.headline}</ThemedText>
        </View>
        <Hp m={model.metrics.kg} name={model.friendName} mine={c.accent} theirs={theirs} delay={100} />
        <Hp m={model.metrics.km} name={model.friendName} mine={c.accent} theirs={theirs} delay={300} />
      </Card>
      <ThemedText variant="label" style={styles.msg}>{model.status}</ThemedText>
      {model.importedText ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.imported}>
          {model.importedText}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  flex: { flex: 1 },
  vs: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  fighter: { alignItems: 'center', gap: 8, width: 110 },
  face: { width: 76, height: 76, borderRadius: 24, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  faceText: { color: '#fff', fontSize: 34 },
  fighterName: { fontSize: 15 },
  vsX: { fontSize: 30 },
  card: { paddingTop: 22, gap: 14 },
  sticker: {
    position: 'absolute',
    top: -15,
    right: 14,
    borderWidth: 2.5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    transform: [{ rotate: '6deg' }],
    zIndex: 1,
  },
  stickerText: { fontSize: 13, color: '#161616' },
  hp: { gap: 6 },
  hpLabel: { fontSize: 12.5, letterSpacing: 0.8 },
  hpRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  who: { width: 46, fontWeight: '700' },
  hpValue: { width: 66, textAlign: 'right', fontSize: 15 },
  msg: { marginHorizontal: 4, fontSize: 15, lineHeight: 22 },
  imported: { marginHorizontal: 4, fontSize: 12 },
});
