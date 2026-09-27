import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlateSheet } from '@/components/plate-sheet';
import { RestTimerBanner, useRestTimer } from '@/components/rest-timer';
import { SessionClock } from '@/components/session-clock';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Radius, Spacing } from '@/constants/theme';
import {
  deleteSet,
  getExercise,
  getExerciseBests,
  getLastSetsForExercise,
  getSetting,
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
import {
  describeRecords,
  detectPersonalRecords,
  type ExerciseBests,
  NO_BESTS,
  type PrKind,
  withSet,
} from '@/domain/personal-records';
import { parsePlateSetup, PLATE_SETUP_SETTING } from '@/domain/plates';
import {
  describeHint,
  INCREMENT_SETTING,
  parseIncrement,
  parseRepTarget,
  type ProgressionHint,
  REP_TARGET_SETTING,
  rowsToBump,
  suggestProgression,
} from '@/domain/progression';
import { createInitialSets, referenceLabel, type PriorSet } from '@/domain/sets';
import type { WorkoutSet } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { showSaveError } from '@/lib/alerts';
import { haptic } from '@/lib/haptics';

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
  onLabelPress,
  labelAccessibilityLabel,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onEndEditing: () => void;
  keyboardType: 'decimal-pad' | 'number-pad' | 'default';
  /** Makes the small caption tappable — used by the kg field for the plate sheet. */
  onLabelPress?: () => void;
  labelAccessibilityLabel?: string;
}) {
  const c = useTheme();
  return (
    <View style={[styles.inputBox, { backgroundColor: c.backgroundElement, borderColor: c.border }]}>
      {onLabelPress ? (
        <Pressable
          onPress={onLabelPress}
          accessibilityRole="button"
          accessibilityLabel={labelAccessibilityLabel}
          hitSlop={6}
          style={styles.labelRow}>
          <Text style={[styles.inputLabel, { color: c.accent }]}>{label}</Text>
          <Ionicons name="disc-outline" size={11} color={c.accent} />
        </Pressable>
      ) : (
        <Text style={[styles.inputLabel, { color: c.textSecondary }]}>{label}</Text>
      )}
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
  const restTimer = useRestTimer();
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
  /** What a set has to beat. Advanced in-memory as sets are ticked done, so
   *  the second set of a session compares against the first. */
  const bestsRef = useRef<ExerciseBests>(NO_BESTS);
  const [records, setRecords] = useState<Map<number, PrKind[]>>(new Map());
  /** One toast per visit to this exercise — badges stay, the shout does not. */
  const toastedRef = useRef(false);
  /** Target of the plate sheet; null while it is closed. */
  const [plateTarget, setPlateTarget] = useState<number | null>(null);
  const [plateOpen, setPlateOpen] = useState(false);
  /** Double-progression advice from last time; null when there is nothing honest to say. */
  const [hint, setHint] = useState<ProgressionHint | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);

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
      const bests = await getExerciseBests(db, exerciseId, workoutId);
      const cardio = exercise?.muscleGroup === 'Cardio';
      // Sets from another gym were lifted on other machines — advice built on
      // them would be confidently wrong, so the hint stays quiet there.
      const nextHint =
        cardio || sourceGymName !== null
          ? null
          : suggestProgression(
              priorSets,
              {
                repTarget: parseRepTarget(await getSetting(db, REP_TARGET_SETTING)),
                incrementKg: parseIncrement(await getSetting(db, INCREMENT_SETTING)),
              },
              parsePlateSetup(await getSetting(db, PLATE_SETUP_SETTING)),
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
        bestsRef.current = bests;
        setIsCardio(cardio);
        setHint(nextHint);
        setStartedAt(workout?.startedAt ?? null);
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
    if (!next) return; // un-ticking is a correction: no rest, no record
    haptic('set-done');
    restTimer.start();

    const performed = fieldsOf(row);
    const kinds = detectPersonalRecords(performed, bestsRef.current);
    bestsRef.current = withSet(bestsRef.current, performed);
    if (kinds.length === 0) return;

    setRecords((prev) => new Map(prev).set(row.id, kinds));
    haptic('record');
    if (!toastedRef.current && Platform.OS === 'android') {
      toastedRef.current = true;
      ToastAndroid.show(`Neuer Rekord: ${describeRecords(kinds)}`, ToastAndroid.LONG);
    }
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

  /** Rows the "Übernehmen" tap would move — open sets still at last time's working weight. */
  const bumpable = (list: Row[]): number[] =>
    hint?.kind === 'increase'
      ? rowsToBump(
          list.map((r) => ({ weightKg: parseWeight(r.weightText), done: r.done })),
          hint.fromKg,
        )
      : [];

  // Explicit only: the hint never edits a field on its own.
  const applyHint = () => {
    if (hint?.kind !== 'increase') return;
    const current = rowsRef.current;
    const indices = bumpable(current);
    if (indices.length === 0) return;
    const weightText = formatWeight(hint.toKg);
    const next = current.map((r, i) => (indices.includes(i) ? { ...r, weightText } : r));
    rowsRef.current = next;
    setRows(next);
    void Promise.all(indices.map((i) => updateSet(db, next[i].id, fieldsOf(next[i])))).catch(
      showSaveError,
    );
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
      <Stack.Screen
        options={{
          headerShown: true,
          title: params.name ?? 'Übung',
          headerRight: () => <SessionClock startedAt={startedAt} />,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {hint ? (
          <View
            style={[
              styles.progression,
              { backgroundColor: c.backgroundElement, borderColor: c.border },
            ]}>
            <Ionicons
              name={hint.kind === 'increase' ? 'trending-up' : 'repeat'}
              size={18}
              color={c.accent}
            />
            <View style={styles.progressionTexts}>
              <Text style={[styles.progressionTitle, { color: c.text }]}>
                {describeHint(hint).title}
              </Text>
              <ThemedText type="small" themeColor="textSecondary">
                {describeHint(hint).detail}
              </ThemedText>
            </View>
            {hint.kind === 'increase' && bumpable(rows).length > 0 ? (
              <Pressable
                onPress={applyHint}
                accessibilityRole="button"
                accessibilityLabel={`Vorschlag übernehmen: ${formatWeight(hint.toKg)} kg`}
                hitSlop={8}>
                <Text style={[styles.progressionAction, { color: c.accent }]}>Übernehmen</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

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
                      onLabelPress={() => {
                        setPlateTarget(parseWeight(row.weightText));
                        setPlateOpen(true);
                      }}
                      labelAccessibilityLabel={`Hantelscheiben für Satz ${i + 1} berechnen`}
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
              <View style={styles.subLine}>
                {refLabel ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.refLine}>
                    {referenceLabel(priorGymName)}: {refLabel}
                  </ThemedText>
                ) : (
                  <View style={styles.refSpacer} />
                )}
                {records.get(row.id) ? (
                  <Pressable
                    onPress={() =>
                      Alert.alert(
                        'Persönlicher Rekord',
                        `Satz ${i + 1}: ${describeRecords(records.get(row.id) ?? [])}.`,
                      )
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Rekord in Satz ${i + 1}: ${describeRecords(records.get(row.id) ?? [])}`}
                    hitSlop={6}
                    style={[styles.prBadge, { backgroundColor: c.success }]}>
                    <Ionicons name="trophy" size={11} color={c.onAccent} />
                    <Text style={[styles.prText, { color: c.onAccent }]}>PR</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}

        <Button label="Satz" icon="add" variant="secondary" onPress={addSet} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          {isCardio
            ? 'Tipp: Satz-Nummer lange drücken zum Löschen.'
            : 'Tipp: Satz-Nummer lange drücken zum Löschen · „KG" antippen zeigt die Scheiben.'}
        </ThemedText>
      </ScrollView>

      <PlateSheet
        targetKg={plateTarget}
        visible={plateOpen}
        onClose={() => setPlateOpen(false)}
      />

      <SafeAreaView
        edges={['bottom']}
        style={[styles.footer, { borderTopColor: c.border, backgroundColor: c.background }]}>
        <RestTimerBanner />
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
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  input: { fontSize: 17, fontWeight: '700', padding: 0, margin: 0 },
  check: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  refLine: { flex: 1, marginLeft: 38 },
  refSpacer: { flex: 1 },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  prText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  hint: { marginTop: Spacing.one, textAlign: 'center' },
  progression: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.md,
    marginBottom: Spacing.one,
  },
  progressionTexts: { flex: 1 },
  progressionTitle: { fontSize: 15, fontWeight: '700' },
  progressionAction: { fontSize: 14, fontWeight: '700' },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
  },
});
