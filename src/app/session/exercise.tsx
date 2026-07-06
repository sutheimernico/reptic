import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Radius, Spacing } from '@/constants/theme';
import {
  deleteSet,
  getLastSetsForExercise,
  getSetsForWorkoutExercise,
  insertSet,
  updateSet,
} from '@/db';
import { formatReference, formatWeight, parseReps, parseWeight } from '@/domain/format';
import { createInitialSets, type PriorSet } from '@/domain/sets';
import type { WorkoutSet } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

interface Row {
  id: number;
  weightText: string;
  repsText: string;
  done: boolean;
}

function showSaveError() {
  Alert.alert('Speichern fehlgeschlagen', 'Die Änderung konnte nicht gespeichert werden.');
}

function toRows(sets: WorkoutSet[]): Row[] {
  return sets.map((s) => ({
    id: s.id,
    weightText: formatWeight(s.weightKg),
    repsText: s.reps === null ? '' : String(s.reps),
    done: s.done,
  }));
}

function SetInput({
  label,
  value,
  onChangeText,
  onEndEditing,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onEndEditing: () => void;
  keyboardType: 'decimal-pad' | 'number-pad';
}) {
  const c = useTheme();
  return (
    <View style={[styles.inputBox, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
      <Text style={[styles.inputLabel, { color: c.textSecondary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onEndEditing={onEndEditing}
        keyboardType={keyboardType}
        placeholder="—"
        placeholderTextColor={c.placeholder}
        selectTextOnFocus
        returnKeyType="done"
        style={[styles.input, { color: c.text }]}
      />
    </View>
  );
}

export default function ExerciseSetScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const navigation = useNavigation();
  const c = useTheme();
  const params = useLocalSearchParams<{
    workoutId: string;
    workoutExerciseId: string;
    exerciseId: string;
    name: string;
  }>();
  const workoutId = Number(params.workoutId);
  const workoutExerciseId = Number(params.workoutExerciseId);
  const exerciseId = Number(params.exerciseId);

  const [prior, setPrior] = useState<PriorSet[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const rowsRef = useRef<Row[]>([]);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    let active = true;
    (async () => {
      const priorSets = await getLastSetsForExercise(db, exerciseId, workoutId);
      let current = await getSetsForWorkoutExercise(db, workoutExerciseId);
      if (current.length === 0) {
        for (const draft of createInitialSets(priorSets)) {
          await insertSet(db, {
            workoutId,
            workoutExerciseId,
            exerciseId,
            setNumber: draft.setNumber,
            weightKg: draft.weightKg,
            reps: draft.reps,
            done: draft.done,
          });
        }
        current = await getSetsForWorkoutExercise(db, workoutExerciseId);
      }
      if (active) {
        setPrior(priorSets);
        setRows(toRows(current));
      }
    })();
    return () => {
      active = false;
    };
  }, [db, exerciseId, workoutExerciseId, workoutId]);

  const setField = (id: number, field: 'weightText' | 'repsText', value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const persist = (id: number) => {
    const r = rowsRef.current.find((x) => x.id === id);
    if (r) {
      void updateSet(db, id, {
        weightKg: parseWeight(r.weightText),
        reps: parseReps(r.repsText),
        done: r.done,
      }).catch(showSaveError);
    }
  };

  const flush = useCallback(async () => {
    try {
      await Promise.all(
        rowsRef.current.map((r) =>
          updateSet(db, r.id, {
            weightKg: parseWeight(r.weightText),
            reps: parseReps(r.repsText),
            done: r.done,
          }),
        ),
      );
    } catch {
      showSaveError();
    }
  }, [db]);

  // Header back, swipe-back and Android hardware back all bypass finish();
  // flush pending edits on any removal so typed values are never lost.
  useEffect(() => {
    return navigation.addListener('beforeRemove', () => {
      void flush();
    });
  }, [navigation, flush]);

  const toggleDone = (row: Row) => {
    const next = !row.done;
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, done: next } : r)));
    void updateSet(db, row.id, {
      weightKg: parseWeight(row.weightText),
      reps: parseReps(row.repsText),
      done: next,
    }).catch(showSaveError);
  };

  const addSet = async () => {
    await flush();
    const index = rowsRef.current.length;
    const lastRow = rowsRef.current[index - 1];
    const inheritedWeight = prior[index]?.weightKg ?? (lastRow ? parseWeight(lastRow.weightText) : null);
    await insertSet(db, {
      workoutId,
      workoutExerciseId,
      exerciseId,
      setNumber: index + 1,
      weightKg: inheritedWeight,
      reps: null,
      done: false,
    });
    setRows(toRows(await getSetsForWorkoutExercise(db, workoutExerciseId)));
  };

  const removeSet = (row: Row, setNumber: number) => {
    Alert.alert('Satz löschen?', `Satz ${setNumber} entfernen.`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          await flush();
          await deleteSet(db, row.id);
          const remaining = await getSetsForWorkoutExercise(db, workoutExerciseId);
          await Promise.all(
            remaining.map((s, i) =>
              updateSet(db, s.id, {
                weightKg: s.weightKg,
                reps: s.reps,
                done: s.done,
                setNumber: i + 1,
              }),
            ),
          );
          setRows(toRows(await getSetsForWorkoutExercise(db, workoutExerciseId)));
        },
      },
    ]);
  };

  const finish = async () => {
    await flush();
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Stack.Screen options={{ headerShown: true, title: params.name ?? 'Übung' }} />
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {rows.map((row, i) => {
          const ref = prior[i];
          const refLabel = ref ? formatReference(ref.weightKg, ref.reps) : null;
          return (
            <View key={row.id} style={styles.setBlock}>
              <View style={styles.setRow}>
                <Pressable
                  onLongPress={() => removeSet(row, i + 1)}
                  style={[styles.badge, { borderColor: c.border }]}>
                  <Text style={[styles.badgeText, { color: c.textSecondary }]}>{i + 1}</Text>
                </Pressable>
                <SetInput
                  label="KG"
                  value={row.weightText}
                  onChangeText={(t) => setField(row.id, 'weightText', t)}
                  onEndEditing={() => persist(row.id)}
                  keyboardType="decimal-pad"
                />
                <SetInput
                  label="WDH"
                  value={row.repsText}
                  onChangeText={(t) => setField(row.id, 'repsText', t)}
                  onEndEditing={() => persist(row.id)}
                  keyboardType="number-pad"
                />
                <Pressable
                  onPress={() => toggleDone(row)}
                  accessibilityLabel="Satz erledigt"
                  style={[
                    styles.check,
                    {
                      backgroundColor: row.done ? c.accent : 'transparent',
                      borderColor: row.done ? c.accent : c.border,
                    },
                  ]}>
                  <Ionicons name="checkmark" size={18} color={row.done ? c.onAccent : c.placeholder} />
                </Pressable>
              </View>
              {refLabel ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.refLine}>
                  ↳ letztes Mal: {refLabel}
                </ThemedText>
              ) : null}
            </View>
          );
        })}

        <Button label="Satz" icon="add" variant="secondary" onPress={addSet} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          Tipp: Satz-Nummer lange drücken zum Löschen.
        </ThemedText>
      </ScrollView>

      <SafeAreaView
        edges={['bottom']}
        style={[styles.footer, { borderTopColor: c.border, backgroundColor: c.background }]}>
        <Button label="Übung fertig" icon="checkmark-done" onPress={finish} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: Spacing.four, gap: Spacing.two },
  setBlock: { gap: 2 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  badge: {
    width: 30,
    height: 44,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 13, fontWeight: '700' },
  inputBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
  },
  inputLabel: { fontSize: 9, fontWeight: '600', letterSpacing: 0.6 },
  input: { fontSize: 17, fontWeight: '700', padding: 0, margin: 0 },
  check: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refLine: { marginLeft: 38 },
  hint: { marginTop: Spacing.one, textAlign: 'center' },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
  },
});
