import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import ReorderableList, {
  reorderItems,
  useReorderableDrag,
  type ReorderableListReorderEvent,
} from 'react-native-reorderable-list';
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
  reorderWorkoutExercises,
  type SetProgress,
  type WorkoutExerciseWithExercise,
} from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { showSaveError } from '@/lib/alerts';

/**
 * One exercise row. Rendered inside ReorderableList, so it can call
 * useReorderableDrag: long-press starts a drag-to-reorder, swipe deletes,
 * tap opens the set screen.
 */
function ExerciseRow({
  we,
  progress,
  onOpen,
  onRemove,
}: {
  we: WorkoutExerciseWithExercise;
  progress?: SetProgress;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const c = useTheme();
  const drag = useReorderableDrag();
  return (
    <View style={styles.rowWrap}>
      <SwipeToDelete
        onDelete={onRemove}
        accessibilityLabel={`„${we.exercise.name}" aus der Einheit entfernen`}>
        <ListRow
          title={we.exercise.name}
          subtitle={progress ? `${progress.done}/${progress.total} Sätze` : we.exercise.muscleGroup}
          onPress={onOpen}
          onLongPress={drag}
          right={<Ionicons name="reorder-three-outline" size={22} color={c.textSecondary} />}
        />
      </SwipeToDelete>
    </View>
  );
}

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
    setExercises((prev) => prev.filter((x) => x.id !== we.id)); // reflow immediately
    try {
      await removeWorkoutExercise(db, we.id);
    } catch (error) {
      showSaveError(error);
      load(); // re-sync on failure
    }
  };

  const onReorder = ({ from, to }: ReorderableListReorderEvent) => {
    const next = reorderItems(exercises, from, to);
    setExercises(next);
    reorderWorkoutExercises(
      db,
      next.map((we) => we.id),
    ).catch(showSaveError);
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
      <ReorderableList
        data={exercises}
        keyExtractor={(we) => String(we.id)}
        onReorder={onReorder}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <ExerciseRow
            we={item}
            progress={progress.get(item.id)}
            onOpen={() => openExercise(item)}
            onRemove={() => removeExercise(item)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="barbell-outline"
            title="Noch keine Übungen"
            message="Füge unten eine Übung hinzu."
          />
        }
        ListFooterComponent={
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
        }
      />

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
  },
  rowWrap: { marginBottom: Spacing.two },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
  },
});
