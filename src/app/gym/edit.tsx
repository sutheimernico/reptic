import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { createGym, deleteGym, getGym, gymHasWorkouts, setGymArchived, updateGym } from '@/db';
import { useTheme } from '@/hooks/use-theme';

export default function GymEditScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingId = id ? Number(id) : null;
  const isEditing = editingId !== null;

  const [name, setName] = useState('');
  const [hasWorkouts, setHasWorkouts] = useState(false);
  const [archived, setArchived] = useState(false);

  useEffect(() => {
    if (editingId === null) return;
    let active = true;
    (async () => {
      const gym = await getGym(db, editingId);
      const used = await gymHasWorkouts(db, editingId);
      if (active && gym) {
        setName(gym.name);
        setArchived(gym.archived);
        setHasWorkouts(used);
      }
    })();
    return () => {
      active = false;
    };
  }, [db, editingId]);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (isEditing) {
      await updateGym(db, editingId, trimmed);
    } else {
      await createGym(db, trimmed);
    }
    router.back();
  };

  const confirmRemove = () => {
    if (editingId === null) return;
    const archive = hasWorkouts;
    Alert.alert(
      archive ? 'Gym archivieren?' : 'Gym löschen?',
      archive
        ? 'In diesem Gym hast du bereits trainiert. Es wird archiviert (aus der Auswahl entfernt, Verlauf bleibt erhalten).'
        : 'Dieses Gym wird endgültig gelöscht.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: archive ? 'Archivieren' : 'Löschen',
          style: 'destructive',
          onPress: async () => {
            if (archive) await setGymArchived(db, editingId, true);
            else await deleteGym(db, editingId);
            router.back();
          },
        },
      ],
    );
  };

  const unarchive = async () => {
    if (editingId === null) return;
    await setGymArchived(db, editingId, false);
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Stack.Screen
        options={{ headerShown: true, title: isEditing ? 'Gym bearbeiten' : 'Neues Gym' }}
      />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="z. B. FitX Innenstadt"
          autoFocus={!isEditing}
          returnKeyType="done"
          onSubmitEditing={save}
        />

        <Button label="Speichern" icon="checkmark" onPress={save} disabled={!name.trim()} />

        {isEditing && archived ? (
          <Button label="Reaktivieren" icon="refresh" variant="secondary" onPress={unarchive} />
        ) : null}

        {isEditing && !archived ? (
          <Button
            label={hasWorkouts ? 'Archivieren' : 'Löschen'}
            icon={hasWorkouts ? 'archive-outline' : 'trash-outline'}
            variant={hasWorkouts ? 'secondary' : 'danger'}
            onPress={confirmRemove}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: {
    padding: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
  },
});
