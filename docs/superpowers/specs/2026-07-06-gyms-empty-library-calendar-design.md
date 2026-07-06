# Design: Gyms, user-owned library, calendar history (feedback round 1)

Date: 2026-07-06
Status: approved (approaches and behavior confirmed by Nico in session; "ja dann mach")

## Background

First on-device test of Reptic (Expo Go, SDK 57). Nico's feedback:

1. Remove all seeded example plans — he creates plans himself.
2. He adds exercises himself, grouped by muscle group. Fixed groups:
   **Brust, Rücken, Schultern, Beine, Bizeps, Trizeps, Bauch, Cardio**
   (drop `Trapez/Nacken`, rename `Core` → `Bauch`, add `Cardio`).
3. Per-exercise progression view (exists; keep, add gym context).
4. New session user story: first question is "Wo trainierst du heute?" —
   he trains in multiple gyms (Hansefit), and suggested weights depend on
   the gym because machines differ.
5. Calendar view of workout history.

Decisions made with Nico:

- Suggested weights: prefer same gym, else fall back to any gym **with a
  visible source label** ("↳ letztes Mal im <Gym>").
- Device data: full wipe via migration — plans, seeded exercises, and test
  sessions all deleted; app starts empty. Seed code is removed entirely.
- Gym selection at session start is **mandatory**; last-used gym is
  preselected; new gyms can be created inline; management (rename/archive)
  lives in Einstellungen.
- Calendar is a **separate screen**, opened via an icon from the Verlauf tab
  (not a toggle, not embedded above the list).
- Custom-built month grid (pure domain logic), no calendar library.
- Cardio exercises are tracked like strength exercises in this round
  (sets with optional weight/reps). Duration/distance tracking is a later,
  separate feature.

## Data model & migration (DB v2)

New table:

```sql
CREATE TABLE gyms (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0
);
```

`workouts` (+ its children `workout_exercises`, `workout_sets`) are dropped
and recreated — all history is test data and is wiped anyway — so `workouts`
gains a hard `gym_id TEXT NOT NULL REFERENCES gyms(id)` column without an
ALTER-TABLE workaround.

Migration v2 (`migrateDbIfNeeded`, `PRAGMA user_version` 1 → 2):

1. `CREATE TABLE gyms …`
2. `DELETE FROM plan_exercises; DELETE FROM plans; DELETE FROM exercises;`
3. `DROP TABLE workout_sets; DROP TABLE workout_exercises; DROP TABLE workouts;`
   then recreate all three (workouts now with `gym_id NOT NULL`), recreate
   the two indexes.
4. Bump `DATABASE_VERSION` to 2. The v0 (fresh install) path creates the v2
   schema directly and **no longer seeds** — `src/domain/seed.ts`,
   `src/db/seed.ts`, and `seed.test.ts` are deleted.

`MUSCLE_GROUPS` in `src/domain/types.ts` becomes
`['Brust', 'Rücken', 'Schultern', 'Beine', 'Bizeps', 'Trizeps', 'Bauch', 'Cardio']`.
No data mapping needed (exercises are wiped).

Backup format: bump backup version to 2; export/import include `gyms` and
`workouts.gym_id`. Importing a v1 backup is rejected with a clear German
error message (no v1 backups worth preserving exist).

## Gyms & session start (Heute tab)

- A "Wo trainierst du heute?" card sits at the top of the Heute tab showing
  the selected gym; the last-used gym (settings key `last_gym_id`) is
  preselected. Tapping opens a gym picker (list + "+ Neues Gym" inline
  create). With no gyms yet, the card prompts creation directly.
- Start buttons stay disabled until a gym is selected.
- `startWorkout(db, planIds, gymId, now)` stores `gym_id` and updates
  `last_gym_id`.
- Einstellungen gains a "Gyms" section: list, create, rename, archive/delete
  following the exercises pattern (delete only when no workout references
  the gym, otherwise archive; archived gyms are hidden from the picker).

## Weight suggestions (carry-over)

`getLastSetsForExercise(db, exerciseId, gymId, excludeWorkoutId?)` becomes
two-stage: latest finished workout containing the exercise **in the same
gym**; if none, latest in any gym. The result carries a `sourceGymName`
(null when same gym). `src/domain/sets.ts` reference lines become
"↳ letztes Mal" (same gym) or "↳ letztes Mal im <Gym>" (fallback) — pure,
tested. The session screen shows the session's gym in the header.

## History & calendar

- Verlauf list rows and the workout detail screen show the gym name
  (join on `gyms` in the summary queries).
- Per-exercise progression (`/exercise/progress`) shows a gym label per
  session entry.
- New screen `/history/calendar`, opened via a calendar icon in the Verlauf
  header: month grid, weeks start Monday, ‹/› month paging, training days
  marked with the sessions' plan color dots (a neutral dot for sessions
  started without a plan). Tapping a day lists that day's
  session(s) below the grid; tapping a session opens the existing workout
  detail. Month-grid computation lives in `src/domain/calendar.ts`
  (`buildMonthGrid(year, month, markers)`), pure and tested; the DB layer
  adds a per-month summary query.

## Testing

Jest domain tests as per repo convention (pure functions only): calendar
grid (month boundaries, Monday start, leap years), gym-aware reference
lines, backup v2 round-trip + v1 rejection. `seed.test.ts` is removed with
the seeds. DB layer and screens remain untested (existing convention).

## Out of scope (deliberate)

- Cardio duration/distance tracking
- Google Drive backup (Phase 8b, needs OAuth client)
- App icon / splash artwork
