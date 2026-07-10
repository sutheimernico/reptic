# Reptic — Implementation Plan

Durable tracker for the autonomous build loop. Each iteration reads this, does the single
highest-value open `- [ ]`, runs the gate (`typecheck` + `test` + `lint`), commits only on
green, ticks the box, appends one line to `AUTOPILOT_LOG.md`.

Design: `docs/superpowers/specs/2026-07-05-reptic-gym-app-design.md`.

## Phase 0 — Bootstrap ✅

- [x] Scaffold Expo SDK 57 app (expo-router, TS), branch `autopilot/work`
- [x] Test/lint/typecheck tooling (jest-expo, eslint-config-expo, tsc), `@/` alias in jest
- [x] Fix template CSS ambient types + web color-scheme lint (set-state-in-effect)
- [x] Pure domain core: types, format, sets (carry-over/last-time), plans (merge), backup
      (de)serialize, seed data — with unit tests (24 tests green)
- [x] Project docs (spec, PROJECT, PLAN, LOOP, log)

## Phase 1 — Data layer (SQLite) ✅

- [x] `src/db/schema.ts` — table DDL + `migrateDbIfNeeded` via `PRAGMA user_version`
- [x] `src/db/seed.ts` — insert `EXERCISE_LIBRARY` + `EXAMPLE_PLANS` on first migration only
- [x] `src/db/index.ts` — typed data layer: exercises/plans/plan_exercises/workouts/
      workout_exercises/workout_sets/settings CRUD + `getLastSetsForExercise` + backup export/import
- [x] Wire `SQLiteProvider` (databaseName + onInit=migrate) into the root layout
- [x] Import-verify the data layer (tsc); pure transforms covered by domain tests

## Phase 2 — Theme system ✅

- [x] Extend `constants/theme.ts` palette (dark `#0B0D14`/card `#151925`, indigo accent,
      border/textSecondary/success/danger/placeholder tokens) for light + dark + `Radius`
- [x] `src/theme/theme-provider.tsx` — resolve system scheme + persisted override
      (system/light/dark) stored in `settings`; expose `useThemeMode()`
- [x] Point `useTheme()` at the context (system fallback); wrap root layout, nav theme follows

## Phase 3 — Navigation shell ✅

- [x] Replace the sample tabs with 5 tabs: Heute / Pläne / Übungen / Verlauf / Einstellungen
      (classic `Tabs` from expo-router + `@expo/vector-icons`, themed tab bar)
- [x] Root `Stack` (headerShown off) hosts the `(tabs)` group; detail screens push over it
- [x] Themed placeholder screens for each tab + shared `Screen` scaffold component

## Phase 4 — Übungen (library) ✅

- [x] List grouped by muscle group, themed rows (Übungen tab)
- [x] Add / edit / delete custom exercises; auto-archive instead of delete when in history
- [x] Themed navigation theme so native detail-screen headers match the palette

## Phase 5 — Pläne ✅

- [x] List of plans (name + color)
- [x] Create/edit a plan: name, color, assign exercises, reorder

## Phase 6 — Heute (the core flow) ✅

- [x] Plan multi-select ("was machst du heute") → start session (merge via `mergePlanExercises`);
      also "leere Einheit" + resume of an active session
- [x] Session exercise list — editable per session (add via picker, remove via long-press);
      per-exercise set progress; no plan mutation
- [x] Exercise set screen — kg prefilled from last time (editable), reps empty, grey
      "↳ letztes Mal" line, `+ Satz`, remove set (long-press), done toggle
- [x] Persist sets live (on blur / toggle); "Übung fertig" flushes; "Einheit beenden" writes
      `finished_at`. (Manual reorder deferred — order = insertion order.)

## Phase 7 — Verlauf ✅

- [x] Past sessions list (date, plans, set-count summary) + read-only session detail
      (`workout/[id]`) with per-exercise `formatSetSummary` and delete
- [x] Per-exercise progression (`exercise/progress`, last 12 sessions, top-weight bars +
      per-session `formatSetSummary`); reachable from the exercise editor when history exists

## Phase 8 — Einstellungen ✅

- [x] Theme toggle UI (system / light / dark) — SegmentedControl on the Einstellungen tab
- [x] Export data → JSON file (SDK 57 `File`/`Paths` + `Sharing`), share sheet
- [x] Import data ← JSON file (`expo-document-picker`) with `parseBackup` validation + confirm
      (shows counts, replaces all data via `importAllData`)

## Phase 8b — Cloud backup (Google Drive, free / no backend)

- [ ] Optional Google Sign-In via `@react-native-google-signin/google-signin` (config plugin;
      dev/EAS build only, not Expo Go)
- [ ] Upload the `exportAllData` JSON to the user's Drive `appDataFolder`; restore on a new device
      (reuses `parseBackup` + `importAllData`) — no server, data stays in the user's own Drive
- [ ] Settings section: sign in / out, "Backup jetzt", "Wiederherstellen", last-backup timestamp

## Phase 9 — Polish ✅

- [x] Empty states (already across all list screens), themed status bar, `APP_NAME` +
      display name `Reptic`, dark splash background (`#0B0D14`). Icon *art* stays Needs Nico
      (adaptiveIcon uses a backgroundImage, so only new PNGs would change it).
- [x] Final full-gate pass (tsc + 28 jest + expo lint, `expo config` resolves) + spec Outcome section

## Phase 10 — Feedback round 1: gyms, user-owned library, calendar ✅

Nico's feedback after the first on-device test (2026-07-06). Spec:
`docs/superpowers/specs/2026-07-06-gyms-empty-library-calendar-design.md`,
plan: `docs/superpowers/plans/2026-07-07-gyms-empty-library-calendar.md`.

- [x] Remove all seed data (exercises + example plans); app starts empty
- [x] Final muscle groups: Brust, Rücken, Schultern, Beine, Bizeps, Trizeps, Bauch, Cardio
- [x] Schema v2: `gyms` table, `workouts.gym_id NOT NULL`, wipe of v1 test data
- [x] Mandatory gym pick at session start (last-used preselected, inline create)
- [x] Gym-aware weight suggestions: same gym first, any-gym fallback with source label
- [x] Gym management in Einstellungen (create, rename, archive/delete)
- [x] Gym shown in history list, workout detail, per-exercise progression
- [x] Calendar screen (custom Monday-first month grid, plan-color day markers)
- [x] Backup format v2 (gyms included; v1 backups rejected)

## Phase 11 — Gym-save bug (2026-07-07) ✅

Reported after the first live test of feedback round 1: one gym saved, then no further
gym/exercise persisted, no visible error. Root-cause analysis + fix:
`AUTOPILOT_LOG.md` 2026-07-07 and `docs/sessions/2026-07-07_1010_gym-save-bug.md`.

- [x] Atomic + idempotent migrations (BEGIN EXCLUSIVE, IF NOT EXISTS self-repair,
      orphaned-transaction guard, serialized onInit runs) — `96bf4cc`
- [x] Write errors surfaced via alert in gym/exercise/plan screens — `860ac48`
- [x] Migration test suite against real SQLite (node:sqlite), 7 scenarios

## Phase 12 — App icon, name, drag-and-drop, seed library (2026-07-07) ✅

Live-tested via Expo Go before each build (see `AUTOPILOT_LOG.md`).

- [x] Barbell app icon (design D) — adaptive/monochrome/splash/favicon
- [x] Renamed app to **Repz** (display name only)
- [x] Swipe-to-delete an exercise in a running session (actually deletes + reflows)
- [x] Drag-and-drop reorder everywhere (session + plan editor), 150ms hold, persisted
- [x] Button hit area forced full-width (Android new-arch fix)
- [x] 18 dictated exercises seeded on fresh install (fromVersion 0 only)
- [x] versionCode 4 APK build (EAS `3eee2904`)

## Phase 13 — Cardio set input (2026-07-08) ✅

Details: `AUTOPILOT_LOG.md` 2026-07-08. Schema v3 (additive, provably non-destructive).

- [x] Cardio exercises log km / Zeit (mm:ss) / Stufe instead of kg × Wdh
- [x] Same carry-over + reference line semantics as strength
- [x] History "performed" counts include cardio sets
- [x] versionCode 5 APK build (EAS `0981fd79`)

## Phase 14 — Review-driven hardening + polish (2026-07-10) ✅

Autonomous session (plan: `docs/superpowers/plans/2026-07-10-cardio-history-refactor-polish.md`);
two independent code reviews (screens + data layer), findings fixed, dead code removed.

- [x] Cardio shows up in history detail + per-exercise progression (was: "Keine Sätze
      eingetragen" / empty cards — the known gap from Phase 13)
- [x] Delete-vs-archive decision based on session membership (raw FK error before when
      an exercise was in a session but never opened)
- [x] Archived exercises listed + reactivatable (was a dead end, unlike gyms)
- [x] Every mutating flow surfaces write errors (start/finish/delete workout, add
      exercise, add/remove set); set screen uses the shared showSaveError again
- [x] Back-navigation from the set screen waits for the edit flush (race fixed)
- [x] Splash overlay shows the real barbell splash (was: Expo-blue template flash)
- [x] Singular/plural fixed everywhere ("1 Übung", not "1 Übungen"); "Trainingsbilder"
      → "Trainingspläne"
- [x] A11y pass: roles/states/labels on rows, inputs, chips, swatches, done-toggle
- [x] Dead code sweep (ordering.ts, domain addSet/removeSet, getFinishedWorkouts,
      template components/hooks/assets, unused ThemedText variants + theme tokens)
- [x] db: race-free sort_order inserts, backup export via mapper, import drops the
      remembered last-gym id

## Needs Nico

- [x] On-device verify of the gym-save fix (2026-07-07, Nico via Expo Go tunnel: gyms +
      exercises save and survive an app kill; failures would now surface as alerts)
- [x] APK/EAS build (2026-07-07: EAS project @nico_su2004/reptic linked, cloud keystore,
      preview APK built — build 575c3575; `production` profile ready for a future store release)
- [ ] Visual / feel sign-off on a real device
- [ ] Confirm product name `Reptic` (or rename via `constants/app.ts`)
- [ ] Create Google Cloud OAuth client(s) — Web + Android client ID with the signing SHA-1 —
      for the Drive backup sign-in; the login code can't go live without them
- [ ] Replace the Expo-template icon/splash art (foreground PNGs) with real Reptic art
