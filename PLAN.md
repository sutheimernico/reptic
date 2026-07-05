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

## Phase 4 — Übungen (library)

- [ ] List grouped by muscle group, themed rows
- [ ] Add / edit / delete custom exercises (archived flag for ones used in history)

## Phase 5 — Pläne

- [ ] List of plans (name + color)
- [ ] Create/edit a plan: name, color, assign exercises, reorder

## Phase 6 — Heute (the core flow)

- [ ] Plan multi-select ("was machst du heute") → start session (merge via `mergePlanExercises`)
- [ ] Session exercise list — editable per session (add/remove/reorder, no plan mutation)
- [ ] Exercise set screen — the core interaction: kg prefilled from last time (editable),
      reps empty, grey "↳ letztes Mal" line, `+ Satz`, remove set, done toggle
- [ ] Persist sets live; "Übung fertig" / "Einheit beenden" writes `finished_at`

## Phase 7 — Verlauf

- [ ] Past sessions list (date, plans, volume summary via `formatSetSummary`)
- [ ] Per-exercise progression (last N sessions, simple list/sparkline)

## Phase 8 — Einstellungen

- [ ] Theme toggle UI (system / light / dark)
- [ ] Export data → JSON file (expo-file-system + sharing)
- [ ] Import data ← JSON file (document picker) with `parseBackup` validation + confirm

## Phase 9 — Polish

- [ ] Empty states, app name/branding constant, adaptive icon + splash color
- [ ] Final full-gate pass; update spec Outcome section

## Needs Nico

- [ ] On-device run + APK/EAS build (no Java/Android SDK in the build env)
- [ ] Visual / feel sign-off on a real device
- [ ] Confirm product name `Reptic` (or rename via `constants/app.ts`)
- [ ] Optional: replace example Push/Pull/Beine plans with Nico's real 3 splits
