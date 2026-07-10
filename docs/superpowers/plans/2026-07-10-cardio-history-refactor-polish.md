# 2026-07-10 — Cardio history gap, review-driven refactor, polish

Nico's brief (away for ~2h, full autonomy granted, loop until done): "fix das teilweise,
mach das schöner, refactor den ganzen Shit" — work the app to a properly finished state.
Go for all gates granted in advance; work lands as small atomic commits on `autopilot/work`.

## Workstream A — Cardio gap in history detail + progression (the known gap)

Told to Nico on 2026-07-08 as a known gap; confirmed by reading the code:

- `getExerciseSessionHistory` (src/db/index.ts): outer workout selection is cardio-aware,
  but the inner per-workout set query filters `reps IS NOT NULL` and selects only
  `set_number, weight_kg, reps` → cardio entries come back with zero sets.
- `formatSetSummary` (src/domain/format.ts) drops sets without weight+reps → the workout
  detail shows "Keine Sätze eingetragen" for cardio exercises that were performed.
- `exercise/progress.tsx` scales bars by `topSetWeight` and labels "X kg" → cardio shows
  bare date cards with no bar, no value.

Fix (performed-rule stays the shipped one: `reps OR duration_sec OR distance_km` non-null,
consistent with `getFinishedWorkoutSummaries`):

1. domain: `formatCardioSetSummary(sets)` (join per-set `formatCardioReference`) and
   `topCardioMetrics(sets)` (max distance + max duration among sets) — TDD in
   src/domain/__tests__/format.test.ts and sets.test.ts.
2. db: inner query in `getExerciseSessionHistory` selects the cardio columns and uses the
   performed-rule; `ExerciseSessionEntry.sets` gains distanceKm/durationSec/level.
3. workout/[id].tsx: branch summary by `exercise.muscleGroup === 'Cardio'`.
4. exercise/progress.tsx: load the exercise; for cardio scale bars by top distance
   (fallback: duration), label "X km" / "m:ss", summary via `formatCardioSetSummary`.

## Workstream B — Review findings (screens + data layer)

Two sonnet review agents sweep (1) src/app + src/components + theme/hooks and
(2) src/db + src/domain + src/lib. Triage: fix real bugs and inconsistencies, drop dead
code (ordering.ts `moveBy` suspected unused since drag-and-drop), no speculative rewrites,
no new features. Findings and their resolution recorded in the Outcome section.

## Workstream C — Docs refresh

PROJECT.md drift: "library pre-seeded" (changed twice since), name Reptic vs Repz display
name, sets described as kg×reps only (cardio exists). Update PROJECT.md; PLAN.md gets a
phase entry; AUTOPILOT_LOG.md gets the session entry.

## Workstream D — Verification

Full gate (`npm run typecheck` + `npm test` + `npm run lint`) after every commit-sized
step; final Metro Android bundle check (HTTP 200 on the .bundle URL) per the established
process. NO EAS build — builds only after Nico's live Expo-Go sign-off (process rule from
feedback round 3). On-device verify stays Needs Nico.

## Out of scope

Phase 8b Drive backup (blocked on OAuth clients), Play Store, merge to master (Nico
reviews), icon art replacement, new features.
