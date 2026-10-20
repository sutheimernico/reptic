/**
 * Perf guard for the set-logging hot path: `getWeekProgress` runs on every tick, so it must stay
 * independent of the lifetime set count. The threshold is deliberately generous (the lean path
 * measures a few ms) so a slow CI box does not flake, yet the old full replay (100+ ms) fails it.
 */
import { migrateDbIfNeeded } from '@/db/schema';
import { openDb } from '@/db/test-support/sqlite-adapter';
import { getWeekProgress } from '@/db/week-stats';

it('getWeekProgress stays fast on three years of history (17k sets)', async () => {
  const { raw, db } = openDb();
  await migrateDbIfNeeded(db);
  raw.exec("INSERT INTO gyms (id, name) VALUES (1, 'A')");
  const exercises = 30;
  for (let e = 1; e <= exercises; e++) {
    raw.exec(`INSERT INTO exercises (id, name, muscle_group) VALUES (${1000 + e}, 'E${e}', 'chest')`);
  }
  const now = new Date(2026, 9, 20, 18);
  const insWorkout = raw.prepare(
    'INSERT INTO workouts (id, started_at, finished_at, plan_ids, gym_id) VALUES (?,?,?,?,?)',
  );
  const insExercise = raw.prepare(
    'INSERT INTO workout_exercises (id, workout_id, exercise_id, sort_order) VALUES (?,?,?,?)',
  );
  const insSet = raw.prepare(
    'INSERT INTO workout_sets (workout_id, workout_exercise_id, exercise_id, set_number, weight_kg, reps, done) VALUES (?,?,?,?,?,?,1)',
  );
  let weId = 0;
  let sets = 0;
  raw.exec('BEGIN');
  for (let w = 1; w <= 624; w++) {
    const start = new Date(now.getTime() - (624 - w) * 1.75 * 86_400_000);
    insWorkout.run(w, start.toISOString(), new Date(start.getTime() + 3_600_000).toISOString(), '[]', 1);
    for (let k = 0; k < 7; k++) {
      weId += 1;
      const exerciseId = 1001 + ((w * 7 + k) % exercises);
      insExercise.run(weId, w, exerciseId, k);
      for (let s = 1; s <= 4; s++) {
        insSet.run(w, weId, exerciseId, s, 40 + w * 0.05 + s, 8 + (w % 3));
        sets += 1;
      }
    }
  }
  raw.exec('COMMIT');
  expect(sets).toBeGreaterThan(17_000);

  await getWeekProgress(db, now); // warm the statement cache
  const t0 = performance.now();
  await getWeekProgress(db, now);
  expect(performance.now() - t0).toBeLessThan(50);
});
