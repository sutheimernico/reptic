import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { TextField } from '@/components/ui/text-field';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { createGym, getGyms, LAST_GYM_SETTING, setSetting } from '@/db';
import type { Gym } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

export default function GymSelectScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useTheme();
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [newName, setNewName] = useState('');

  useFocusEffect(
    useCallback(() => {
      getGyms(db).then(setGyms);
    }, [db]),
  );

  const select = async (id: number) => {
    await setSetting(db, LAST_GYM_SETTING, String(id));
    router.back();
  };

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    const id = await createGym(db, name);
    await select(id);
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Stack.Screen options={{ headerShown: true, title: 'Wo trainierst du heute?' }} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {gyms.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Leg dein erstes Gym an — jede Einheit gehört zu einem Gym, damit die Gewichte zu den
            Geräten vor Ort passen.
          </ThemedText>
        ) : (
          gyms.map((gym) => (
            <ListRow key={gym.id} title={gym.name} onPress={() => select(gym.id)} />
          ))
        )}

        <View style={styles.createBox}>
          <TextField
            label="Neues Gym"
            placeholder="z. B. FitX Innenstadt"
            value={newName}
            onChangeText={setNewName}
            autoCapitalize="sentences"
            returnKeyType="done"
            onSubmitEditing={create}
          />
          <Button label="Gym anlegen" icon="add" disabled={!newName.trim()} onPress={create} />
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
    gap: Spacing.two,
  },
  createBox: { gap: Spacing.two, marginTop: Spacing.three },
});
