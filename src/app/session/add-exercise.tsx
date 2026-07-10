import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { addWorkoutExercise, getExercises } from '@/db';
import { MUSCLE_GROUPS, type Exercise } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { showSaveError } from '@/lib/alerts';

export default function AddExerciseScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useTheme();
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const [exercises, setExercises] = useState<Exercise[]>([]);

  useEffect(() => {
    getExercises(db).then(setExercises);
  }, [db]);

  const add = async (exerciseId: number) => {
    try {
      await addWorkoutExercise(db, Number(workoutId), exerciseId);
    } catch (error) {
      showSaveError(error);
      return;
    }
    router.back();
  };

  const sections = MUSCLE_GROUPS.map((group) => ({
    group,
    items: exercises.filter((e) => e.muscleGroup === group),
  })).filter((s) => s.items.length > 0);

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Stack.Screen options={{ headerShown: true, title: 'Übung hinzufügen' }} />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {sections.length === 0 ? (
          <EmptyState icon="barbell-outline" title="Keine Übungen verfügbar" />
        ) : (
          sections.map((section) => (
            <View key={section.group} style={styles.section}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.sectionTitle}>
                {section.group}
              </ThemedText>
              {section.items.map((exercise) => (
                <ListRow key={exercise.id} title={exercise.name} onPress={() => add(exercise.id)} />
              ))}
            </View>
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
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  section: { gap: Spacing.two },
  sectionTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: Spacing.two,
  },
});
