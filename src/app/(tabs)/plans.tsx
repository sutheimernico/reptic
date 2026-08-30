import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { ListRow } from '@/components/ui/list-row';
import { Screen, SCREEN_BODY_PADDING } from '@/components/ui/screen';
import { getPlansWithExercises } from '@/db';
import { plural } from '@/domain/format';
import { type PlanWithExercises } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

export default function PlansScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useTheme();
  const [plans, setPlans] = useState<PlanWithExercises[]>([]);

  const load = useCallback(() => {
    getPlansWithExercises(db).then(setPlans);
  }, [db]);

  useFocusEffect(useCallback(() => load(), [load]));

  return (
    <Screen
      title="Pläne"
      subtitle="Deine Trainingspläne"
      headerRight={
        <IconButton
          name="add"
          accessibilityLabel="Plan hinzufügen"
          color={c.accent}
          size={28}
          onPress={() => router.push('/plan/edit')}
        />
      }
      scroll={false}
      padded={false}>
      <FlatList
        data={plans}
        keyExtractor={(plan) => String(plan.id)}
        contentContainerStyle={SCREEN_BODY_PADDING}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: plan }) => (
          <ListRow
            title={plan.name}
            subtitle={plural(plan.exerciseIds.length, 'Übung', 'Übungen')}
            left={<View style={[styles.dot, { backgroundColor: plan.color }]} />}
            right={<Ionicons name="chevron-forward" size={18} color={c.textSecondary} />}
            onPress={() => router.push({ pathname: '/plan/edit', params: { id: String(plan.id) } })}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="clipboard-outline"
            title="Noch keine Pläne"
            message="Tippe auf + oben rechts."
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  dot: { width: 12, height: 12, borderRadius: 6 },
});
