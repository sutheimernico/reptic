/** Variant D — level and XP bar, streak flame and the week as quests. */
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { CountUp } from '@/components/motion/count-up';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { plural, formatDistance } from '@/domain/format';
import { useAppTheme } from '@/hooks/use-app-theme';

import { formatKg, type HeroModel } from './model';
import { Bar, GoalHint } from './parts';

function QuestCard({
  tag,
  tagColor,
  tagTextColor,
  title,
  pct,
  barColor,
  progress,
  done,
  delayMs,
  big,
}: {
  tag: string;
  tagColor: string;
  tagTextColor: string;
  title: string;
  pct: number;
  barColor: string;
  progress: React.ReactNode;
  done: boolean;
  delayMs: number;
  big?: boolean;
}) {
  const { colors: c } = useAppTheme();
  return (
    <Card style={styles.quest}>
      <View style={styles.questTop}>
        <View style={[styles.tag, { backgroundColor: tagColor, borderColor: c.border }]}>
          <ThemedText variant="label" style={[styles.tagText, { color: tagTextColor }]}>{tag}</ThemedText>
        </View>
        {done ? (
          <View style={styles.doneRow}>
            <Ionicons name="checkmark-circle" size={18} color={c.success} />
            <ThemedText variant="label" style={{ color: c.celebrate, fontSize: 13 }}>Geschafft</ThemedText>
          </View>
        ) : null}
      </View>
      <ThemedText variant="display" style={big ? styles.questTitleBig : styles.questTitle}>{title}</ThemedText>
      <Bar
        pct={pct}
        height={22}
        radius={11}
        fillColor={barColor}
        trackColor="#F2EADB"
        borderColor={c.border}
        borderWidth={2.5}
        striped
        delayMs={delayMs}
      />
      <ThemedText variant="label" style={styles.questProgress}>{progress}</ThemedText>
    </Card>
  );
}

export function ArcadeHero({ model }: { model: HeroModel }) {
  const { colors: c, shape } = useAppTheme();
  const xpPct = model.xpForNext > 0 ? Math.min(1, model.xpIntoLevel / model.xpForNext) : 0;
  const hasKm = model.km !== null && model.goalKm !== null;
  return (
    <View style={styles.wrap} accessibilityLabel={model.summary}>
      <View style={styles.top}>
        <View style={[styles.level, { backgroundColor: c.celebrate, borderColor: c.border }]}>
          <ThemedText variant="label" style={styles.levelText}>Level {model.level}</ThemedText>
        </View>
        <View style={styles.xp}>
          <Bar
            pct={xpPct}
            height={26}
            radius={13}
            fillColor={c.warning}
            trackColor="#FFFFFF"
            borderColor={c.border}
            borderWidth={shape.borderWidth}
          />
          <ThemedText variant="label" style={styles.xpText}>
            {model.xpIntoLevel} / {model.xpForNext} XP
          </ThemedText>
        </View>
        <View style={styles.flame}>
          <Ionicons
            testID="streak-flame"
            name="flame"
            size={26}
            color={model.streak > 0 ? '#FF7A1A' : c.textSecondary}
          />
          <ThemedText variant="display" style={styles.flameCount}>{model.streak}</ThemedText>
        </View>
      </View>

      <QuestCard
        tag="Wochen-Quest"
        tagColor={c.accent}
        tagTextColor="#FFFFFF"
        title={`${formatKg(model.goalKg)} kg bewegen`}
        pct={model.kgPct}
        barColor={c.accent}
        done={model.kgPct >= 1}
        delayMs={250}
        big
        progress={
          <>
            <CountUp value={model.kg} format={formatKg} variant="label" style={styles.questProgress} />
            {` / ${formatKg(model.goalKg)} kg`}
          </>
        }
      />
      {hasKm && model.km !== null && model.goalKm !== null ? (
        <QuestCard
          tag="Cardio-Quest"
          tagColor={c.accent2}
          tagTextColor={c.text}
          title={`${model.goalKm} km Cardio`}
          pct={model.kmPct}
          barColor={c.accent2}
          done={model.kmPct >= 1}
          delayMs={380}
          progress={`${formatDistance(model.km).replace(' km', '')} / ${model.goalKm} km`}
        />
      ) : null}
      <QuestCard
        tag="Rekord-Quest"
        tagColor={c.warning}
        tagTextColor={c.text}
        title="1 Rekord diese Woche"
        pct={model.weekPrs >= 1 ? 1 : 0}
        barColor={c.warning}
        done={model.weekPrs >= 1}
        delayMs={510}
        progress={model.weekPrs >= 1 ? plural(model.weekPrs, 'Rekord', 'Rekorde') : '0 / 1 Rekord'}
      />
      <GoalHint visible={model.kgIsSuggestion || (hasKm && model.kmIsSuggestion)} color={c.text} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  level: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 2.5,
    borderRadius: 10,
    shadowColor: '#161616',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  levelText: { color: '#FFFFFF', fontSize: 13 },
  xp: { flex: 1, justifyContent: 'center' },
  xpText: { position: 'absolute', right: 10, fontSize: 11 },
  flame: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  flameCount: { fontSize: 19, lineHeight: 24 },
  quest: { gap: 6, paddingVertical: 13, paddingHorizontal: 14 },
  questTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 24 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 2 },
  tagText: { fontSize: 10.5, letterSpacing: 0.8, textTransform: 'uppercase' },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  questTitleBig: { fontSize: 20, lineHeight: 25, marginBottom: 2 },
  questTitle: { fontSize: 16, lineHeight: 21, marginBottom: 2 },
  questProgress: { fontSize: 13 },
});
