import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { ListRow } from '@/components/ui/list-row';
import { Screen, SCREEN_BODY_PADDING } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { getExercises } from '@/db';
import { plural } from '@/domain/format';
import { MUSCLE_GROUPS, type Exercise } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

export default function ExercisesScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useTheme();
  const [exercises, setExercises] = useState<Exercise[]>([]);

  const load = useCallback(() => {
    // Archived exercises stay reachable here (own section at the bottom) so
    // they can be reactivated — mirrors the gym list in Einstellungen.
    getExercises(db, { includeArchived: true }).then(setExercises);
  }, [db]);

  useFocusEffect(useCallback(() => load(), [load]));

  const active = exercises.filter((e) => !e.archived);
  const archived = exercises.filter((e) => e.archived);
  const sections = [
    ...MUSCLE_GROUPS.map((group) => ({
      title: group,
      data: active.filter((e) => e.muscleGroup === group),
    })),
    // Archived ones keep their own section at the very bottom: reachable for
    // reactivation, out of the way of picking an exercise.
    { title: 'Archiviert', data: archived },
  ].filter((section) => section.data.length > 0);

  return (
    <Screen
      title="Übungen"
      subtitle={plural(active.length, 'Übung', 'Übungen')}
      headerRight={
        <IconButton
          name="add"
          accessibilityLabel="Übung hinzufügen"
          color={c.accent}
          size={28}
          onPress={() => router.push('/exercise/edit')}
        />
      }
      scroll={false}
      padded={false}>
      <SectionList
        sections={sections}
        keyExtractor={(exercise) => String(exercise.id)}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled
        showsVerticalScrollIndicator={false}
        renderSectionHeader={({ section }) => (
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={[styles.sectionTitle, { backgroundColor: c.background }]}>
            {section.title}
          </ThemedText>
        )}
        renderItem={({ item: exercise, section }) => (
          <View style={styles.row}>
          <ListRow
            title={exercise.name}
            subtitle={
              section.title === 'Archiviert'
                ? exercise.muscleGroup
                : exercise.isCustom
                  ? 'Eigene Übung'
                  : undefined
            }
            onPress={() =>
              router.push({ pathname: '/exercise/edit', params: { id: String(exercise.id) } })
            }
            right={<Ionicons name="chevron-forward" size={18} color={c.textSecondary} />}
          />
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="barbell-outline"
            title="Noch keine Übungen"
            message="Tippe auf + oben rechts."
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  // SectionList has no flex gap between rows, so the spacing that used to come
  // from the body's `gap` is carried by the rows and headers themselves.
  list: { ...SCREEN_BODY_PADDING, gap: 0 },
  row: { marginBottom: Spacing.two },
  sectionTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
});
