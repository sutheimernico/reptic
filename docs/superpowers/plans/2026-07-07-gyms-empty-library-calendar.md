# Gyms, Empty Library & Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wipe seed data, let Nico own exercises/plans, make every session gym-aware (mandatory gym pick, gym-dependent weight suggestions), and add a calendar history screen.

**Architecture:** DB migration v2 adds a `gyms` table and rebuilds the `workouts` family with `gym_id NOT NULL`. Carry-over query becomes two-stage (same gym → any gym with source label). Calendar is a pure-domain month grid + one range query. All following existing layering: `src/domain` pure+tested, `src/db` thin SQL, screens thin.

**Tech Stack:** Expo SDK 57, expo-sqlite, expo-router, Jest (domain only). Gate: `npm run typecheck && npm test && npm run lint`.

**Spec:** `docs/superpowers/specs/2026-07-06-gyms-empty-library-calendar-design.md`

---

### Task 1: Remove seed data entirely

**Files:**
- Modify: `src/db/schema.ts` (drop `seedDatabase` import + call in the v0 branch)
- Delete: `src/domain/seed.ts`, `src/db/seed.ts`, `src/domain/__tests__/seed.test.ts`

- [x] Remove `import { seedDatabase } …` and the `await seedDatabase(db);` line from `schema.ts`; delete the three seed files
- [x] Run gate → green
- [x] Commit: `feat(db): remove seed data — fresh installs start empty`

### Task 2: New muscle groups

**Files:**
- Modify: `src/domain/types.ts:7-16`

- [x] Replace `MUSCLE_GROUPS` with `['Brust', 'Rücken', 'Schultern', 'Beine', 'Bizeps', 'Trizeps', 'Bauch', 'Cardio']`; add

```ts
export interface Gym {
  id: number;
  name: string;
  archived: boolean;
}
```

- [x] Grep for old literals (`Trapez/Nacken`, `'Core'`) outside deleted seeds; fix any hit
- [x] Gate → green; commit: `feat(domain): final muscle groups (Bauch, Cardio) and Gym type`

### Task 3: Schema v2 + gym CRUD + mandatory gym at session start

**Files:**
- Modify: `src/db/schema.ts` (v2 migration), `src/db/index.ts` (Workout type mapping, gym CRUD, `startWorkout`), `src/domain/types.ts` (`Workout.gymId`), `src/app/(tabs)/index.tsx`
- Create: `src/app/gym/select.tsx`

- [x] `schema.ts`: `DATABASE_VERSION = 2`; append migration block (v0 path runs V1_SCHEMA then this block — DELETEs on empty tables are harmless):

```sql
CREATE TABLE gyms (
  id INTEGER PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0
);
DELETE FROM plan_exercises;
DELETE FROM plans;
DELETE FROM exercises;
DROP TABLE workout_sets;
DROP TABLE workout_exercises;
DROP TABLE workouts;
CREATE TABLE workouts (
  id INTEGER PRIMARY KEY NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  plan_ids TEXT NOT NULL DEFAULT '[]',
  gym_id INTEGER NOT NULL REFERENCES gyms (id)
);
-- workout_exercises + workout_sets + both indexes recreated identical to V1
```

- [x] `types.ts`: add `gymId: number` to `Workout`
- [x] `db/index.ts`: `GymRow`+`mapGym`; `getGyms({includeArchived})`, `getGym`, `createGym(name)`, `updateGym(id, name)`, `setGymArchived`, `gymHasWorkouts` (COUNT on workouts), `deleteGym`; `export const LAST_GYM_SETTING = 'last_gym_id'`; `mapWorkout` reads `gym_id`; `startWorkout(db, planIds, gymId, startedAt)` inserts `gym_id` and upserts `LAST_GYM_SETTING`
- [x] `(tabs)/index.tsx`: top card "Wo trainierst du heute?" — reads `LAST_GYM_SETTING` on focus, resolves via `getGym` (archived/missing → treat as none), shows gym name or "Gym wählen"; tap → `/gym/select`. Start buttons disabled without a resolved gym; pass `gym.id` to `startWorkout`
- [x] `gym/select.tsx`: list of non-archived gyms (checkmark on current), tap = `setSetting(LAST_GYM_SETTING, id)` + `router.back()`; inline "+ Neues Gym" TextField+Button → `createGym`, select it, back. Empty state prompts creation directly
- [x] Gate → green; commit: `feat: gym-aware sessions — schema v2, gym CRUD, mandatory gym at start`

### Task 4: Gym-aware weight suggestions

**Files:**
- Modify: `src/db/index.ts:518-543` (`getLastSetsForExercise`), `src/domain/sets.ts`, `src/app/session/exercise.tsx`, `src/app/session/[id].tsx`
- Test: `src/domain/__tests__/sets.test.ts`

- [x] TDD in `sets.test.ts`:

```ts
describe('referenceLabel', () => {
  it('is plain when the prior sets are from the same gym', () => {
    expect(referenceLabel(null)).toBe('↳ letztes Mal');
  });
  it('names the source gym on fallback', () => {
    expect(referenceLabel('McFit Köln')).toBe('↳ letztes Mal im McFit Köln');
  });
});
```

- [x] `sets.ts`: `export function referenceLabel(sourceGymName: string | null): string`
- [x] `db/index.ts`: `getLastSetsForExercise(db, exerciseId, gymId, excludeWorkoutId?)` returns `{ sets: PriorSet[]; sourceGymName: string | null }` — stage 1 picks latest finished workout containing the exercise with `w.gym_id = ?`; if none, stage 2 without the filter and `sourceGymName` = that workout's gym name; then load its sets as before
- [x] `session/exercise.tsx`: pass the session's `gymId`, render `referenceLabel(sourceGymName)` in the grey line (both initial render and `addSet` path)
- [x] `session/[id].tsx`: show gym name in the header (load via `getGym(workout.gymId)`)
- [x] Gate → green; commit: `feat(session): gym-aware weight suggestions with source label`

### Task 5: Manage gyms in Einstellungen

**Files:**
- Create: `src/app/gym/edit.tsx` (mirror `src/app/exercise/edit.tsx` patterns: create/rename; delete when `gymHasWorkouts` is false, otherwise archive with Alert)
- Modify: `src/app/(tabs)/settings.tsx` ("Gyms" section: rows → `/gym/edit?id=`, "+ Neues Gym" → `/gym/edit`)

- [x] Build both; reuse `ListRow`/`TextField`/`Button` primitives
- [x] Gate → green; commit: `feat(settings): manage gyms (create, rename, archive)`

### Task 6: Show gym in history & progression

**Files:**
- Modify: `src/db/index.ts` (`WorkoutSummary` + `gymName` via `(SELECT name FROM gyms WHERE id = w.gym_id)`; same for `getExerciseSessionHistory` entries), `src/app/(tabs)/history.tsx`, `src/app/workout/[id].tsx`, `src/app/exercise/progress.tsx`

- [x] Add `gym_name` to both queries; surface as `gymName: string`
- [x] Render gym name in history rows, workout detail header, and per-session entries on the progression screen
- [x] Gate → green; commit: `feat(history): show gym on sessions and progression`

### Task 7: Calendar screen

**Files:**
- Create: `src/domain/calendar.ts`, `src/domain/__tests__/calendar.test.ts`, `src/app/history/calendar.tsx`
- Modify: `src/db/index.ts` (range query), `src/app/(tabs)/history.tsx` (header calendar icon → `/history/calendar`)

- [x] TDD `calendar.ts` (pure):

```ts
export interface MonthCell { day: number | null; key: string } // null = leading/trailing blank
export function buildMonthGrid(year: number, month0: number): MonthCell[][] // weeks, Monday-first
export function monthTitle(year: number, month0: number): string // reuse MONTHS_DE from format.ts
export function shiftMonth(year: number, month0: number, delta: -1 | 1): { year: number; month0: number }
export function localDayOf(iso: string): number // day-of-month in device timezone
```

Tests: Feb 2024 (leap, 29 days), months starting Monday (2026-06) and Sunday (2026-11 → 6 leading blanks), year wrap in `shiftMonth` (Jan−1 → Dec prior year)

- [x] `db/index.ts`: `getFinishedWorkoutsBetween(db, fromIso, toIso): Promise<Workout[]>` (`finished_at >= ? AND finished_at < ?`)
- [x] `history/calendar.tsx`: month state (init: today), ‹/› paging, grid via `buildMonthGrid`; markers = plan color dots per workout that day (`getPlans` for colors, neutral dot when `planIds` empty); tap day → session list below grid (reuse history row layout) → `/workout/[id]`
- [x] Gate → green; commit: `feat(history): calendar view of past sessions`

### Task 8: Backup format v2

**Files:**
- Modify: `src/domain/backup.ts` (BACKUP_VERSION 2, `gyms: Gym[]` in BackupData + REQUIRED_ARRAYS), `src/db/index.ts` (`exportAllData` reads gyms; `importAllData` deletes+inserts gyms first, workouts with `gym_id`)
- Test: `src/domain/__tests__/backup.test.ts`

- [x] TDD: round-trip with gyms + a v1 payload → throws `Backup-Version 1 wird nicht unterstützt (erwartet 2).` (existing version check handles it — test pins the behavior)
- [x] Gate → green; commit: `feat(backup): v2 format with gyms`

### Task 9: Docs & wrap-up

**Files:**
- Modify: `PLAN.md` (add "Phase 10 — Feedback round 1 (gyms, empty library, calendar)" with ticked boxes), `AUTOPILOT_LOG.md` (one entry), spec (Outcome section)

- [x] Full gate one last time; commit: `docs: record feedback round 1 outcome`

## Self-review notes

- Spec coverage: wipe+no-seed (T1), muscle groups (T2), mandatory gym + picker + last-used (T3), fallback suggestions with label (T4), gym management (T5), gym in history/progression (T6), calendar screen (T7), backup v2 (T8). Per-exercise progression itself already exists — T6 only adds gym context. ✔
- Task 3 is the largest but cannot be split with a green gate in between (`startWorkout` signature change ripples into the Heute screen).
- Types used across tasks: `Gym`, `Workout.gymId`, `PriorSetsResult`-shape return of `getLastSetsForExercise`, `LAST_GYM_SETTING` — defined in T2/T3/T4 before use. ✔

## Outcome (2026-07-07)

All 9 tasks done in one autonomous overnight run; gate green throughout
(final: tsc + 43 jest + expo lint; Android bundle compiles via Metro).

Deviations from the plan:
- The migration SQL in Task 3 as planned was WRONG: `DELETE FROM exercises`
  before dropping the workout tables violates live FK constraints
  (foreign_keys=ON) and would crash-loop any device with v1 workout data.
  Caught by the post-implementation review; fixed (children dropped first,
  IF EXISTS/IF NOT EXISTS retry guards) and verified against real sqlite3.
- `getFinishedWorkoutsBetween` became an optional `range` parameter on
  `getFinishedWorkoutSummaries` — the calendar's day list needs the summary
  fields anyway, so a separate function would have duplicated the query.
- Calendar day cells without sessions are disabled (a11y: not announced as
  actionable); day tap shows the day's sessions below the grid as planned.

Open (pre-existing, out of scope): `ListRow` lacks `accessibilityRole="button"`;
gym/select empty-state copy ignores archived-only edge case.
