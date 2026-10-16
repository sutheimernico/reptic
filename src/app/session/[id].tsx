import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import ReorderableList, {
  reorderItems,
  useReorderableDrag,
  type ReorderableListReorderEvent,
} from 'react-native-reorderable-list';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RestTimerBanner, useRestTimer } from '@/components/rest-timer';
import { SessionClock } from '@/components/session-clock';
import { SetEditor } from '@/components/set-editor';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { SwipeToDelete } from '@/components/ui/swipe-to-delete';
import { Radius, Spacing } from '@/constants/theme';
import {
  deleteWorkout,
  finishWorkout,
  getGym,
  getSetProgressForWorkout,
  getWorkout,
  getWorkoutExercises,
  removeWorkoutExercise,
  reorderWorkoutExercises,
  type SetProgress,
  type WorkoutExerciseWithExercise,
} from '@/db';
import { plural } from '@/domain/format';
import { useTheme } from '@/hooks/use-theme';
import { showSaveError } from '@/lib/alerts';

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
}: {
  we: WorkoutExerciseWithExercise;
  workoutId: number;
  progress?: SetProgress;
  expanded: boolean;
  onToggle: () => void;
  onRemove: (close: () => void) => void;
  onSetsChanged: () => void;
}) {
  const c = useTheme();
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
        <View style={[styles.sets, { backgroundColor: c.card, borderColor: c.border }]}>
          <SetEditor
            workoutId={workoutId}
            workoutExerciseId={we.id}
            exerciseId={we.exerciseId}
            onChanged={onSetsChanged}
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

  const refreshProgress = useCallback(() => {
    getSetProgressForWorkout(db, workoutId).then(setProgress);
  }, [db, workoutId]);

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
        renderItem={({ item }) => (
          <ExerciseRow
            we={item}
            workoutId={workoutId}
            progress={progress.get(item.id)}
            expanded={openId === item.id}
            onToggle={() => setOpenId((prev) => (prev === item.id ? null : item.id))}
            onRemove={(close) => askRemoveExercise(item, close)}
            onSetsChanged={refreshProgress}
          />
        )}
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
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
  },
});
