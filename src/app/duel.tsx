import { Stack, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { DuelVisual } from '@/components/duel-visual';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { BottomTabInset, Spacing } from '@/constants/theme';
import {
  type FriendCard,
  getFriendCards,
  getSetting,
  getWeekOverview,
  importFriendCard,
  NAME_SETTING,
  setSetting,
  sortFriendCards,
  type WeekOverview,
} from '@/db';
import {
  cardFromProgress,
  cleanName,
  extractAndDecode,
  MAX_NAME_LENGTH,
  shareMessage,
  weekNumberOf,
} from '@/domain/week-card';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useTheme } from '@/hooks/use-theme';
import { showSaveError } from '@/lib/alerts';
import { shareWeekCard } from '@/lib/share-card';

const friendKey = (f: FriendCard) => `${f.card.n}|${f.card.w}`;

const FAILURE_TEXT = {
  'no-code': 'Kein Repz-Code gefunden',
  corrupt: 'Der Code ist beschädigt — bitte nochmal kopieren',
  version: 'Dieser Code ist von einer neueren Repz-Version',
} as const;

export default function DuelScreen() {
  const db = useSQLiteContext();
  const c = useTheme();
  const { shape, variant } = useAppTheme();
  const [name, setName] = useState('');
  const [overview, setOverview] = useState<WeekOverview | null>(null);
  const [friends, setFriends] = useState<FriendCard[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [askName, setAskName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(() => {
    getSetting(db, NAME_SETTING).then((v) => setName(v ?? ''));
    getWeekOverview(db, new Date()).then(setOverview).catch(() => setOverview(null));
    getFriendCards(db).then(setFriends);
  }, [db]);

  useFocusEffect(load);

  const weekKey = overview?.progress.weekKey ?? '';
  const myCard = overview ? cardFromProgress(name || 'Du', overview.progress) : null;
  const sorted = sortFriendCards(friends, weekKey);
  const thisWeek = sorted.filter((f) => f.card.w === weekKey);
  // Without a friend card for this week, show the latest one — the status says it is from another week.
  const candidates = thisWeek.length > 0 ? thisWeek : sorted.slice(0, 1);
  const friend = candidates.find((f) => friendKey(f) === selected) ?? candidates[0] ?? null;

  const share = async (shareName: string) => {
    // Re-read at share time so the code carries the numbers of this very moment.
    const fresh = await getWeekOverview(db, new Date());
    await shareWeekCard(shareMessage(cardFromProgress(shareName, fresh.progress)));
  };

  const onShare = () => {
    if (!name) {
      setAskName(true);
      return;
    }
    void share(name);
  };

  const onSaveName = async () => {
    const cleaned = cleanName(nameDraft);
    if (!cleaned) return;
    try {
      await setSetting(db, NAME_SETTING, cleaned);
    } catch (error) {
      showSaveError(error);
      return;
    }
    setName(cleaned);
    setAskName(false);
    void share(cleaned);
  };

  const onImport = async () => {
    const result = extractAndDecode(code);
    if (!result.ok) {
      setMessage(FAILURE_TEXT[result.reason]);
      return;
    }
    if (!myCard) {
      setMessage('Deine Woche wird noch geladen — versuch es gleich nochmal.');
      return;
    }
    try {
      const outcome = await importFriendCard(
        db,
        result.card,
        { name, card: myCard },
        new Date(),
      );
      if (outcome === 'own') {
        setMessage('Das ist deine eigene Karte');
        return;
      }
      setFriends(await getFriendCards(db));
      setSelected(friendKey({ card: result.card, importedAt: '' }));
      setCode('');
      setMessage(
        outcome === 'added'
          ? `Karte von ${result.card.n} importiert`
          : `Karte von ${result.card.n} aktualisiert`,
      );
    } catch (error) {
      showSaveError(error);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Stack.Screen options={{ headerShown: true, title: 'Wochen-Duell' }} />
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {weekKey && variant !== 'instrument' ? (
          <ThemedText type="small" themeColor="textSecondary">
            KW {weekNumberOf(weekKey)}
          </ThemedText>
        ) : null}

        {friend && myCard ? (
          <>
            {candidates.length > 1 ? (
              <View style={styles.chips} accessibilityRole="radiogroup">
                {candidates.map((f) => {
                  const active = friendKey(f) === friendKey(friend);
                  return (
                    <Pressable
                      key={friendKey(f)}
                      onPress={() => setSelected(friendKey(f))}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={f.card.n}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: active ? c.accent : c.backgroundElement,
                          borderColor: active ? c.accent : c.border,
                          borderRadius: shape.radius.md,
                        },
                      ]}>
                      <ThemedText type="smallBold" style={{ color: active ? c.onAccent : c.text }}>
                        {f.card.n}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            <DuelVisual me={myCard} friend={friend.card} importedAt={friend.importedAt} />
          </>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Noch kein Duell. Teile deine Wochenkarte per WhatsApp und importiere die Karte deines
            Freundes — ohne Konto, ohne Server.
          </ThemedText>
        )}

        <View style={styles.actions}>
          {askName ? (
            <View style={styles.block}>
              <TextField
                label="Dein Name"
                placeholder="So sehen dich deine Freunde"
                value={nameDraft}
                onChangeText={setNameDraft}
                maxLength={MAX_NAME_LENGTH}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={onSaveName}
              />
              <Button
                label="Name speichern und teilen"
                icon="share-outline"
                disabled={!cleanName(nameDraft)}
                onPress={onSaveName}
              />
            </View>
          ) : (
            <Button label="Wochenkarte teilen" icon="share-outline" onPress={onShare} />
          )}
        </View>

        <View style={styles.block}>
          <TextField
            label="Code eingeben"
            placeholder="Nachricht oder Code einfügen"
            value={code}
            onChangeText={(text) => {
              setCode(text);
              setMessage('');
            }}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button
            label="Importieren"
            icon="download-outline"
            variant="secondary"
            disabled={!code.trim()}
            onPress={onImport}
          />
          {message ? (
            <ThemedText type="smallBold" accessibilityRole="alert" style={{ color: c.accent }}>
              {message}
            </ThemedText>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: {
    padding: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderWidth: 1 },
  actions: { gap: Spacing.two },
  block: { gap: Spacing.two },
});
