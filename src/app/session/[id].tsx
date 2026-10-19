import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import ReorderableList, {
  reorderItems,
  useReorderableDrag,
  type ReorderableListReorderEvent,
} from 'react-native-reorderable-list';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BreakBanner } from '@/components/break-banner';
import { Celebration } from '@/components/celebration';
import { FadeInListItem } from '@/components/motion/fade-in-list-item';
import { RestTimerBanner, useRestTimer } from '@/components/rest-timer';
import { SessionClock } from '@/components/session-clock';
import { SetEditor } from '@/components/set-editor';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { SwipeToDelete } from '@/components/ui/swipe-to-delete';
import { Spacing } from '@/constants/theme';
import {
  deleteWorkout,
  finishWorkout,
  getGym,
  getLastFinishedWorkoutDate,
  getSetProgressForWorkout,
  getSetting,
  getWeekOverview,
  getWorkout,
  getWorkoutExercises,
  lowerUntouchedWeights,
  removeWorkoutExercise,
  reorderWorkoutExercises,
  type SetProgress,
  setSetting,
  type WorkoutExerciseWithExercise,
} from '@/db';
import {
  breakAppliedKey,
  breakDismissedKey,
  breakFactor,
  daysBetween,
  lowerWeight,
} from '@/domain/break';
import { plural } from '@/domain/format';
import { parsePlateSetup, PLATE_SETUP_SETTING } from '@/domain/plates';
import { INCREMENT_SETTING, parseIncrement } from '@/domain/progression';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useTheme } from '@/hooks/use-theme';
import { showSaveError } from '@/lib/alerts';
import { markGoalCelebrated, shouldCelebrateGoal } from '@/lib/celebrations';
import { haptic } from '@/lib/haptics';

/**
 * One exercise row. Rendered inside ReorderableList, so it can call
 * useReorderableDrag: the grip starts a drag at once (a long press on the row
 * too, but only after 400 ms), swipe deletes, tap folds the sets open right
 * underneath. The long press waits that long because a mouse click or a firm
 * tap is often held past 150 ms — that swallowed the tap and opened nothing.
 */
function ExerciseRow({
  we,
  workoutId,
  progress,
  expanded,
  onToggle,
  onRemove,
  onSetsChanged,
  breakOffer,
  breakApplyToken,
}: {
  we: WorkoutExerciseWithExercise;
  workoutId: number;
  progress?: SetProgress;
  expanded: boolean;
  onToggle: () => void;
  onRemove: (close: () => void) => void;
  onSetsChanged: () => void;
  breakOffer: boolean;
  breakApplyToken: number;
}) {
  const c = useTheme();
  const { shape } = useAppTheme();
  const drag = useReorderableDrag();
  return (
    <View style={styles.rowWrap}>
      <SwipeToDelete
        onDelete={onRemove}
        accessibilityLabel={`„${we.exercise.name}" aus der Einheit entfernen`}>
        {/* The grip sits beside the row, not inside it: a pressable inside the
            row's pressable is a <button> in a <button> on web, which is invalid
            and swallowed the clicks around it. */}
        <View>
          <ListRow
            title={we.exercise.name}
            subtitle={progress ? `${progress.done}/${progress.total} Sätze` : we.exercise.muscleGroup}
            onPress={onToggle}
            onLongPress={drag}
            delayLongPress={400}
            selected={expanded}
            accessibilityLabel={`${we.exercise.name}, Sätze ${expanded ? 'zuklappen' : 'aufklappen'}`}
            right={
              <View style={styles.rowIcons}>
                <Ionicons
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={c.textSecondary}
                />
                <View style={styles.gripSpace} />
              </View>
            }
          />
          <Pressable
            onPressIn={drag}
            hitSlop={6}
            style={styles.grip}
            accessibilityRole="button"
            accessibilityLabel={`„${we.exercise.name}" verschieben`}>
            <Ionicons name="reorder-three-outline" size={22} color={c.textSecondary} />
          </Pressable>
        </View>
      </SwipeToDelete>
      {expanded ? (
        <View
          style={[
            styles.sets,
            {
              backgroundColor: c.card,
              borderColor: c.border,
              borderWidth: shape.borderWidth,
              borderRadius: shape.radius.md,
            },
          ]}>
          <SetEditor
            workoutId={workoutId}
            workoutExerciseId={we.id}
            exerciseId={we.exerciseId}
            onChanged={onSetsChanged}
            breakOffer={breakOffer}
            breakApplyToken={breakApplyToken}
          />
        </View>
      ) : null}
    </View>
  );
}

export default function SessionScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useTheme();
  const restTimer = useRestTimer();
  const { id } = useLocalSearchParams<{ id: string }>();
  const workoutId = Number(id);

  const [exercises, setExercises] = useState<WorkoutExerciseWithExercise[]>([]);
  const [progress, setProgress] = useState<Map<number, SetProgress>>(new Map());
  const [gymName, setGymName] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  /** The one exercise whose sets are folded open; opening another closes it. */
  const [openId, setOpenId] = useState<number | null>(null);
  /** Mirror of `openId` for async code that must see the exercise open *now*, not at call time. */
  const openIdRef = useRef<number | null>(null);
  useEffect(() => {
    openIdRef.current = openId;
  }, [openId]);

  const load = useCallback(() => {
    getWorkoutExercises(db, workoutId).then(setExercises);
    getSetProgressForWorkout(db, workoutId).then(setProgress);
    getWorkout(db, workoutId)
      .then((w) => {
        setStartedAt(w?.startedAt ?? null);
        return w ? getGym(db, w.gymId) : null;
      })
      .then((g) => setGymName(g?.name ?? null));
  }, [db, workoutId]);

  useFocusEffect(useCallback(() => load(), [load]));

  /** Break detection: shown once per session, until answered with Übernehmen or Später. */
  const [breakOffer, setBreakOffer] = useState<{ days: number; factor: number } | null>(null);
  const [breakApplied, setBreakApplied] = useState(false);
  const [breakApplyToken, setBreakApplyToken] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const last = await getLastFinishedWorkoutDate(db, workoutId);
      const days = last === null ? null : daysBetween(last, new Date());
      const factor = breakFactor(days);
      if (factor === null || days === null) return;
      const answered =
        (await getSetting(db, breakAppliedKey(workoutId))) !== null ||
        (await getSetting(db, breakDismissedKey(workoutId))) !== null;
      if (active && !answered) setBreakOffer({ days, factor });
    })().catch(() => {
      // The banner is a convenience; a failed lookup must not block the session.
    });
    return () => {
      active = false;
    };
  }, [db, workoutId]);

  const applyBreak = async () => {
    if (!breakOffer) return;
    try {
      const { factor } = breakOffer;
      const incrementKg = parseIncrement(await getSetting(db, INCREMENT_SETTING));
      const plates = parsePlateSetup(await getSetting(db, PLATE_SETUP_SETTING));
      // Stored first: exercises opened from now on seed lowered, even before the writes below end.
      await setSetting(db, breakAppliedKey(workoutId), String(factor));
      await lowerUntouchedWeights(db, workoutId, () => openIdRef.current, (kg) =>
        lowerWeight(kg, factor, incrementKg, plates),
      );
      setBreakApplied(true);
      setBreakApplyToken((n) => n + 1);
      load();
    } catch (error) {
      showSaveError(error);
    }
  };

  const postponeBreak = async () => {
    setBreakOffer(null);
    try {
      await setSetting(db, breakDismissedKey(workoutId), '1');
    } catch (error) {
      showSaveError(error);
    }
  };

  /** The goal celebration that is playing (its start time doubles as the key), or null. */
  const [goalShout, setGoalShout] = useState<{ key: number; label: string } | null>(null);
  const checkingGoals = useRef(false);

  /** A week goal reached by this tick is celebrated once per week and goal, then remembered. */
  const checkGoals = useCallback(async () => {
    if (checkingGoals.current) return; // two quick ticks must not both see "not celebrated yet"
    checkingGoals.current = true;
    try {
      const { progress, goal } = await getWeekOverview(db, new Date());
      const labels: string[] = [];
      if (progress.volumeKg > 0 && progress.volumeKg >= goal.kg) {
        if (await shouldCelebrateGoal(db, 'kg', progress.weekKey)) {
          await markGoalCelebrated(db, 'kg', progress.weekKey);
          labels.push('Wochenziel geschafft');
        }
      }
      if (goal.km !== null && progress.distanceKm > 0 && progress.distanceKm >= goal.km) {
        if (await shouldCelebrateGoal(db, 'km', progress.weekKey)) {
          await markGoalCelebrated(db, 'km', progress.weekKey);
          labels.push('Cardio-Ziel geschafft');
        }
      }
      if (labels.length > 0) {
        haptic('record');
        setGoalShout({ key: Date.now(), label: labels.length > 1 ? 'Beide Wochenziele geschafft' : labels[0] });
      }
    } catch {
      // A missed celebration is not worth an alert; the set itself is already saved.
    } finally {
      checkingGoals.current = false;
    }
  }, [db]);

  const refreshProgress = useCallback(() => {
    getSetProgressForWorkout(db, workoutId).then(setProgress);
    void checkGoals();
  }, [db, workoutId, checkGoals]);

  const removeExercise = async (we: WorkoutExerciseWithExercise) => {
    setExercises((prev) => prev.filter((x) => x.id !== we.id)); // reflow immediately
    if (openId === we.id) setOpenId(null);
    try {
      await removeWorkoutExercise(db, we.id);
    } catch (error) {
      showSaveError(error);
      load(); // re-sync on failure
    }
  };

  // An empty exercise goes on the swipe, as before. Once sets are ticked the
  // swipe would throw away real work in one brush of the thumb — ask first.
  const askRemoveExercise = (we: WorkoutExerciseWithExercise, close: () => void) => {
    const done = progress.get(we.id)?.done ?? 0;
    if (done === 0) {
      void removeExercise(we);
      return;
    }
    Alert.alert(
      'Übung entfernen?',
      `„${we.exercise.name}" und ${plural(done, 'erledigter Satz', 'erledigte Sätze')} werden aus der Einheit gelöscht.`,
      [
        { text: 'Abbrechen', style: 'cancel', onPress: close },
        { text: 'Entfernen', style: 'destructive', onPress: () => void removeExercise(we) },
      ],
    );
  };

  const onReorder = ({ from, to }: ReorderableListReorderEvent) => {
    const next = reorderItems(exercises, from, to);
    setExercises(next);
    reorderWorkoutExercises(
      db,
      next.map((we) => we.id),
    ).catch((error) => {
      showSaveError(error);
      load(); // re-sync on failure, same as removeExercise
    });
  };

  const save = async () => {
    try {
      await finishWorkout(db, workoutId, new Date().toISOString());
    } catch (error) {
      showSaveError(error);
      return;
    }
    restTimer.dismiss(); // no "Pause vorbei" buzz after the session is over
    // Replace, not push: the summary takes the session's place, so its
    // "Fertig" (and the back gesture) lands on Heute, not on a closed session.
    router.replace({
      pathname: '/workout/summary',
      params: { id: String(workoutId), fresh: '1' },
    });
  };

  const discard = async () => {
    try {
      await deleteWorkout(db, workoutId);
    } catch (error) {
      showSaveError(error);
      return;
    }
    restTimer.dismiss();
    router.back();
  };

  const finish = () => {
    const doneSets = [...progress.values()].reduce((sum, p) => sum + p.done, 0);
    if (doneSets === 0) {
      // A session started by mistake would otherwise land in Verlauf and the
      // calendar as an empty entry, deletable only from its detail screen.
      Alert.alert('Noch kein Satz abgehakt', 'Einheit verwerfen oder trotzdem speichern?', [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Verwerfen', style: 'destructive', onPress: () => void discard() },
        { text: 'Speichern', onPress: () => void save() },
      ]);
      return;
    }
    Alert.alert('Einheit beenden?', 'Die Einheit wird abgeschlossen und im Verlauf gespeichert.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Beenden', onPress: () => void save() },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: gymName ? `Einheit · ${gymName}` : 'Einheit',
          headerRight: () => <SessionClock startedAt={startedAt} />,
        }}
      />
      <ReorderableList
        data={exercises}
        keyExtractor={(we) => String(we.id)}
        onReorder={onReorder}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <FadeInListItem index={index}>
          <ExerciseRow
            we={item}
            workoutId={workoutId}
            progress={progress.get(item.id)}
            expanded={openId === item.id}
            onToggle={() => setOpenId((prev) => (prev === item.id ? null : item.id))}
            onRemove={(close) => askRemoveExercise(item, close)}
            onSetsChanged={refreshProgress}
            breakOffer={breakOffer !== null && !breakApplied}
            breakApplyToken={breakApplyToken}
          />
          </FadeInListItem>
        )}
        ListHeaderComponent={
          breakOffer ? (
            <BreakBanner
              days={breakOffer.days}
              factor={breakOffer.factor}
              applied={breakApplied}
              onApply={() => void applyBreak()}
              onLater={() => void postponeBreak()}
            />
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="barbell-outline"
            title="Noch keine Übungen"
            message="Füge unten eine Übung hinzu."
          />
        }
        ListFooterComponent={
          <Button
            label="Übung hinzufügen"
            icon="add"
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: '/session/add-exercise',
                params: { workoutId: String(workoutId) },
              })
            }
          />
        }
      />

      {goalShout ? (
        <Celebration
          key={goalShout.key}
          kind="goal"
          label={goalShout.label}
          visible
          onDone={() => setGoalShout(null)}
        />
      ) : null}

      <SafeAreaView
        edges={['bottom']}
        style={[styles.footer, { borderTopColor: c.border, backgroundColor: c.background }]}>
        <RestTimerBanner />
        <Button label="Einheit beenden" icon="checkmark-done" onPress={finish} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: {
    padding: Spacing.four,
  },
  rowWrap: { marginBottom: Spacing.two },
  rowIcons: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  gripSpace: { width: 22 },
  grip: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: Spacing.three,
    width: 22,
    justifyContent: 'center',
  },
  sets: {
    marginTop: Spacing.one,
    padding: Spacing.three,
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
  },
});
