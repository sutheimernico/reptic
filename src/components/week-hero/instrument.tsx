/** Variant E — cockpit: segmented gauge for the week's load, per-day bars and monospace readouts. */
import { type ReactNode, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Polyline } from 'react-native-svg';

import { CountUp } from '@/components/motion/count-up';
import { ThemedText } from '@/components/themed-text';
import { formatWeight } from '@/domain/format';
import { useAppTheme } from '@/hooks/use-app-theme';

import { DAY_LABELS, formatKg, type HeroModel } from './model';
import { GaugeTick, GoalHint } from './parts';

const TICKS = 34;
const GAUGE_W = 220;
const GAUGE_H = 128;
const CX = 110;
const CY = 106;

const percentText = (pct: number) => `${(pct * 100).toFixed(1).replace('.', ',')} %`;

function Gauge({ pct }: { pct: number }) {
  const { colors: c } = useAppTheme();
  const lit = Math.round(pct * TICKS);
  const ticks = [];
  for (let i = 0; i < TICKS; i += 1) {
    const th = ((196 - (212 * i) / (TICKS - 1)) * Math.PI) / 180;
    ticks.push(
      <GaugeTick
        key={i}
        index={i}
        x1={CX + 76 * Math.cos(th)}
        y1={CY - 76 * Math.sin(th)}
        x2={CX + 92 * Math.cos(th)}
        y2={CY - 92 * Math.sin(th)}
        lit={i < lit}
        tip={i === lit - 1}
        litColor={c.accent}
        tipColor={c.accent2}
        offColor="#262C35"
      />,
    );
  }
  return (
    <Svg width={GAUGE_W} height={GAUGE_H} viewBox={`0 0 ${GAUGE_W} ${GAUGE_H}`}>
      {ticks}
    </Svg>
  );
}

/** Corner brackets and a hairline: the panel look, drawn with two small views. */
function Panel({ title, tag, children }: { title: string; tag: string; children: ReactNode }) {
  const { colors: c, fonts } = useAppTheme();
  return (
    <View style={[styles.panel, { backgroundColor: c.card, borderColor: c.border }]}>
      <View pointerEvents="none" style={[styles.cornerTl, { borderColor: c.accent }]} />
      <View pointerEvents="none" style={[styles.cornerBr, { borderColor: c.accent }]} />
      <View style={styles.panelHead}>
        <ThemedText themeColor="textSecondary" style={[styles.mono, { fontFamily: fonts.label }]}>{title}</ThemedText>
        <ThemedText style={[styles.mono, { color: c.accent, fontFamily: fonts.label }]}>{tag}</ThemedText>
      </View>
      {children}
    </View>
  );
}

function DayBar({ ratio, kind, label, index }: { ratio: number; kind: 'past' | 'today' | 'future'; label: string; index: number }) {
  const { colors: c, fonts } = useAppTheme();
  const reduced = useReducedMotion();
  const scale = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) scale.value = withDelay(350 + index * 40, withTiming(1, { duration: 500 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: scale.value }] }));
  const height = kind === 'future' ? 8 : Math.max(2, Math.round(ratio * 38));
  return (
    <View style={styles.dayCol}>
      <View style={styles.dayBarArea}>
        <Animated.View
          style={[
            { height, transformOrigin: 'bottom' },
            kind === 'future'
              ? { borderWidth: 1, borderStyle: 'dashed', borderColor: '#333A44' }
              : { backgroundColor: kind === 'today' && ratio === 0 ? c.accent2 : c.accent, opacity: 0.9 },
            kind === 'today' && ratio === 0 && { height: 3 },
            style,
          ]}
        />
      </View>
      <ThemedText
        style={[styles.dayLabel, { fontFamily: fonts.numeric, color: kind === 'today' ? c.accent2 : c.textSecondary }]}>
        {label.toUpperCase()}
      </ThemedText>
    </View>
  );
}

function Spark({ values, color }: { values: number[]; color: string }) {
  const w = 130;
  const h = 18;
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (values.length < 2 || max <= 0) return null;
  const points = values
    .map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - min) / (max - min || 1)) * (h - 4)).toFixed(1)}`)
    .join(' ');
  return (
    <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={styles.spark}>
      <Polyline points={points} fill="none" stroke={color} strokeWidth={1.4} />
    </Svg>
  );
}

function Tile({ label, value, sub, spark }: { label: string; value: string; sub: string; spark?: ReactNode }) {
  const { colors: c, fonts } = useAppTheme();
  return (
    <View style={[styles.tile, { backgroundColor: c.card, borderColor: c.border }]}>
      <ThemedText themeColor="textSecondary" style={[styles.tileLabel, { fontFamily: fonts.label }]}>{label}</ThemedText>
      <ThemedText variant="numeric" style={styles.tileValue}>{value}</ThemedText>
      <ThemedText style={[styles.tileSub, { color: c.accent, fontFamily: fonts.label }]}>{sub}</ThemedText>
      {spark}
    </View>
  );
}

export function InstrumentHero({ model }: { model: HeroModel }) {
  const { colors: c, fonts } = useAppTheme();
  const maxDay = Math.max(0, ...model.days.map((d) => d.volumeKg));
  const hasKm = model.km !== null && model.goalKm !== null;
  return (
    <View style={styles.wrap} accessibilityLabel={model.summary}>
      <Panel title="WOCHENLAST" tag={`KW ${model.week}`}>
        <View style={styles.gauge}>
          <Gauge pct={model.kgPct} />
          <View style={styles.read}>
            <CountUp value={model.kg} format={formatKg} variant="numeric" style={styles.readValue} />
            <ThemedText themeColor="textSecondary" style={[styles.readUnit, { fontFamily: fonts.label }]}>
              KG / {formatKg(model.goalKg)}
            </ThemedText>
            <ThemedText style={[styles.readPct, { color: c.accent, fontFamily: fonts.label }]}>
              {percentText(model.kgPct)}
            </ThemedText>
          </View>
        </View>
        <View style={[styles.days, { borderTopColor: c.border }]}>
          {DAY_LABELS.map((label, i) => (
            <DayBar
              key={label}
              index={i}
              label={label}
              ratio={maxDay > 0 ? model.days[i].volumeKg / maxDay : 0}
              kind={i < model.todayIndex ? 'past' : i === model.todayIndex ? 'today' : 'future'}
            />
          ))}
        </View>
        <GoalHint visible={model.kgIsSuggestion || (hasKm && model.kmIsSuggestion)} color={c.accent} />
      </Panel>

      <View style={styles.grid}>
        {hasKm && model.km !== null && model.goalKm !== null ? (
          <Tile
            label="CARDIO"
            value={formatWeight(model.km)}
            sub={`KM / ${model.goalKm} · ${Math.round(model.kmPct * 100)} %`}
            spark={<Spark values={model.weeklyKm} color={c.accent} />}
          />
        ) : null}
        <Tile label="SERIE" value={String(model.streak)} sub="WOCHEN" />
        <Tile label="EINHEITEN" value={String(model.sessions)} sub="DIESE WOCHE" />
        <Tile label="REKORDE" value={String(model.weekPrs)} sub="DIESE WOCHE" />
        {!hasKm ? <Tile label="XP" value={formatKg(model.xp)} sub={`LEVEL ${model.level}`} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  panel: { borderWidth: 1, padding: 12, gap: 6 },
  cornerTl: { position: 'absolute', top: -1, left: -1, width: 10, height: 10, borderTopWidth: 2, borderLeftWidth: 2 },
  cornerBr: { position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderBottomWidth: 2, borderRightWidth: 2 },
  panelHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  mono: { fontSize: 10, letterSpacing: 1.2 },
  gauge: { alignItems: 'center', height: 116, overflow: 'hidden' },
  read: { position: 'absolute', top: 46, left: 0, right: 0, alignItems: 'center' },
  readValue: { fontSize: 32, lineHeight: 34, letterSpacing: -1 },
  readUnit: { fontSize: 10, letterSpacing: 1, lineHeight: 18 },
  readPct: { fontSize: 11 },
  days: { flexDirection: 'row', gap: 6, height: 62, borderTopWidth: 1, borderStyle: 'dashed', paddingTop: 8 },
  dayCol: { flex: 1, justifyContent: 'flex-end', gap: 4 },
  dayBarArea: { height: 38, justifyContent: 'flex-end' },
  dayLabel: { fontSize: 9, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexBasis: '47%', flexGrow: 1, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 8 },
  tileLabel: { fontSize: 9.5, letterSpacing: 1.1 },
  tileValue: { fontSize: 20, lineHeight: 24, marginTop: 4 },
  tileSub: { fontSize: 9.5, letterSpacing: 0.6 },
  spark: { marginTop: 6 },
});
