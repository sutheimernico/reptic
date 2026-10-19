/**
 * Heute's compact duel entry: you vs. the friend with a card for this week, or an invitation to
 * add the first one. Tokens only — the full skinned visual lives on the duel screen.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { type FriendCard, getFriendCards, getSetting, NAME_SETTING, sortFriendCards, type WeekOverview } from '@/db';
import { formatVolume } from '@/domain/format';
import { cardFromProgress, duelStatus, weekNumberOf } from '@/domain/week-card';
import { useTheme } from '@/hooks/use-theme';

export function DuelCard({ overview }: { overview: WeekOverview }) {
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useTheme();
  const [friends, setFriends] = useState<FriendCard[]>([]);
  const [name, setName] = useState('');

  useFocusEffect(
    useCallback(() => {
      getFriendCards(db).then(setFriends).catch(() => setFriends([]));
      getSetting(db, NAME_SETTING).then((v) => setName(v ?? '')).catch(() => setName(''));
    }, [db]),
  );

  const open = () => router.push('/duel');
  const top = sortFriendCards(friends, overview.progress.weekKey)[0];

  if (!top) {
    return (
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel="Fordere Freunde heraus"
        accessibilityHint="Öffnet das Wochen-Duell">
        <Card style={styles.row}>
          <Ionicons name="trophy-outline" size={22} color={c.accent} />
          <View style={styles.flex}>
            <ThemedText type="smallBold">Fordere Freunde heraus</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Tausche Wochenkarten per WhatsApp und vergleicht euch.
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
        </Card>
      </Pressable>
    );
  }

  const me = cardFromProgress(name || 'Du', overview.progress);
  const status = duelStatus(me, top.card);
  const sameWeek = top.card.w === me.w;
  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`Duell mit ${top.card.n}. ${status}`}>
      <Card style={styles.col}>
        <View style={styles.head}>
          <ThemedText type="smallBold">Duell mit {top.card.n}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            KW {weekNumberOf(top.card.w)}
          </ThemedText>
        </View>
        {sameWeek ? (
          <View style={styles.head}>
            <ThemedText variant="numeric" style={styles.num}>Du {formatVolume(me.kg)}</ThemedText>
            <ThemedText variant="numeric" style={[styles.num, { color: c.textSecondary }]}>
              {top.card.n} {formatVolume(top.card.kg)}
            </ThemedText>
          </View>
        ) : null}
        <ThemedText type="small" themeColor="textSecondary">
          {status}
        </ThemedText>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  col: { gap: 6 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  num: { fontSize: 16, lineHeight: 22 },
});
