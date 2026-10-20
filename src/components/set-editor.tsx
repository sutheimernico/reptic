import Ionicons from '@expo/vector-icons/Ionicons';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Celebration } from '@/components/celebration';
import { CheckPop } from '@/components/motion/check-pop';
import { PlateSheet } from '@/components/plate-sheet';
import { useRestTimer } from '@/components/rest-timer';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
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
import { breakAppliedKey, lowerWeight } from '@/domain/break';
import { type PlateSetup, parsePlateSetup, PLATE_SETUP_SETTING } from '@/domain/plates';
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
import { createInitialSets, isPerformed, referenceLabel, type PriorSet } from '@/domain/sets';
import type { WorkoutSet } from '@/domain/types';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useTheme } from '@/hooks/use-theme';
import { showSaveError } from '@/lib/alerts';
import { haptic } from '@/lib/haptics';
import { timingFor } from '@/theme/motion';

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

/**
 * Tint behind a set row that crossfades in when the set is ticked. Opacity only and
 * absolutely positioned, so it never moves the inputs or fights the keyboard.
 */
function RowSettle({ done }: { done: boolean }) {
  const theme = useAppTheme();
  const opacity = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    opacity.set(withTiming(done ? 1 : 0, timingFor(theme, 'base')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.settle,
        { backgroundColor: theme.colors.backgroundSelected, borderRadius: theme.shape.radius.md },
        style,
      ]}
    />
  );
}

function SetInput({
  label,
  value,
  onChangeText,
  keyboardType,
  onBlur,
  onLabelPress,
  labelAccessibilityLabel,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType: 'decimal-pad' | 'number-pad' | 'default';
  onBlur?: () => void;
  /** Makes the small caption tappable — used by the kg field for the plate sheet. */
  onLabelPress?: () => void;
  labelAccessibilityLabel?: string;
}) {
  const c = useTheme();
  const { shape, fonts } = useAppTheme();
  const labelFont = { fontFamily: fonts.label };
  return (
    <View
      style={[
        styles.inputBox,
        {
          backgroundColor: c.backgroundElement,
          borderColor: c.border,
          borderRadius: shape.radius.sm,
        },
      ]}>
      {onLabelPress ? (
        <Pressable
          onPress={onLabelPress}
          accessibilityRole="button"
          accessibilityLabel={labelAccessibilityLabel}
          hitSlop={6}
          style={styles.labelRow}>
          <Text style={[styles.inputLabel, labelFont, { color: c.accent }]}>{label}</Text>
          <Ionicons name="disc-outline" size={11} color={c.accent} />
        </Pressable>
      ) : (
        <Text style={[styles.inputLabel, labelFont, { color: c.textSecondary }]}>{label}</Text>
      )}
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        keyboardType={keyboardType}
        placeholder="—"
        placeholderTextColor={c.placeholder}
        selectTextOnFocus
        returnKeyType="done"
        style={[
          styles.input,
          { color: c.text, fontFamily: fonts.numeric, fontVariant: ['tabular-nums'] },
        ]}
      />
    </View>
  );
}

interface BreakConfig {
  factor: number;
  incrementKg: number;
  plates: PlateSetup;
}

/** The break factor this session applied (see the banner), or null when it did not. */
async function loadBreakConfig(
  db: ReturnType<typeof useSQLiteContext>,
  workoutId: number,
): Promise<BreakConfig | null> {
  const factor = Number(await getSetting(db, breakAppliedKey(workoutId)));
  if (!(factor > 0 && factor < 1)) return null;
  return {
    factor,
    incrementKg: parseIncrement(await getSetting(db, INCREMENT_SETTING)),
    plates: parsePlateSetup(await getSetting(db, PLATE_SETUP_SETTING)),
  };
}

const lowered = (kg: number | null, b: BreakConfig) =>
  lowerWeight(kg, b.factor, b.incrementKg, b.plates);

/**
 * First-open seeding in flight, per workout exercise. Folding a row shut and
 * open again while its first load still runs mounts a second editor; without
 * this both would find no sets and both would seed — doubled rows.
 */
const seeding = new Map<number, Promise<void>>();

function seedOnce(workoutExerciseId: number, seed: () => Promise<void>): Promise<void> {
  let pending = seeding.get(workoutExerciseId);
  if (!pending) {
    pending = seed().finally(() => seeding.delete(workoutExerciseId));
    seeding.set(workoutExerciseId, pending);
  }
  return pending;
}

/**
 * The sets of one exercise inside a running session, edited in place — it is
 * rendered under the exercise's row when that row is expanded.
 *
 * Every edit is written straight away, so nothing lives only in component
 * state — the row can collapse, scroll away or the session finish at any moment
 * without a flush step. expo-sqlite does not order concurrent async writes, so
 * they run one after another through `save`, each reading the newest row.
 */
export function SetEditor({
  workoutId,
  workoutExerciseId,
  exerciseId,
  onChanged,
  breakOffer = false,
  breakApplyToken = 0,
}: {
  workoutId: number;
  workoutExerciseId: number;
  exerciseId: number;
  /** Sets were added, removed or ticked — the parent refreshes its progress count. */
  onChanged?: () => void;
  /** The break banner is waiting for an answer — its lighter weights contradict the progression hint. */
  breakOffer?: boolean;
  /** Bumped when the banner's "Übernehmen" is tapped; lowers the sets that are still untouched. */
  breakApplyToken?: number;
}) {
  const db = useSQLiteContext();
  const c = useTheme();
  const { shape, fonts } = useAppTheme();
  const restTimer = useRestTimer();

  const [isCardio, setIsCardio] = useState(false);
  const [prior, setPrior] = useState<PriorSet[]>([]);
  /**
   * Per row id: the weight last time put into that row (what seeding carried over). Keyed by id, so
   * deleting or reordering rows cannot misalign it; rows added with "Satz" are not in it.
   */
  const carriedRef = useRef(new Map<number, number | null>());
  const [priorGymName, setPriorGymName] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const rowsRef = useRef<Row[]>([]);
  /** Bests from the other, finished sessions. The sets ticked in this one are
   *  folded in on every tick, so un-ticking one takes it back out. */
  const baseBestsRef = useRef<ExerciseBests>(NO_BESTS);
  const [records, setRecords] = useState<Map<number, PrKind[]>>(new Map());
  /** The record celebration that is playing (its id remounts it on a new record), or null. */
  const [shout, setShout] = useState<{ id: number; rowId: number } | null>(null);
  const shoutCount = useRef(0);
  /** One toast per visit to this exercise — badges stay, the shout does not. */
  const toastedRef = useRef(false);
  /** Target of the plate sheet; null while it is closed. */
  const [plateTarget, setPlateTarget] = useState<number | null>(null);
  const [plateOpen, setPlateOpen] = useState(false);
  /** Double-progression advice from last time; null when there is nothing honest to say. */
  const [rawHint, setHint] = useState<ProgressionHint | null>(null);
  /** The session's break factor is in force (applied earlier or just now). */
  const [breakApplied, setBreakApplied] = useState(false);
  const breakRef = useRef<BreakConfig | null>(null);
  /** Rows whose kg the user typed: the break never overwrites those. */
  const editedWeights = useRef(new Set<number>());
  /** Resolves once the first load (seeding included) is over. */
  const readyRef = useRef<Promise<void>>(Promise.resolve());
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );
  const hint = breakOffer || breakApplied ? null : rawHint;

  // Kept in a ref so a new callback identity from the parent never re-runs the load.
  const onChangedRef = useRef(onChanged);
  useEffect(() => {
    onChangedRef.current = onChanged;
  }, [onChanged]);

  /** State and ref move together: writes read the ref, so they see the latest keystroke. */
  const commitRows = (next: Row[]) => {
    rowsRef.current = next;
    setRows(next);
  };

  const writesRef = useRef<Promise<void>>(Promise.resolve());
  /** Queue a write of the set's current values; resolves once it is stored. */
  const save = (id: number): Promise<void> => {
    const write = writesRef.current.then(async () => {
      const row = rowsRef.current.find((r) => r.id === id);
      if (row) await updateSet(db, id, fieldsOf(row));
    });
    // A failed write must not wedge the queue for every later keystroke.
    writesRef.current = write.catch(() => {});
    return write;
  };

  useEffect(() => {
    let active = true;
    let loaded!: () => void;
    readyRef.current = new Promise<void>((resolve) => {
      loaded = resolve;
    });
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
      const breakConfig = await loadBreakConfig(db, workoutId);
      await seedOnce(workoutExerciseId, async () => {
        // Re-checked inside the guard: an earlier editor may have seeded already.
        if ((await getSetsForWorkoutExercise(db, workoutExerciseId)).length > 0) return;
        for (const draft of createInitialSets(priorSets)) {
          await insertSet(db, {
            workoutId,
            workoutExerciseId,
            exerciseId,
            setNumber: draft.setNumber,
            weightKg: breakConfig ? lowered(draft.weightKg, breakConfig) : draft.weightKg,
            reps: draft.reps,
            distanceKm: draft.distanceKm,
            durationSec: draft.durationSec,
            level: draft.level,
            done: draft.done,
          });
        }
      });
      const current = await getSetsForWorkoutExercise(db, workoutExerciseId);
      if (active) {
        baseBestsRef.current = bests;
        breakRef.current = breakConfig;
        setBreakApplied(breakConfig !== null);
        setIsCardio(cardio);
        setHint(nextHint);
        setPrior(priorSets);
        carriedRef.current = new Map(
          current.map((set) => [set.id, priorSets[set.setNumber - 1]?.weightKg ?? null]),
        );
        setPriorGymName(sourceGymName);
        const loaded = toRows(current);
        rowsRef.current = loaded;
        setRows(loaded);
        onChangedRef.current?.();
      }
    })()
      .catch(showSaveError)
      .finally(loaded);
    return () => {
      active = false;
    };
  }, [db, exerciseId, workoutExerciseId, workoutId]);

  // Banner "Übernehmen": lower the rows still untouched, in memory and on disk, so a
  // value typed a moment ago is never overwritten by a reload.
  const seenApplyToken = useRef(breakApplyToken);
  useEffect(() => {
    if (breakApplyToken === seenApplyToken.current) return;
    seenApplyToken.current = breakApplyToken;
    (async () => {
      await readyRef.current;
      const config = await loadBreakConfig(db, workoutId);
      if (!config || !mountedRef.current) return;
      breakRef.current = config;
      setBreakApplied(true);
      // Read after the awaits: rowsRef holds the latest keystroke.
      const current = rowsRef.current;
      const changed: number[] = [];
      const next = current.map((r) => {
        if (r.done || editedWeights.current.has(r.id) || isPerformed(fieldsOf(r))) return r;
        const kg = parseWeight(r.weightText);
        // Only a row that still holds its raw carried-over weight is lowered. One seeded after the
        // factor was stored (tapping "Übernehmen" and opening the exercise in the same moment) is
        // already lowered; a row the user added with "Satz" was never carried over.
        const carried = carriedRef.current.get(r.id) ?? null;
        if (kg === null || carried === null || kg !== carried) return r;
        const lower = lowered(kg, config);
        if (lower === null || lower === kg) return r;
        changed.push(r.id);
        return { ...r, weightText: formatWeight(lower) };
      });
      if (changed.length === 0) return;
      commitRows(next);
      await Promise.all(changed.map((id) => save(id)));
    })().catch(showSaveError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakApplyToken]);

  const setField = (id: number, field: TextField, value: string) => {
    if (field === 'weightText') editedWeights.current.add(id);
    const next = rowsRef.current.map((r) => (r.id === id ? { ...r, [field]: value } : r));
    commitRows(next);
    void save(id).catch(showSaveError);
  };

  /** Show the time as it was stored: "32" becomes "32:00", "1:75" (not a time) clears. */
  const normalizeTime = (id: number) => {
    const row = rowsRef.current.find((r) => r.id === id);
    if (!row || row.timeText.trim() === '') return;
    const stored = formatDuration(parseDuration(row.timeText));
    if (stored !== row.timeText) setField(id, 'timeText', stored);
  };

  const toggleDone = (row: Row) => {
    const latest = rowsRef.current.find((r) => r.id === row.id) ?? row;
    const next = !latest.done;
    commitRows(rowsRef.current.map((r) => (r.id === row.id ? { ...r, done: next } : r)));
    void save(row.id)
      .then(() => onChangedRef.current?.())
      .catch(showSaveError);
    if (!next) {
      // Un-ticking is a correction: no rest, and its record badge goes with it.
      setRecords((prev) => {
        const without = new Map(prev);
        without.delete(row.id);
        return without;
      });
      return;
    }
    haptic('set-done');
    restTimer.start();

    // The bar is everything before plus the other sets ticked right now, so the
    // second set of a session compares against the first.
    const bar = rowsRef.current
      .filter((r) => r.done && r.id !== row.id)
      .reduce((bests, r) => withSet(bests, fieldsOf(r)), baseBestsRef.current);
    const kinds = detectPersonalRecords(fieldsOf(latest), bar);
    if (kinds.length === 0) return;

    setRecords((prev) => new Map(prev).set(row.id, kinds));
    haptic('record');
    setShout({ id: (shoutCount.current += 1), rowId: row.id });
    if (!toastedRef.current && Platform.OS === 'android') {
      toastedRef.current = true;
      ToastAndroid.show(`Neuer Rekord: ${describeRecords(kinds)}`, ToastAndroid.LONG);
    }
  };

  const addSet = async () => {
    try {
      const index = rowsRef.current.length;
      const prev = rowsRef.current[index - 1];
      const priorAt = prior[index];
      const draft = {
        workoutId,
        workoutExerciseId,
        exerciseId,
        setNumber: index + 1,
        // Carry over the "settings" from last time (or the previous set); the
        // performance fields (reps / time) stay empty.
        weightKg:
          breakRef.current && priorAt?.weightKg != null
            ? lowered(priorAt.weightKg, breakRef.current)
            : (priorAt?.weightKg ?? (prev ? parseWeight(prev.weightText) : null)),
        distanceKm: priorAt?.distanceKm ?? (prev ? parseWeight(prev.distanceText) : null),
        level: priorAt?.level ?? (prev ? parseReps(prev.levelText) : null),
        reps: null,
        durationSec: null,
        done: false,
      };
      const id = await insertSet(db, draft);
      // Appended in memory, not reloaded: a reload would overwrite whatever was
      // typed into the other sets while the insert ran.
      const [added] = toRows([{ ...draft, id } as WorkoutSet]);
      commitRows([...rowsRef.current, added]);
      onChangedRef.current?.();
    } catch (error) {
      showSaveError(error);
    }
  };

  const removeSet = (row: Row, setNumber: number) => {
    if (rowsRef.current.length === 1) {
      // An exercise with no sets at all would be re-seeded from last time the
      // next time it opens — the delete would quietly undo itself.
      Alert.alert(
        'Letzter Satz',
        'Eine Übung behält mindestens einen Satz. Zum Entfernen der ganzen Übung die Zeile zur Seite wischen.',
      );
      return;
    }
    Alert.alert('Satz löschen?', `Satz ${setNumber} entfernen.`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          try {
            await writesRef.current;
            await deleteSet(db, row.id);
            const remaining = rowsRef.current.filter((r) => r.id !== row.id);
            await Promise.all(remaining.map((r, i) => updateSetNumber(db, r.id, i + 1)));
            commitRows(rowsRef.current.filter((r) => r.id !== row.id));
            setRecords((prev) => {
              const without = new Map(prev);
              without.delete(row.id);
              return without;
            });
            onChangedRef.current?.();
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
    commitRows(next);
    void Promise.all(indices.map((i) => save(next[i].id))).catch(showSaveError);
  };

  const referenceFor = (ref: PriorSet | undefined): string | null => {
    if (!ref) return null;
    return isCardio
      ? formatCardioReference(ref.distanceKm ?? null, ref.durationSec ?? null, ref.level ?? null)
      : formatReference(ref.weightKg, ref.reps);
  };

  return (
    <View style={styles.body}>
      {hint ? (
        <View
          style={[
            styles.progression,
            {
              backgroundColor: c.backgroundElement,
              borderColor: c.border,
              borderRadius: shape.radius.md,
            },
          ]}>
          <Ionicons
            name={hint.kind === 'increase' ? 'trending-up' : 'repeat'}
            size={18}
            color={c.accent}
          />
          <View style={styles.progressionTexts}>
            <Text style={[styles.progressionTitle, { color: c.text, fontFamily: fonts.bodyBold }]}>
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
              <Text
                style={[styles.progressionAction, { color: c.accent, fontFamily: fonts.bodyBold }]}>
                Übernehmen
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {rows.map((row, i) => {
        const refLabel = referenceFor(prior[i]);
        return (
          <View key={row.id} style={styles.setBlock}>
            {/* Plays above the ticked row (bottom edge = row top), so it never covers that row's
                inputs, its reference line or the next set; touches pass through anyway. */}
            {shout?.rowId === row.id ? (
              <View pointerEvents="none" style={styles.shout}>
                <Celebration key={shout.id} kind="pr" label="Neuer Rekord" visible onDone={() => setShout(null)} />
              </View>
            ) : null}
            <View style={styles.setRow}>
              <RowSettle done={row.done} />
              <Pressable
                onLongPress={() => removeSet(row, i + 1)}
                style={[styles.badge, { borderColor: c.border, borderRadius: shape.radius.sm }]}>
                <Text
                  style={[styles.badgeText, { color: c.textSecondary, fontFamily: fonts.numeric }]}>
                  {i + 1}
                </Text>
              </Pressable>
              {isCardio ? (
                <>
                  <SetInput
                    label="KM"
                    value={row.distanceText}
                    onChangeText={(t) => setField(row.id, 'distanceText', t)}
                    keyboardType="decimal-pad"
                  />
                  <SetInput
                    label="ZEIT (min:s)"
                    value={row.timeText}
                    onChangeText={(t) => setField(row.id, 'timeText', t)}
                    onBlur={() => normalizeTime(row.id)}
                    keyboardType="default"
                  />
                  <SetInput
                    label="STUFE"
                    value={row.levelText}
                    onChangeText={(t) => setField(row.id, 'levelText', t)}
                    keyboardType="number-pad"
                  />
                </>
              ) : (
                <>
                  <SetInput
                    label="KG"
                    value={row.weightText}
                    onChangeText={(t) => setField(row.id, 'weightText', t)}
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
                    keyboardType="number-pad"
                  />
                </>
              )}
              <CheckPop checked={row.done}>
              <Pressable
                onPress={() => toggleDone(row)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: row.done }}
                accessibilityLabel={`Satz ${i + 1} erledigt`}
                style={[
                  styles.check,
                  {
                    borderRadius: shape.radius.sm,
                    backgroundColor: row.done ? c.accent : 'transparent',
                    borderColor: row.done ? c.accent : c.border,
                  },
                ]}>
                <Ionicons
                  name="checkmark"
                  size={18}
                  color={row.done ? c.onAccent : c.placeholder}
                />
              </Pressable>
              </CheckPop>
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
                  style={[
                    styles.prBadge,
                    { backgroundColor: c.success, borderRadius: shape.radius.sm },
                  ]}>
                  <Ionicons name="trophy" size={11} color={c.onAccent} />
                  <Text style={[styles.prText, { color: c.onAccent, fontFamily: fonts.label }]}>
                    PR
                  </Text>
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

      <PlateSheet targetKg={plateTarget} visible={plateOpen} onClose={() => setPlateOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.two },
  setBlock: { gap: 2 },
  shout: { position: 'absolute', bottom: '100%', marginBottom: 4, left: 0, right: 0, height: 150, zIndex: 5 },
  settle: { position: 'absolute', top: -3, bottom: -3, left: -4, right: -4 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  badge: {
    width: 30,
    height: 44,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 13 },
  inputBox: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
  },
  inputLabel: { fontSize: 9, letterSpacing: 0.6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  input: { fontSize: 17, padding: 0, margin: 0 },
  check: {
    width: 44,
    height: 44,
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
  },
  prText: { fontSize: 11, letterSpacing: 0.4 },
  hint: { marginTop: Spacing.one, textAlign: 'center' },
  progression: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    marginBottom: Spacing.one,
  },
  progressionTexts: { flex: 1 },
  progressionTitle: { fontSize: 15 },
  progressionAction: { fontSize: 14 },
});
