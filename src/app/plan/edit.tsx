import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { TextField } from '@/components/ui/text-field';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import {
  createPlan,
  deletePlan,
  getExercises,
  getPlan,
  getPlanExerciseIds,
  setPlanExercises,
  updatePlan,
} from '@/db';
import { MUSCLE_GROUPS, type Exercise } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { showSaveError } from '@/lib/alerts';

const PLAN_COLORS = ['#6366F1', '#8B5CF6', '#14B8A6', '#F59E0B', '#F43F5E', '#0EA5E9'];

export default function PlanEditScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingId = id ? Number(id) : null;
  const isEditing = editingId !== null;

  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(PLAN_COLORS[0]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    getExercises(db).then(setExercises);
  }, [db]);

  useEffect(() => {
    if (editingId === null) return;
    let active = true;
    (async () => {
      const plan = await getPlan(db, editingId);
      const exerciseIds = await getPlanExerciseIds(db, editingId);
      if (active && plan) {
        setName(plan.name);
        setColor(plan.color);
        setSelectedIds(exerciseIds);
      }
    })();
    return () => {
      active = false;
    };
  }, [db, editingId]);

  const toggleExercise = (exerciseId: number) => {
    setSelectedIds((prev) =>
      prev.includes(exerciseId) ? prev.filter((existing) => existing !== exerciseId) : [...prev, exerciseId],
    );
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      let planId: number;
      if (isEditing) {
        await updatePlan(db, editingId, trimmed, color);
        planId = editingId;
      } else {
        planId = await createPlan(db, trimmed, color);
      }
      await setPlanExercises(db, planId, selectedIds);
    } catch (error) {
      showSaveError(error);
      return;
    }
    router.back();
  };

  const confirmDelete = () => {
    if (editingId === null) return;
    Alert.alert('Plan löschen?', 'Dieser Plan wird endgültig gelöscht.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePlan(db, editingId);
          } catch (error) {
            showSaveError(error);
            return;
          }
          router.back();
        },
      },
    ]);
  };

  const sections = MUSCLE_GROUPS.map((group) => ({
    group,
    items: exercises.filter((e) => e.muscleGroup === group),
  })).filter((s) => s.items.length > 0);

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Stack.Screen
        options={{ headerShown: true, title: isEditing ? 'Plan bearbeiten' : 'Neuer Plan' }}
      />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="z. B. Push"
          autoFocus={!isEditing}
          returnKeyType="done"
          onSubmitEditing={save}
        />

        <View style={styles.colorBlock}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.blockLabel}>
            Farbe
          </ThemedText>
          <View style={styles.swatches}>
            {PLAN_COLORS.map((swatch) => {
              const active = swatch === color;
              return (
                <Pressable
                  key={swatch}
                  onPress={() => setColor(swatch)}
                  style={[styles.swatchRing, { borderColor: active ? c.accent : 'transparent' }]}>
                  <View style={[styles.swatch, { backgroundColor: swatch }]} />
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.exercisesBlock}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.blockLabel}>
            {`Übungen (${selectedIds.length})`}
          </ThemedText>
          {sections.map((section) => (
            <View key={section.group} style={styles.section}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.sectionTitle}>
                {section.group}
              </ThemedText>
              {section.items.map((exercise) => {
                const selected = selectedIds.includes(exercise.id);
                return (
                  <ListRow
                    key={exercise.id}
                    title={exercise.name}
                    selected={selected}
                    onPress={() => toggleExercise(exercise.id)}
                    right={
                      selected ? (
                        <Ionicons name="checkmark-circle" size={20} color={c.accent} />
                      ) : undefined
                    }
                  />
                );
              })}
            </View>
          ))}
        </View>

        <Button label="Speichern" icon="checkmark" onPress={save} disabled={!name.trim()} />

        {isEditing ? (
          <Button label="Löschen" icon="trash-outline" variant="danger" onPress={confirmDelete} />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: {
    padding: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
  },
  colorBlock: { gap: Spacing.two },
  exercisesBlock: { gap: Spacing.three },
  blockLabel: { marginLeft: Spacing.half },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  swatchRing: {
    width: 44,
    height: 44,
    borderRadius: Radius.xl,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: { width: 32, height: 32, borderRadius: Radius.lg },
  section: { gap: Spacing.two },
  sectionTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: Spacing.two,
  },
});
