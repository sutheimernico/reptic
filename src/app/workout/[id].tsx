import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { ListRow } from '@/components/ui/list-row';
import { BottomTabInset, Spacing } from '@/constants/theme';
import {
  deleteWorkout,
  getGym,
  getSetsForWorkoutExercise,
  getWorkout,
  getWorkoutExercises,
  type WorkoutExerciseWithExercise,
} from '@/db';
import { formatCardioSetSummary, formatSessionDate, formatSetSummary } from '@/domain/format';
import type { Workout } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

interface ExerciseWithSummary extends WorkoutExerciseWithExercise {
  summary: string;
}

export default function WorkoutDetailScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const workoutId = Number(id);

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [gymName, setGymName] = useState<string | null>(null);
  const [exercises, setExercises] = useState<ExerciseWithSummary[]>([]);

  const load = useCallback(() => {
    getWorkout(db, workoutId).then((w) => {
      setWorkout(w);
      if (w) getGym(db, w.gymId).then((g) => setGymName(g?.name ?? null));
    });
    getWorkoutExercises(db, workoutId).then(async (list) => {
      const withSummary = await Promise.all(
        list.map(async (we) => {
          const sets = await getSetsForWorkoutExercise(db, we.id);
          return {
            ...we,
            summary:
              we.exercise.muscleGroup === 'Cardio'
                ? formatCardioSetSummary(sets)
                : formatSetSummary(sets),
          };
        }),
      );
      setExercises(withSummary);
    });
  }, [db, workoutId]);

  useFocusEffect(useCallback(() => load(), [load]));

  const confirmDelete = () => {
    Alert.alert('Einheit löschen?', 'Die Einheit und alle eingetragenen Sätze werden gelöscht.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          await deleteWorkout(db, workoutId);
          router.back();
        },
      },
    ]);
  };

  const dateLabel = workout ? formatSessionDate(workout.finishedAt ?? workout.startedAt) : 'Einheit';

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: gymName ? `${dateLabel} · ${gymName}` : dateLabel,
          headerRight: () => (
            <IconButton
              name="trash-outline"
              accessibilityLabel="Einheit löschen"
              color={c.danger}
              size={22}
              onPress={confirmDelete}
            />
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {exercises.length === 0 ? (
          <EmptyState
            icon="barbell-outline"
            title="Keine Übungen"
            message="In dieser Einheit wurde nichts eingetragen."
          />
        ) : (
          exercises.map((we) => (
            <ListRow
              key={we.id}
              title={we.exercise.name}
              subtitle={we.summary || 'Keine Sätze eingetragen'}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: {
    padding: Spacing.four,
    gap: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.four,
  },
});
