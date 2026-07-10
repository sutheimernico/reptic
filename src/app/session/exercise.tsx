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
  getExercise,
  getLastSetsForExercise,
  getSetsForWorkoutExercise,
  getWorkout,
  insertSet,
  updateSet,
  updateSetNumber,
} from '@/db';
import {
  formatCardioReference,
  formatDuration,
  formatReference,
  formatWeight,
  parseDuration,
  parseReps,
  parseWeight,
} from '@/domain/format';
import { createInitialSets, referenceLabel, type PriorSet } from '@/domain/sets';
import type { WorkoutSet } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { showSaveError } from '@/lib/alerts';

interface Row {
  id: number;
  weightText: string;
  repsText: string;
  distanceText: string;
  timeText: string;
  levelText: string;
  done: boolean;
}

type TextField = 'weightText' | 'repsText' | 'distanceText' | 'timeText' | 'levelText';

function toRows(sets: WorkoutSet[]): Row[] {
  return sets.map((s) => ({
    id: s.id,
    weightText: formatWeight(s.weightKg),
    repsText: s.reps === null ? '' : String(s.reps),
    distanceText: formatWeight(s.distanceKm),
    timeText: formatDuration(s.durationSec),
    levelText: s.level === null ? '' : String(s.level),
    done: s.done,
  }));
}

/** The value columns for a row, parsed from its text fields (empty → null). */
function fieldsOf(r: Row) {
  return {
    weightKg: parseWeight(r.weightText),
    reps: parseReps(r.repsText),
    distanceKm: parseWeight(r.distanceText),
    durationSec: parseDuration(r.timeText),
    level: parseReps(r.levelText),
    done: r.done,
  };
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
  keyboardType: 'decimal-pad' | 'number-pad' | 'default';
}) {
  const c = useTheme();
  return (
    <View style={[styles.inputBox, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
      <Text style={[styles.inputLabel, { color: c.textSecondary }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
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

  const [isCardio, setIsCardio] = useState(false);
  const [prior, setPrior] = useState<PriorSet[]>([]);
  const [priorGymName, setPriorGymName] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const rowsRef = useRef<Row[]>([]);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    let active = true;
    (async () => {
      const exercise = await getExercise(db, exerciseId);
      const workout = await getWorkout(db, workoutId);
      const { sets: priorSets, sourceGymName } = await getLastSetsForExercise(
        db,
        exerciseId,
        workout?.gymId ?? -1,
        workoutId,
      );
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
            distanceKm: draft.distanceKm,
            durationSec: draft.durationSec,
            level: draft.level,
            done: draft.done,
          });
        }
        current = await getSetsForWorkoutExercise(db, workoutExerciseId);
      }
      if (active) {
        setIsCardio(exercise?.muscleGroup === 'Cardio');
        setPrior(priorSets);
        setPriorGymName(sourceGymName);
        setRows(toRows(current));
      }
    })();
    return () => {
      active = false;
    };
  }, [db, exerciseId, workoutExerciseId, workoutId]);

  const setField = (id: number, field: TextField, value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const persist = (id: number) => {
    const r = rowsRef.current.find((x) => x.id === id);
    if (r) void updateSet(db, id, fieldsOf(r)).catch(showSaveError);
  };

  const flush = useCallback(async () => {
    try {
      await Promise.all(rowsRef.current.map((r) => updateSet(db, r.id, fieldsOf(r))));
    } catch (error) {
      showSaveError(error);
    }
  }, [db]);

  // Header back, swipe-back and Android hardware back all bypass finish().
  // Hold the pop until the flush committed — otherwise the session screen
  // refocuses (and could even finish the workout) while writes are in flight.
  const leavingRef = useRef<'idle' | 'flushing' | 'done'>('idle');
  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (leavingRef.current === 'done') return; // our re-dispatched action — let it pop
      e.preventDefault();
      if (leavingRef.current === 'flushing') return; // swallow repeat back presses
      leavingRef.current = 'flushing';
      void flush().finally(() => {
        leavingRef.current = 'done';
        navigation.dispatch(e.data.action);
      });
    });
  }, [navigation, flush]);

  const toggleDone = (row: Row) => {
    const next = !row.done;
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, done: next } : r)));
    void updateSet(db, row.id, { ...fieldsOf(row), done: next }).catch(showSaveError);
  };

  const addSet = async () => {
    try {
      await flush();
      const index = rowsRef.current.length;
      const prev = rowsRef.current[index - 1];
      const priorAt = prior[index];
      await insertSet(db, {
        workoutId,
        workoutExerciseId,
        exerciseId,
        setNumber: index + 1,
        // Carry over the "settings" from last time (or the previous set); the
        // performance fields (reps / time) stay empty.
        weightKg: priorAt?.weightKg ?? (prev ? parseWeight(prev.weightText) : null),
        distanceKm: priorAt?.distanceKm ?? (prev ? parseWeight(prev.distanceText) : null),
        level: priorAt?.level ?? (prev ? parseReps(prev.levelText) : null),
        reps: null,
        durationSec: null,
        done: false,
      });
      setRows(toRows(await getSetsForWorkoutExercise(db, workoutExerciseId)));
    } catch (error) {
      showSaveError(error);
    }
  };

  const removeSet = (row: Row, setNumber: number) => {
    Alert.alert('Satz löschen?', `Satz ${setNumber} entfernen.`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          try {
            await flush();
            await deleteSet(db, row.id);
            const remaining = await getSetsForWorkoutExercise(db, workoutExerciseId);
            await Promise.all(remaining.map((s, i) => updateSetNumber(db, s.id, i + 1)));
            setRows(toRows(await getSetsForWorkoutExercise(db, workoutExerciseId)));
          } catch (error) {
            showSaveError(error);
          }
        },
      },
    ]);
  };

  const finish = async () => {
    await flush();
    leavingRef.current = 'done'; // already flushed — don't hold the pop again
    router.back();
  };

  const referenceFor = (ref: PriorSet | undefined): string | null => {
    if (!ref) return null;
    return isCardio
      ? formatCardioReference(ref.distanceKm ?? null, ref.durationSec ?? null, ref.level ?? null)
      : formatReference(ref.weightKg, ref.reps);
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Stack.Screen options={{ headerShown: true, title: params.name ?? 'Übung' }} />
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {rows.map((row, i) => {
          const refLabel = referenceFor(prior[i]);
          return (
            <View key={row.id} style={styles.setBlock}>
              <View style={styles.setRow}>
                <Pressable
                  onLongPress={() => removeSet(row, i + 1)}
                  style={[styles.badge, { borderColor: c.border }]}>
                  <Text style={[styles.badgeText, { color: c.textSecondary }]}>{i + 1}</Text>
                </Pressable>
                {isCardio ? (
                  <>
                    <SetInput
                      label="KM"
                      value={row.distanceText}
                      onChangeText={(t) => setField(row.id, 'distanceText', t)}
                      onEndEditing={() => persist(row.id)}
                      keyboardType="decimal-pad"
                    />
                    <SetInput
                      label="ZEIT (min:s)"
                      value={row.timeText}
                      onChangeText={(t) => setField(row.id, 'timeText', t)}
                      onEndEditing={() => persist(row.id)}
                      keyboardType="default"
                    />
                    <SetInput
                      label="STUFE"
                      value={row.levelText}
                      onChangeText={(t) => setField(row.id, 'levelText', t)}
                      onEndEditing={() => persist(row.id)}
                      keyboardType="number-pad"
                    />
                  </>
                ) : (
                  <>
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
                  </>
                )}
                <Pressable
                  onPress={() => toggleDone(row)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: row.done }}
                  accessibilityLabel={`Satz ${i + 1} erledigt`}
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
                  {referenceLabel(priorGymName)}: {refLabel}
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
