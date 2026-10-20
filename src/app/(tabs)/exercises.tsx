import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';

import { FadeInListItem } from '@/components/motion/fade-in-list-item';
import { Sparkline } from '@/components/sparkline';
import { ThemedText } from '@/components/themed-text';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { ListRow } from '@/components/ui/list-row';
import { Screen, SCREEN_BODY_PADDING } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { getExercises, getRecentTopWeights } from '@/db';
import { formatKg, plural } from '@/domain/format';
import { showSaveError } from '@/lib/alerts';
import { MUSCLE_GROUPS, type Exercise } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

// Enough sessions to see a direction at a glance; the full history lives on the progress screen.
const TREND_SESSIONS = 8;

export default function ExercisesScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useTheme();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [trends, setTrends] = useState<Map<number, number[]>>(new Map());

  const load = useCallback(() => {
    // Archived exercises stay reachable here (own section at the bottom) so
    // they can be reactivated — mirrors the gym list in Einstellungen.
    Promise.all([getExercises(db, { includeArchived: true }), getRecentTopWeights(db, TREND_SESSIONS)])
      .then(([list, top]) => {
        setExercises(list);
        setTrends(top);
      })
      .catch(showSaveError);
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
        renderItem={({ item: exercise, section, index }) => {
          const trend = trends.get(exercise.id);
          const top = trend?.[trend.length - 1];
          return (
          <FadeInListItem index={index} style={styles.row}>
          <ListRow
            title={exercise.name}
            // Every exercise is the user's own (the starter set is seeded as
            // custom), so "Eigene Übung" on each row said nothing.
            subtitle={section.title === 'Archiviert' ? exercise.muscleGroup : undefined}
            onPress={() =>
              router.push({ pathname: '/exercise/edit', params: { id: String(exercise.id) } })
            }
            accessibilityLabel={
              top !== undefined ? `${exercise.name}, zuletzt ${formatKg(top)}` : undefined
            }
            right={
              <View style={styles.right}>
                {trend ? <Sparkline values={trend} /> : null}
                {top !== undefined ? (
                  <ThemedText type="smallBold" variant="numeric">
                    {formatKg(top)}
                  </ThemedText>
                ) : null}
                <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
              </View>
            }
          />
          </FadeInListItem>
          );
        }}
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
  right: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  sectionTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
});
