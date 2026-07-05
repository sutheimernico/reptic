import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { getExercises } from '@/db';
import { MUSCLE_GROUPS, type Exercise } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

export default function ExercisesScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useTheme();
  const [exercises, setExercises] = useState<Exercise[]>([]);

  const load = useCallback(() => {
    getExercises(db).then(setExercises);
  }, [db]);

  useFocusEffect(useCallback(() => load(), [load]));

  const sections = MUSCLE_GROUPS.map((group) => ({
    group,
    items: exercises.filter((e) => e.muscleGroup === group),
  })).filter((s) => s.items.length > 0);

  return (
    <Screen
      title="Übungen"
      subtitle={`${exercises.length} Übungen`}
      headerRight={
        <IconButton
          name="add"
          accessibilityLabel="Übung hinzufügen"
          color={c.accent}
          size={28}
          onPress={() => router.push('/exercise/edit')}
        />
      }>
      {sections.length === 0 ? (
        <EmptyState icon="barbell-outline" title="Noch keine Übungen" message="Tippe auf + oben rechts." />
      ) : (
        sections.map((section) => (
          <View key={section.group} style={styles.section}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.sectionTitle}>
              {section.group}
            </ThemedText>
            {section.items.map((exercise) => (
              <ListRow
                key={exercise.id}
                title={exercise.name}
                subtitle={exercise.isCustom ? 'Eigene Übung' : undefined}
                onPress={() =>
                  router.push({ pathname: '/exercise/edit', params: { id: String(exercise.id) } })
                }
                right={<Ionicons name="chevron-forward" size={18} color={c.textSecondary} />}
              />
            ))}
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  sectionTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: Spacing.two,
  },
});
