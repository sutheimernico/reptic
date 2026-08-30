# Plan: Daily Gym Companion — Repz v1.1

**Date:** 2026-07-21 · **Status:** awaiting go · **Executor:** any capable agent (self-contained — no session context required)

## Context (verified 2026-07-21 by code review)

Repz (repo: reptic) is Nico's private local-first gym tracker (Expo SDK 57 / RN / TS, Android, SQLite schema v3, versionCode 5, branch `autopilot/work`). The session flow is complete and polished (gym → plans → exercises with drag-reorder → set logging with "↳ letztes Mal" carry-over reference → finish), cardio is integrated end-to-end, archive semantics are correct, and the migration layer is exceptionally hardened (atomic BEGIN EXCLUSIVE, zombie-transaction cleanup, interrupt-recovery tests — legacy of the 2026-07-07 gym-save bug).

Gaps that matter (both reviews agree):
- **No automatic backup**: the only safety net is a manual JSON export via share sheet; device loss without a recent manual export = total data loss. Import/export code (`src/lib/backup.ts`, `src/domain/backup.ts`, `exportAllData`/`importAllData` in `src/db/index.ts`) is solid and versioned — it's the automation that's missing.
- **The query layer is untested**: `src/db/index.ts` (911 lines, 7 concerns in one file) has zero direct tests — only migrations run against real SQLite (`node:sqlite` adapter + `adapt()` helper in `src/db/__tests__/schema.test.ts`, directly reusable). 2,496 lines of screen code have no component tests either.
- **As a daily gym tool**: no rest timer, no PR recognition, no plate calculator, no haptic feedback, only top-weight bars as statistics. None of these were ever even logged as deferred wishes — they were never discussed.
- Minor: N+1 query in `getExerciseSessionHistory` (`src/db/index.ts:702-763`, capped at limit=12 today); `ScrollView`+`.map()` instead of virtualization in `history.tsx`/`exercises.tsx`/`plans.tsx`.

Hard constraints (do not violate):
- **Real user data lives on Nico's device.** Schema changes must be additive, versioned (v4), and covered by the same migration test harness (fresh install / v3→v4 / interrupt / no-op). Prefer no schema change where a settings key-value suffices.
- Zero silent data loss; every write error surfaces as an Alert (existing `src/lib/alerts.ts` pattern). Carry-over semantics stay honest (prefilled-but-untouched never counts as performed).
- Fully offline, no accounts, no network. German UI texts. Process rule: **Metro bundle check + full `npx expo export` verify — but NO build** (builds/versionCode bumps are Nico's step).
- New dependencies need justification; this plan authorizes exactly one: `expo-haptics` (Task 7).

## Goal

Close the data-safety hole, put the untested query layer under test, and add the four features that make the difference between "notes replacement" and "the app I'd never trade away in the gym": rest timer, PR detection, plate calculator, real progress trends.

## Execution rules

- Continue on `autopilot/work`. Conventional Commits, English. Gates after every task: `npx jest` green + `npx tsc --noEmit` + (for UI tasks) Metro bundle check; before finishing: full `npx expo export`.
- Pure logic goes in `src/domain/` with tests first; SQL stays in the db layer; screens stay thin.
- Settings storage: use the existing settings mechanism (key-value) — no schema bump for preferences.

---

## Phase A — Safety net + test foundation

### Task 1: Automatic rolling local backup
**Files:** new `src/lib/autoBackup.ts`, app-start hook (root layout), `src/app/(tabs)/settings.tsx`, tests for the pure parts.
- On app start (debounced: at most once per 24h): run `exportAllData`, write JSON to the app's document directory (`backups/repz-auto-YYYY-MM-DD.json`), prune to the newest 7. Failure → single non-blocking Alert (never crash startup).
- Settings shows "Letztes Auto-Backup: vor X Tagen" + a "Jetzt sichern"-button (reuses the same path) + the existing manual share-export unchanged. Restore path: document how to import an auto-backup file via the existing import (works with the share-sheet file picker today — verify).
- Honest limit, stated in the settings UI: auto-backups live on the same device — they protect against app-data corruption and accidental deletes, **not** device loss (that stays Phase 8b / manual export).
**Accept:** timestamp/prune/naming logic unit-tested; app start with backup failure still boots; settings shows real timestamps.

### Task 2: Query-layer integration tests
**Files:** new `src/db/__tests__/queries.test.ts` (reuse the `adapt()` node:sqlite helper from `schema.test.ts`).
Minimum coverage: `getFinishedWorkoutSummaries` counts/volumes against hand-built fixtures; `getLastSetsForExercise` gym-fallback logic (same gym preferred, fallback documented); `exportAllData` → `importAllData` round-trip equality (all 7 entity types incl. cardio fields); archive-membership helpers (`exerciseHasHistory`, `gymHasWorkouts`).
**Accept:** the load-bearing SQL can no longer regress silently; suite stays fast (<15s).

### Task 3: Split `src/db/index.ts` by domain
**Files:** `src/db/{exercises,gyms,plans,workouts,sets,settings,backup}.ts`, `src/db/index.ts` becomes re-exports.
Pure mechanical move mirroring `src/domain/` — no behavior change, no signature change. Do this **after** Task 2 so the tests pin behavior across the move.
**Accept:** all imports unchanged for callers; jest + tsc green; no file >300 lines.

### Task 4: Kill the N+1
**Files:** `src/db/workouts.ts` (post-split), tests.
Rewrite `getExerciseSessionHistory` as a single query (`IN (...)` + `GROUP BY`, pattern already used by `getSetProgressForWorkout`).
**Accept:** identical results on fixtures (pinned by test before rewrite); one query regardless of history length.

---

## Phase B — The gym features

### Task 5: Rest timer
**Files:** new `src/domain/restTimer.ts` (pure: target duration, remaining from timestamps), new banner component, wiring in `src/app/session/exercise.tsx` + `session/[id].tsx`, settings entry, tests.
- Marking a set done starts/restarts the timer; a slim persistent banner (visible in the whole session flow) shows countdown + "Weiter"-dismiss. Timestamp-based (survives navigation and app background — recompute remaining from wall clock; no background service, no notification in v1).
- Global default duration in settings (default 120s, 15s steps, off-switch). Optional end-signal: vibration via Task 7's haptics (no audio in v1 — keep scope).
**Accept:** domain logic fully unit-tested (start/restart/expiry/disabled); banner testable via component test (Task 10 harness); backgrounding 2 min → reopen shows expired state, not a frozen countdown.

### Task 6: PR detection
**Files:** new `src/domain/personalRecords.ts`, wiring where sets are saved, small badge/toast UI, tests.
Two honest PR types on set completion, computed against **prior** history only (never the current session's own earlier sets... actually: against all sets logged before this set, including earlier today — decide: yes, include today's earlier sets; a PR is a PR):
- Weight-PR: heaviest weight ever for that exercise (reps ≥ 1).
- e1RM-PR: Epley estimate `weight × (1 + reps/30)` beats the previous best e1RM (guard: reps ≤ 12, else skip — Epley degrades; document this in a comment).
Cardio: distance-PR and pace-PR (distance/time) analogously, only when both fields present.
UI: subtle inline badge on the set row ("PR 🏆" + which type on tap) + one toast per exercise per session (no spam). No schema change — computed from existing data.
**Accept:** domain tests incl. edge cases (first-ever set = no PR fanfare on literally every set of a new exercise — suppress PR badges when the exercise has <3 prior sessions; tie ≠ PR; untouched carry-over never triggers); performance: one query per exercise entry, not per set.

### Task 7: Haptic feedback (the one new dependency)
**Files:** `package.json` (`expo-haptics`), `toggleDone` in the set row, rest-timer expiry, PR toast.
Light impact on set-done, success notification on PR, double pulse on timer end. All behind one settings switch ("Vibration", default on).
**Accept:** Metro bundle + expo export green with the new dep; every haptic call behind the setting; no haptics on error paths (Alerts stay silent).

### Task 8: Plate calculator
**Files:** new `src/domain/plates.ts`, long-press on the kg input opens a small sheet, settings for bar weight + available plates, tests.
Greedy per-side decomposition (default bar 20kg, plates 25/20/15/10/5/2.5/1.25 ×2 each — configurable as a settings JSON). Shows per-side plate list ("pro Seite: 20 + 5 + 1,25") or honest "nicht exakt stellbar — nächste: 61,25/62,5" when the target isn't reachable.
**Accept:** decomposition unit-tested incl. unreachable targets and custom plate sets; sheet is display-only (never mutates the input).

### Task 9: Weekly volume trends
**Files:** SQL aggregation in the db layer, new section in the progress/history area, `src/domain/` for the bucketing, tests.
Per-week total volume (Σ weight×reps) overall and per muscle group, last 12 weeks, rendered in the existing bar style (no chart library). Cardio: weekly distance. Honest gaps: weeks without training render as zero, not interpolated.
**Accept:** bucketing (ISO weeks, local timezone) unit-tested; single aggregate query; screen renders empty state for new users.

---

## Phase C — UI robustness

### Task 10: Component-test harness + mutating-flow tests
**Files:** `package.json` dev-deps (`@testing-library/react-native` — dev-only, compatible with the existing `jest-expo` preset), tests for: set input + toggleDone (incl. PR badge), archive/delete flows in `exercises.tsx`, rest-timer banner states.
**Accept:** the highest-risk mutating screens have regression coverage; suite <30s.

### Task 11: Virtualize the growing lists
**Files:** `src/app/(tabs)/history.tsx`, `exercises.tsx`, `plans.tsx`.
Replace `ScrollView`+`.map()` with `FlatList` (sticky section headers where currently grouped). No visual change.
**Accept:** component tests from Task 10 still green; scroll behavior verified in Metro/Expo Go by Nico (listed in his smoke items).

### Explicitly deferred (decided — do not build here)
- **Inline/accordion set logging without screen change**: high-risk refactor of the freshly hardened flush/beforeRemove logic in `session/[id].tsx` + `session/exercise.tsx`; revisit only after Nico confirms the current per-exercise flow actually bothers him in practice.
- **Widget/Shortcut, audio timer signals, Drive-OAuth (8b)**: unchanged deferrals.

## Verification before completion
1. `npx jest` (all suites incl. new query/component tests), `npx tsc --noEmit`, Metro bundle check, full `npx expo export` — all green. **No build, no versionCode bump.**
2. Migration harness re-run (schema untouched → must be a no-op; if any task forced a v4, full harness green incl. v3→v4 + interrupt).
3. Append an **Outcome** section here: built/deviations, new dep list (expected: expo-haptics + @testing-library/react-native dev-only), Nico smoke-test checklist (timer feel, haptics strength, plate sheet, PR badge sanity, list scroll).
4. Update PLAN.md phase tracker + README feature list.

## Needs Nico (not agent-executable)
- Go for this plan. Device smoke test of the 2026-07-10 hardening **plus** this plan's features (checklist comes from the outcome section) — then build versionCode 6.
- Feel-Veto: timer default (120s?), haptic strength, plate defaults (his gym's plates).
- Unchanged from before: „Trainingspläne"-wording veto, icon/splash art, Repz-vs-Reptic name, Play Store ($25), Drive-OAuth (8b), merge → master.
