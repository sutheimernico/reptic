import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { getActiveWorkout, getPlansWithExercises, startWorkout } from '@/db';
import type { PlanWithExercises, Workout } from '@/domain/types';

function todayLabel(): string {
  return new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export default function HeuteScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [active, setActive] = useState<Workout | null>(null);
  const [plans, setPlans] = useState<PlanWithExercises[]>([]);
  const [selected, setSelected] = useState<number[]>([]);

  const load = useCallback(() => {
    getActiveWorkout(db).then(setActive);
    getPlansWithExercises(db).then(setPlans);
  }, [db]);

  useFocusEffect(useCallback(() => load(), [load]));

  const toggle = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const start = async (planIds: number[]) => {
    const id = await startWorkout(db, planIds, new Date().toISOString());
    setSelected([]);
    router.push({ pathname: '/session/[id]', params: { id: String(id) } });
  };

  return (
    <Screen title="Heute" subtitle={todayLabel()}>
      {active ? (
        <Card>
          <ThemedText type="smallBold" themeColor="textSecondary">
            EINHEIT LÄUFT
          </ThemedText>
          <ThemedText style={styles.resumeTitle}>Du hast eine offene Einheit</ThemedText>
          <Button
            label="Weiter zur Einheit"
            icon="arrow-forward"
            style={styles.resumeButton}
            onPress={() => router.push({ pathname: '/session/[id]', params: { id: String(active.id) } })}
          />
        </Card>
      ) : plans.length === 0 ? (
        <EmptyState
          icon="clipboard-outline"
          title="Noch keine Pläne"
          message={'Lege im Tab „Pläne" ein Trainingsbild an — oder starte eine leere Einheit.'}
        />
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            Was machst du heute? (mehrere möglich)
          </ThemedText>
          {plans.map((plan) => (
            <ListRow
              key={plan.id}
              title={plan.name}
              subtitle={`${plan.exerciseIds.length} Übungen`}
              selected={selected.includes(plan.id)}
              left={<View style={[styles.dot, { backgroundColor: plan.color }]} />}
              onPress={() => toggle(plan.id)}
            />
          ))}
        </>
      )}

      {!active ? (
        <View style={styles.actions}>
          <Button
            label="Los geht's"
            icon="barbell"
            disabled={selected.length === 0}
            onPress={() => start(selected)}
          />
          <Button label="Leere Einheit starten" variant="secondary" onPress={() => start([])} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  resumeTitle: { fontSize: 18, fontWeight: '700', marginTop: 2 },
  resumeButton: { marginTop: Spacing.three },
  hint: { marginBottom: Spacing.one },
  dot: { width: 12, height: 12, borderRadius: 6 },
  actions: { gap: Spacing.two, marginTop: Spacing.three },
});
