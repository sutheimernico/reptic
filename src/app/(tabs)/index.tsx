import Ionicons from '@expo/vector-icons/Ionicons';
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
import {
  getActiveWorkout,
  getGym,
  getPlansWithExercises,
  getSetting,
  LAST_GYM_SETTING,
  startWorkout,
} from '@/db';
import type { Gym, PlanWithExercises, Workout } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

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
  const c = useTheme();
  const [active, setActive] = useState<Workout | null>(null);
  const [plans, setPlans] = useState<PlanWithExercises[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [gym, setGym] = useState<Gym | null>(null);

  const load = useCallback(() => {
    getActiveWorkout(db).then(setActive);
    getPlansWithExercises(db).then(setPlans);
    // The "selected" gym IS the persisted last-used one; archived/deleted → none.
    getSetting(db, LAST_GYM_SETTING)
      .then((value) => (value ? getGym(db, Number(value)) : null))
      .then((g) => setGym(g && !g.archived ? g : null));
  }, [db]);

  useFocusEffect(useCallback(() => load(), [load]));

  const toggle = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const start = async (planIds: number[]) => {
    if (!gym) return;
    const id = await startWorkout(db, planIds, gym.id, new Date().toISOString());
    setSelected([]);
    router.push({ pathname: '/session/[id]', params: { id: String(id) } });
  };

  return (
    <Screen title="Heute" subtitle={todayLabel()}>
      {!active ? (
        <ListRow
          title={gym ? gym.name : 'Gym wählen'}
          subtitle="Wo trainierst du heute?"
          left={<Ionicons name="location-outline" size={20} color={gym ? c.accent : c.textSecondary} />}
          onPress={() => router.push('/gym/select')}
          accessibilityLabel={
            gym ? `Gym: ${gym.name}. Antippen zum Wechseln` : 'Gym wählen'
          }
        />
      ) : null}

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
          message={'Lege im Tab „Pläne" einen Trainingsplan an — oder starte eine leere Einheit.'}
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
            disabled={selected.length === 0 || !gym}
            onPress={() => start(selected)}
          />
          <Button
            label="Leere Einheit starten"
            variant="secondary"
            disabled={!gym}
            onPress={() => start([])}
          />
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
