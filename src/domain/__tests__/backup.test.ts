import { type BackupPayload, BACKUP_VERSION, parseBackup, serializeBackup } from '@/domain/backup';

const payload: BackupPayload = {
  exportedAt: '2026-07-05T10:00:00.000Z',
  exercises: [{ id: 1, name: 'Bankdrücken', muscleGroup: 'Brust', isCustom: false, archived: false }],
  plans: [{ id: 1, name: 'Push', color: '#6366F1', sortOrder: 0 }],
  planExercises: [{ planId: 1, exerciseId: 1, sortOrder: 0 }],
  workouts: [{ id: 1, startedAt: '2026-07-05T09:00:00.000Z', finishedAt: null, planIds: [1] }],
  workoutExercises: [{ id: 1, workoutId: 1, exerciseId: 1, sortOrder: 0 }],
  workoutSets: [
    {
      id: 1,
      workoutId: 1,
      workoutExerciseId: 1,
      exerciseId: 1,
      setNumber: 1,
      weightKg: 80,
      reps: 8,
      done: true,
    },
  ],
};

describe('backup round-trip', () => {
  it('serializes and parses back to the same data with a version', () => {
    const json = serializeBackup(payload);
    const parsed = parseBackup(json);
    expect(parsed).toEqual({ version: BACKUP_VERSION, ...payload });
  });
});

describe('parseBackup validation', () => {
  it('rejects invalid JSON', () => {
    expect(() => parseBackup('{not json')).toThrow(/kein gültiges JSON/);
  });

  it('rejects an unsupported version', () => {
    const json = JSON.stringify({ ...payload, version: 99 });
    expect(() => parseBackup(json)).toThrow(/Version 99/);
  });

  it('rejects a missing table', () => {
    const broken = serializeBackup(payload).replace('"workoutSets"', '"somethingElse"');
    expect(() => parseBackup(broken)).toThrow(/workoutSets/);
  });
});
