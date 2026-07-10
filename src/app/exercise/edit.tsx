import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import {
  createExercise,
  deleteExercise,
  exerciseHasHistory,
  getExercise,
  setExerciseArchived,
  updateExercise,
} from '@/db';
import { MUSCLE_GROUPS, type MuscleGroup } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { showSaveError } from '@/lib/alerts';

export default function ExerciseEditScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingId = id ? Number(id) : null;
  const isEditing = editingId !== null;

  const [name, setName] = useState('');
  const [group, setGroup] = useState<MuscleGroup>('Brust');
  const [hasHistory, setHasHistory] = useState(false);
  const [archived, setArchived] = useState(false);

  useEffect(() => {
    if (editingId === null) return;
    let active = true;
    (async () => {
      const exercise = await getExercise(db, editingId);
      const history = await exerciseHasHistory(db, editingId);
      if (active && exercise) {
        setName(exercise.name);
        setGroup(exercise.muscleGroup);
        setHasHistory(history);
        setArchived(exercise.archived);
      }
    })();
    return () => {
      active = false;
    };
  }, [db, editingId]);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      if (isEditing) {
        await updateExercise(db, editingId, trimmed, group);
      } else {
        await createExercise(db, trimmed, group);
      }
    } catch (error) {
      showSaveError(error);
      return;
    }
    router.back();
  };

  const confirmRemove = () => {
    if (editingId === null) return;
    const archive = hasHistory;
    Alert.alert(
      archive ? 'Übung archivieren?' : 'Übung löschen?',
      archive
        ? 'Diese Übung steckt in deiner Historie. Sie wird archiviert (aus der Auswahl entfernt, Verlauf bleibt erhalten).'
        : 'Diese Übung wird endgültig gelöscht. Steckt sie in einem Plan, wird sie auch daraus entfernt.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: archive ? 'Archivieren' : 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              if (archive) await setExerciseArchived(db, editingId, true);
              else await deleteExercise(db, editingId);
            } catch (error) {
              showSaveError(error);
              return;
            }
            router.back();
          },
        },
      ],
    );
  };

  const unarchive = async () => {
    if (editingId === null) return;
    try {
      await setExerciseArchived(db, editingId, false);
    } catch (error) {
      showSaveError(error);
      return;
    }
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Stack.Screen
        options={{ headerShown: true, title: isEditing ? 'Übung bearbeiten' : 'Neue Übung' }}
      />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="z. B. Bankdrücken"
          autoFocus={!isEditing}
          returnKeyType="done"
          onSubmitEditing={save}
        />

        <View style={styles.groupBlock}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.groupLabel}>
            Muskelgruppe
          </ThemedText>
          <View style={styles.chips}>
            {MUSCLE_GROUPS.map((muscleGroup) => {
              const active = muscleGroup === group;
              return (
                <Pressable
                  key={muscleGroup}
                  onPress={() => setGroup(muscleGroup)}
                  style={[
                    styles.chip,
                    {
                      borderColor: active ? c.accent : c.border,
                      backgroundColor: active ? c.backgroundSelected : c.card,
                    },
                  ]}>
                  <ThemedText type="small" style={{ color: active ? c.accent : c.text }}>
                    {muscleGroup}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Button label="Speichern" icon="checkmark" onPress={save} disabled={!name.trim()} />

        {isEditing && hasHistory ? (
          <Button
            label="Fortschritt ansehen"
            icon="trending-up"
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: '/exercise/progress',
                params: { id: String(editingId), name: name.trim() },
              })
            }
          />
        ) : null}

        {isEditing && archived ? (
          <Button label="Reaktivieren" icon="refresh" variant="secondary" onPress={unarchive} />
        ) : null}

        {isEditing && !archived ? (
          <Button
            label={hasHistory ? 'Archivieren' : 'Löschen'}
            icon={hasHistory ? 'archive-outline' : 'trash-outline'}
            variant={hasHistory ? 'secondary' : 'danger'}
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
  groupBlock: { gap: Spacing.two },
  groupLabel: { marginLeft: Spacing.half },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
});
