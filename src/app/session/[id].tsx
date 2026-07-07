import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { SwipeToDelete } from '@/components/ui/swipe-to-delete';
import { Spacing } from '@/constants/theme';
import {
  finishWorkout,
  getGym,
  getSetProgressForWorkout,
  getWorkout,
  getWorkoutExercises,
  removeWorkoutExercise,
  type SetProgress,
  type WorkoutExerciseWithExercise,
} from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { showSaveError } from '@/lib/alerts';

export default function SessionScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const workoutId = Number(id);

  const [exercises, setExercises] = useState<WorkoutExerciseWithExercise[]>([]);
  const [progress, setProgress] = useState<Map<number, SetProgress>>(new Map());
  const [gymName, setGymName] = useState<string | null>(null);

  const load = useCallback(() => {
    getWorkoutExercises(db, workoutId).then(setExercises);
    getSetProgressForWorkout(db, workoutId).then(setProgress);
    getWorkout(db, workoutId)
      .then((w) => (w ? getGym(db, w.gymId) : null))
      .then((g) => setGymName(g?.name ?? null));
  }, [db, workoutId]);

  useFocusEffect(useCallback(() => load(), [load]));

  const openExercise = (we: WorkoutExerciseWithExercise) => {
    router.push({
      pathname: '/session/exercise',
      params: {
        workoutId: String(workoutId),
        workoutExerciseId: String(we.id),
        exerciseId: String(we.exerciseId),
        name: we.exercise.name,
      },
    });
  };

  const removeExercise = async (we: WorkoutExerciseWithExercise) => {
    try {
      await removeWorkoutExercise(db, we.id);
      load();
    } catch (error) {
      showSaveError(error);
    }
  };

  // Long-press keeps a confirmation dialog (the careful path); the swipe
  // gesture deletes directly (the quick path).
  const confirmRemove = (we: WorkoutExerciseWithExercise) => {
    Alert.alert(
      'Übung entfernen?',
      `„${we.exercise.name}" wird aus dieser Einheit entfernt (samt eingetragener Sätze).`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Entfernen', style: 'destructive', onPress: () => removeExercise(we) },
      ],
    );
  };

  const finish = () => {
    Alert.alert('Einheit beenden?', 'Die Einheit wird abgeschlossen und im Verlauf gespeichert.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Beenden',
        onPress: async () => {
          await finishWorkout(db, workoutId, new Date().toISOString());
          router.back();
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Stack.Screen
        options={{ headerShown: true, title: gymName ? `Einheit · ${gymName}` : 'Einheit' }}
      />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {exercises.length === 0 ? (
          <EmptyState
            icon="barbell-outline"
            title="Noch keine Übungen"
            message="Füge unten eine Übung hinzu."
          />
        ) : (
          exercises.map((we) => {
            const p = progress.get(we.id);
            return (
              <SwipeToDelete
                key={we.id}
                onDelete={() => removeExercise(we)}
                accessibilityLabel={`„${we.exercise.name}" aus der Einheit entfernen`}>
                <ListRow
                  title={we.exercise.name}
                  subtitle={p ? `${p.done}/${p.total} Sätze` : we.exercise.muscleGroup}
                  onPress={() => openExercise(we)}
                  onLongPress={() => confirmRemove(we)}
                  right={<Ionicons name="chevron-forward" size={18} color={c.textSecondary} />}
                />
              </SwipeToDelete>
            );
          })
        )}

        <Button
          label="Übung hinzufügen"
          icon="add"
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: '/session/add-exercise',
              params: { workoutId: String(workoutId) },
            })
          }
        />
      </ScrollView>

      <SafeAreaView
        edges={['bottom']}
        style={[styles.footer, { borderTopColor: c.border, backgroundColor: c.background }]}>
        <Button label="Einheit beenden" icon="checkmark-done" onPress={finish} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
  },
});
