/**
 * Integration tests for the load-bearing SQL in `@/db`, run against real
 * SQLite (node:sqlite via the shared adapter). The migration suite covers the
 * schema; this one covers the queries the screens depend on — counts that must
 * not double-count, the gym-aware "last time" lookup, the archive-vs-delete
 * decision, and the backup round-trip.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  addWorkoutExercise,
  createExercise,
  createGym,
  createPlan,
  deleteWorkout,
  exerciseHasHistory,
  exportAllData,
  finishWorkout,
  getExerciseSessionHistory,
  getFinishedWorkoutSummaries,
  getLastSetsForExercise,
  getSetProgressForWorkout,
  gymHasWorkouts,
  importAllData,
  insertSet,
  setPlanExercises,
  startWorkout,
} from '@/db';
import { migrateDbIfNeeded } from '@/db/schema';
import { openDb } from '@/db/test-support/sqlite-adapter';
import { parseBackup, serializeBackup } from '@/domain/backup';

async function freshDb(): Promise<SQLiteDatabase> {
  const { db } = openDb();
  await migrateDbIfNeeded(db);
  return db;
}

/** A finished session in `gymId` containing `exerciseId`, with the given sets. */
async function loggedSession(
  db: SQLiteDatabase,
  {
    gymId,
    exerciseId,
    startedAt,
    finishedAt,
    sets,
  }: {
    gymId: number;
    exerciseId: number;
    startedAt: string;
    finishedAt: string | null;
    sets: Partial<{
      weightKg: number | null;
      reps: number | null;
      distanceKm: number | null;
      durationSec: number | null;
      level: number | null;
      done: boolean;
    }>[];
  },
): Promise<number> {
  const workoutId = await startWorkout(db, [], gymId, startedAt);
  const workoutExerciseId = await addWorkoutExercise(db, workoutId, exerciseId);
  let setNumber = 1;
  for (const s of sets) {
    await insertSet(db, {
      workoutId,
      workoutExerciseId,
      exerciseId,
      setNumber: setNumber++,
      weightKg: s.weightKg ?? null,
      reps: s.reps ?? null,
      distanceKm: s.distanceKm ?? null,
      durationSec: s.durationSec ?? null,
      level: s.level ?? null,
      done: s.done ?? true,
    });
  }
  if (finishedAt) await finishWorkout(db, workoutId, finishedAt);
  return workoutId;
}

describe('getFinishedWorkoutSummaries', () => {
  it('counts only performed sets and never double-counts across joins', async () => {
    const db = await freshDb();
    const gym = await createGym(db, 'Quakenbrück');
    const bench = await createExercise(db, 'Bankdrücken', 'Brust');
    const rows = await createExercise(db, 'Rudern', 'Rücken');

    const workoutId = await startWorkout(db, [], gym, '2026-08-01T10:00:00.000Z');
    const benchWe = await addWorkoutExercise(db, workoutId, bench);
    const rowsWe = await addWorkoutExercise(db, workoutId, rows);
    for (const [n, weight, reps] of [
      [1, 80, 8],
      [2, 80, 8],
      [3, 82.5, 6],
    ] as const) {
      await insertSet(db, {
        workoutId,
        workoutExerciseId: benchWe,
        exerciseId: bench,
        setNumber: n,
        weightKg: weight,
        reps,
        done: true,
      });
    }
    // Carried over but never touched (no reps) — must not count as work done.
    await insertSet(db, {
      workoutId,
      workoutExerciseId: rowsWe,
      exerciseId: rows,
      setNumber: 1,
      weightKg: 60,
      reps: null,
      done: false,
    });
    await finishWorkout(db, workoutId, '2026-08-01T11:00:00.000Z');

    const [summary] = await getFinishedWorkoutSummaries(db);
    expect(summary.setCount).toBe(3);
    expect(summary.exerciseCount).toBe(1); // only Bankdrücken was actually performed
    expect(summary.volume).toBe(80 * 8 + 80 * 8 + 82.5 * 6);
    expect(summary.gymName).toBe('Quakenbrück');
  });

  it('counts a cardio-only session and reports zero volume', async () => {
    const db = await freshDb();
    const gym = await createGym(db, 'Zuhause');
    const bike = await createExercise(db, 'Ergometer', 'Cardio');
    await loggedSession(db, {
      gymId: gym,
      exerciseId: bike,
      startedAt: '2026-08-02T10:00:00.000Z',
      finishedAt: '2026-08-02T10:40:00.000Z',
      sets: [{ distanceKm: 12.5, durationSec: 2400, level: 8 }],
    });

    const [summary] = await getFinishedWorkoutSummaries(db);
    expect(summary.setCount).toBe(1);
    expect(summary.exerciseCount).toBe(1);
    expect(summary.volume).toBe(0);
  });

  it('excludes the running session and orders newest first', async () => {
    const db = await freshDb();
    const gym = await createGym(db, 'Gym');
    const ex = await createExercise(db, 'Kniebeuge', 'Beine');
    await loggedSession(db, {
      gymId: gym, exerciseId: ex,
      startedAt: '2026-08-01T10:00:00.000Z', finishedAt: '2026-08-01T11:00:00.000Z',
      sets: [{ weightKg: 100, reps: 5 }],
    });
    await loggedSession(db, {
      gymId: gym, exerciseId: ex,
      startedAt: '2026-08-05T10:00:00.000Z', finishedAt: '2026-08-05T11:00:00.000Z',
      sets: [{ weightKg: 105, reps: 5 }],
    });
    await loggedSession(db, {
      gymId: gym, exerciseId: ex,
      startedAt: '2026-08-06T10:00:00.000Z', finishedAt: null, // still running
      sets: [{ weightKg: 110, reps: 3 }],
    });

    const summaries = await getFinishedWorkoutSummaries(db);
    expect(summaries.map((s) => s.finishedAt)).toEqual([
      '2026-08-05T11:00:00.000Z',
      '2026-08-01T11:00:00.000Z',
    ]);
  });

  it('restricts to the requested range (calendar)', async () => {
    const db = await freshDb();
    const gym = await createGym(db, 'Gym');
    const ex = await createExercise(db, 'Kniebeuge', 'Beine');
    for (const day of ['2026-07-31', '2026-08-01', '2026-08-31', '2026-09-01']) {
      await loggedSession(db, {
        gymId: gym, exerciseId: ex,
        startedAt: `${day}T10:00:00.000Z`, finishedAt: `${day}T11:00:00.000Z`,
        sets: [{ weightKg: 100, reps: 5 }],
      });
    }

    const august = await getFinishedWorkoutSummaries(db, {
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-09-01T00:00:00.000Z',
    });
    expect(august.map((s) => s.finishedAt?.slice(0, 10))).toEqual(['2026-08-31', '2026-08-01']);
  });
});

describe('getLastSetsForExercise', () => {
  it('prefers the same gym over a more recent session elsewhere', async () => {
    const db = await freshDb();
    const home = await createGym(db, 'Quakenbrück');
    const away = await createGym(db, 'Bramsche');
    const bench = await createExercise(db, 'Bankdrücken', 'Brust');

    await loggedSession(db, {
      gymId: home, exerciseId: bench,
      startedAt: '2026-08-01T10:00:00.000Z', finishedAt: '2026-08-01T11:00:00.000Z',
      sets: [{ weightKg: 80, reps: 8 }, { weightKg: 80, reps: 7 }],
    });
    await loggedSession(db, {
      gymId: away, exerciseId: bench,
      startedAt: '2026-08-05T10:00:00.000Z', finishedAt: '2026-08-05T11:00:00.000Z',
      sets: [{ weightKg: 60, reps: 10 }],
    });

    const result = await getLastSetsForExercise(db, bench, home);
    expect(result.sourceGymName).toBeNull(); // same gym → no source label
    expect(result.sets.map((s) => s.weightKg)).toEqual([80, 80]);
  });

  it('falls back to any gym and names the source', async () => {
    const db = await freshDb();
    const away = await createGym(db, 'Bramsche');
    const newGym = await createGym(db, 'Neues Studio');
    const bench = await createExercise(db, 'Bankdrücken', 'Brust');

    await loggedSession(db, {
      gymId: away, exerciseId: bench,
      startedAt: '2026-08-05T10:00:00.000Z', finishedAt: '2026-08-05T11:00:00.000Z',
      sets: [{ weightKg: 60, reps: 10 }],
    });

    const result = await getLastSetsForExercise(db, bench, newGym);
    expect(result.sourceGymName).toBe('Bramsche');
    expect(result.sets.map((s) => s.weightKg)).toEqual([60]);
  });

  it('ignores unfinished sessions and the session being logged right now', async () => {
    const db = await freshDb();
    const gym = await createGym(db, 'Gym');
    const bench = await createExercise(db, 'Bankdrücken', 'Brust');

    await loggedSession(db, {
      gymId: gym, exerciseId: bench,
      startedAt: '2026-08-01T10:00:00.000Z', finishedAt: '2026-08-01T11:00:00.000Z',
      sets: [{ weightKg: 80, reps: 8 }],
    });
    const running = await loggedSession(db, {
      gymId: gym, exerciseId: bench,
      startedAt: '2026-08-05T10:00:00.000Z', finishedAt: null,
      sets: [{ weightKg: 999, reps: 1 }],
    });

    expect((await getLastSetsForExercise(db, bench, gym)).sets.map((s) => s.weightKg)).toEqual([80]);
    // Even once it is finished, excluding it must fall back to the older one.
    await finishWorkout(db, running, '2026-08-05T11:00:00.000Z');
    const excluded = await getLastSetsForExercise(db, bench, gym, running);
    expect(excluded.sets.map((s) => s.weightKg)).toEqual([80]);
  });

  it('carries the cardio columns through', async () => {
    const db = await freshDb();
    const gym = await createGym(db, 'Gym');
    const bike = await createExercise(db, 'Ergometer', 'Cardio');
    await loggedSession(db, {
      gymId: gym, exerciseId: bike,
      startedAt: '2026-08-01T10:00:00.000Z', finishedAt: '2026-08-01T11:00:00.000Z',
      sets: [{ distanceKm: 12.5, durationSec: 2400, level: 8 }],
    });

    const [set] = (await getLastSetsForExercise(db, bike, gym)).sets;
    expect(set).toMatchObject({ distanceKm: 12.5, durationSec: 2400, level: 8 });
  });

  it('returns nothing when the exercise was never logged', async () => {
    const db = await freshDb();
    const gym = await createGym(db, 'Gym');
    const fresh = await createExercise(db, 'Neu', 'Bauch');
    expect(await getLastSetsForExercise(db, fresh, gym)).toEqual({ sets: [], sourceGymName: null });
  });
});

describe('archive-vs-delete membership', () => {
  it('reports an exercise as used once it is in a session, before any set exists', async () => {
    const db = await freshDb();
    const gym = await createGym(db, 'Gym');
    const ex = await createExercise(db, 'Kniebeuge', 'Beine');
    expect(await exerciseHasHistory(db, ex)).toBe(false);

    const workoutId = await startWorkout(db, [], gym, '2026-08-01T10:00:00.000Z');
    await addWorkoutExercise(db, workoutId, ex);
    // Sets are created lazily on first open — the exercise is still "in use".
    expect(await exerciseHasHistory(db, ex)).toBe(true);
  });

  it('reports a gym as used exactly while a session references it', async () => {
    const db = await freshDb();
    const gym = await createGym(db, 'Gym');
    const ex = await createExercise(db, 'Kniebeuge', 'Beine');
    expect(await gymHasWorkouts(db, gym)).toBe(false);

    const workoutId = await loggedSession(db, {
      gymId: gym, exerciseId: ex,
      startedAt: '2026-08-01T10:00:00.000Z', finishedAt: '2026-08-01T11:00:00.000Z',
      sets: [{ weightKg: 100, reps: 5 }],
    });
    expect(await gymHasWorkouts(db, gym)).toBe(true);

    await deleteWorkout(db, workoutId);
    expect(await gymHasWorkouts(db, gym)).toBe(false);
  });
});

describe('backup round-trip', () => {
  it('restores every entity type byte-for-byte, cardio fields included', async () => {
    const source = await freshDb();
    const home = await createGym(source, 'Quakenbrück');
    const away = await createGym(source, 'Bramsche');
    const bench = await createExercise(source, 'Bankdrücken', 'Brust');
    const bike = await createExercise(source, 'Ergometer', 'Cardio');
    const push = await createPlan(source, 'Push', '#FF0000');
    await setPlanExercises(source, push, [bench, bike]);

    await loggedSession(source, {
      gymId: home, exerciseId: bench,
      startedAt: '2026-08-01T10:00:00.000Z', finishedAt: '2026-08-01T11:00:00.000Z',
      sets: [{ weightKg: 80, reps: 8, done: true }, { weightKg: 82.5, reps: null, done: false }],
    });
    await loggedSession(source, {
      gymId: away, exerciseId: bike,
      startedAt: '2026-08-03T10:00:00.000Z', finishedAt: '2026-08-03T10:45:00.000Z',
      sets: [{ distanceKm: 12.5, durationSec: 2700, level: 8, done: true }],
    });

    const exported = await exportAllData(source, '2026-08-30T12:00:00.000Z');
    // Through the real serialize/parse path, not the in-memory object.
    const parsed = parseBackup(serializeBackup(exported));

    const target = await freshDb();
    await importAllData(target, parsed);
    const reExported = await exportAllData(target, '2026-08-30T12:00:00.000Z');

    expect(reExported).toEqual(exported);
    // Guard against a vacuously passing round trip.
    expect(exported.workoutSets).toHaveLength(3);
    expect(exported.workoutSets.find((s) => s.distanceKm === 12.5)).toMatchObject({
      durationSec: 2700,
      level: 8,
    });
    expect(exported.planExercises).toHaveLength(2);
  });

  it('replaces existing data instead of merging into it', async () => {
    const db = await freshDb();
    const gym = await createGym(db, 'Alt');
    const ex = await createExercise(db, 'Alt-Übung', 'Bauch');
    await loggedSession(db, {
      gymId: gym, exerciseId: ex,
      startedAt: '2026-08-01T10:00:00.000Z', finishedAt: '2026-08-01T11:00:00.000Z',
      sets: [{ weightKg: 10, reps: 10 }],
    });

    const other = await freshDb();
    const otherGym = await createGym(other, 'Neu');
    const otherEx = await createExercise(other, 'Neu-Übung', 'Brust');
    await loggedSession(other, {
      gymId: otherGym, exerciseId: otherEx,
      startedAt: '2026-08-02T10:00:00.000Z', finishedAt: '2026-08-02T11:00:00.000Z',
      sets: [{ weightKg: 20, reps: 5 }],
    });

    await importAllData(
      db,
      parseBackup(serializeBackup(await exportAllData(other, '2026-08-30T12:00:00.000Z'))),
    );

    const after = await exportAllData(db, '2026-08-30T12:00:00.000Z');
    expect(after.gyms.map((g) => g.name)).toEqual(['Neu']);
    expect(after.workouts).toHaveLength(1);
    expect(after.workoutSets.map((s) => s.weightKg)).toEqual([20]);
  });
});

describe('session helpers', () => {
  it('reports per-exercise set progress in one query', async () => {
    const db = await freshDb();
    const gym = await createGym(db, 'Gym');
    const a = await createExercise(db, 'A', 'Brust');
    const b = await createExercise(db, 'B', 'Rücken');

    const workoutId = await startWorkout(db, [], gym, '2026-08-01T10:00:00.000Z');
    const aWe = await addWorkoutExercise(db, workoutId, a);
    const bWe = await addWorkoutExercise(db, workoutId, b);
    await insertSet(db, { workoutId, workoutExerciseId: aWe, exerciseId: a, setNumber: 1, weightKg: 50, reps: 10, done: true });
    await insertSet(db, { workoutId, workoutExerciseId: aWe, exerciseId: a, setNumber: 2, weightKg: 50, reps: 9, done: false });
    await insertSet(db, { workoutId, workoutExerciseId: bWe, exerciseId: b, setNumber: 1, weightKg: 40, reps: 12, done: true });

    const progress = await getSetProgressForWorkout(db, workoutId);
    expect(progress.get(aWe)).toEqual({ total: 2, done: 1 });
    expect(progress.get(bWe)).toEqual({ total: 1, done: 1 });
  });

  it('returns a session history limited to performed sets, newest first', async () => {
    const db = await freshDb();
    const gym = await createGym(db, 'Gym');
    const ex = await createExercise(db, 'Bankdrücken', 'Brust');

    await loggedSession(db, {
      gymId: gym, exerciseId: ex,
      startedAt: '2026-08-01T10:00:00.000Z', finishedAt: '2026-08-01T11:00:00.000Z',
      sets: [{ weightKg: 80, reps: 8 }, { weightKg: 80, reps: null }],
    });
    await loggedSession(db, {
      gymId: gym, exerciseId: ex,
      startedAt: '2026-08-05T10:00:00.000Z', finishedAt: '2026-08-05T11:00:00.000Z',
      sets: [{ weightKg: 85, reps: 6 }],
    });

    const history = await getExerciseSessionHistory(db, ex);
    expect(history.map((h) => h.date)).toEqual([
      '2026-08-05T11:00:00.000Z',
      '2026-08-01T11:00:00.000Z',
    ]);
    expect(history[0].sets).toHaveLength(1);
    expect(history[1].sets).toHaveLength(1); // the untouched carry-over is skipped
    expect(history[0].gymName).toBe('Gym');
  });

  it('honors the history limit', async () => {
    const db = await freshDb();
    const gym = await createGym(db, 'Gym');
    const ex = await createExercise(db, 'Bankdrücken', 'Brust');
    for (let day = 1; day <= 5; day++) {
      await loggedSession(db, {
        gymId: gym, exerciseId: ex,
        startedAt: `2026-08-0${day}T10:00:00.000Z`, finishedAt: `2026-08-0${day}T11:00:00.000Z`,
        sets: [{ weightKg: 80 + day, reps: 5 }],
      });
    }
    expect(await getExerciseSessionHistory(db, ex, 3)).toHaveLength(3);
  });
});
