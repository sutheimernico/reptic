# Reptic — Design (Spec)

**Date:** 2026-07-05
**Status:** Approved by Nico (blanket go, autonomous build)
**Author:** Autonomous build session

> Working product name **Reptic** (rep + the ✓ tick of a completed set). Held in a single
> config constant (`constants/app.ts`) so it is trivially renameable.

## 1. Purpose

A private, self-tailored gym tracking app for Nico, replacing the ad-hoc Notes-app workflow.
Installable Android app, fully offline, local-first. The core value over Notes: every session
is stored, and while training you always see what you did **last time** per set, so you know the
target to beat.

Single user. No accounts, no server, no network dependency for core use.

## 2. Scope

### In (MVP)
- Define **plans** ("Trainingsbilder") — named, colored groups of exercises.
- Start a **session** by selecting one or more plans (multi-select). Selected plans merge into
  one exercise list for the session.
- Per-session the exercise list is **fully editable**: reorder, add, remove, swap exercises —
  without changing the saved plan.
- Per exercise, track **sets**: `kg` field pre-filled with last time's weight (editable),
  `reps` field always empty (typed fresh). A grey reference line under each set shows
  "↳ letztes Mal: 80 kg × 8". `+ Satz` adds a set; the first set exists initially and is
  deletable. A check marks a set done.
- **Exercise library**, pre-seeded with standard exercises grouped by muscle group; user can
  add/edit/delete custom exercises.
- **History**: every completed session is stored and browsable. Per exercise, a simple
  progression view (last N sessions).
- **Dark / Light** theme: follows system on first launch, manual toggle persisted.
- **Export / Import**: dump/restore all data as a JSON file (backup net, since iOS-style
  eviction risk is real on any local-first mobile store).

### Out (later, only if a real need appears — YAGNI)
- Progression charts beyond a simple list/sparkline.
- Rest timer, RPE, per-set notes.
- Cloud sync across devices; accounts.
- Cardio/time-based or bodyweight-only exercise types beyond weight×reps.

### Needs Nico (cannot be done in this environment)
- Local APK build & on-device run (no Java/Android SDK here) — or a free Expo EAS cloud build,
  which needs Nico's Expo login.
- Visual / feel sign-off on a real device.

## 3. Tech stack

- **Expo (managed) + React Native + TypeScript** — one codebase, Android target, Nico's React/TS
  growth area.
- **expo-router** — file-based routing (bottom tabs + nested stack).
- **expo-sqlite** (async API) — local relational store; fits "voller Verlauf" and Nico's SQL
  strength. Schema migrations via `PRAGMA user_version`.
- **Theme system** — own color-token module (dark/light) + a React context that reads the system
  scheme and allows a persisted manual override. No UI kit.
- **No state library / no styling framework for MVP.** React built-ins + SQLite as the source of
  truth. Add Zustand/NativeWind only if a concrete need appears.
- **Testing/gates:** `jest-expo` for pure-logic unit tests, `tsc --noEmit` typecheck, `expo lint`.

Rationale for dependencies (per "no new deps without justification"): expo-router, expo-sqlite,
jest-expo are all first-party Expo packages and part of the standard managed workflow — not extra
third-party surface.

## 4. Data model (SQLite)

```
exercises(
  id INTEGER PK, name TEXT NOT NULL, muscle_group TEXT NOT NULL,
  is_custom INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0
)

plans(
  id INTEGER PK, name TEXT NOT NULL, color TEXT NOT NULL, sort_order INTEGER NOT NULL
)

plan_exercises(              -- default exercises of a plan
  plan_id INTEGER, exercise_id INTEGER, sort_order INTEGER,
  PRIMARY KEY (plan_id, exercise_id)
)

workouts(                    -- one session
  id INTEGER PK, started_at TEXT NOT NULL, finished_at TEXT,
  plan_ids TEXT NOT NULL     -- JSON array of plan ids chosen for the session
)

workout_exercises(           -- exercises actually in this session (editable per session)
  id INTEGER PK, workout_id INTEGER, exercise_id INTEGER, sort_order INTEGER
)

workout_sets(                -- every logged set
  id INTEGER PK, workout_id INTEGER, workout_exercise_id INTEGER, exercise_id INTEGER,
  set_number INTEGER NOT NULL, weight_kg REAL, reps INTEGER,
  done INTEGER NOT NULL DEFAULT 0
)

settings(key TEXT PK, value TEXT)   -- e.g. theme override
```

**"Last time" resolution** is a pure query: for a given `exercise_id`, take the most recent
*finished* workout that contains it, and read its sets ordered by `set_number`. Per set number,
the prior `weight_kg` becomes the pre-fill for the kg field, and prior `weight_kg × reps` renders
the grey reference line. No extra tables needed.

## 5. App structure (bottom tabs)

- **Heute (Today)** — plan multi-select → active session → exercise screen with sets.
- **Pläne (Plans)** — create/edit plans; assign & reorder exercises.
- **Übungen (Exercises)** — the library; add/edit/delete custom exercises.
- **Verlauf (History)** — past sessions; per-exercise progression view.
- **Einstellungen (Settings)** — theme toggle, export/import.

Detail screens (active session, exercise-set editor, plan editor) are pushed on a stack above the
tabs.

## 6. Core interaction: set tracking

For each exercise in the active session, a list of set rows:
- kg field pre-filled with last time's weight for that set number (editable),
- reps field empty,
- grey line beneath: "↳ letztes Mal: {kg} kg × {reps}" (omitted if no history),
- a done toggle.
`+ Satz` appends a set (kg pre-filled from the previous set / last history, reps empty). The first
set is present initially and removable (swipe / long-press). "Übung fertig" marks the exercise
complete and returns to the session list.

Visual: dark by default (deep blue-black `#0B0D14`, indigo→violet accent), light mode is the same
layout on `#F4F5F7` with an indigo accent. One design, two modes, one accent family.

## 7. Seed data

### Exercise library (grouped by muscle_group), all editable/deletable
- **Brust:** Bankdrücken, Schrägbankdrücken, Kurzhantel-Bankdrücken, Butterfly, Dips
- **Rücken:** Latzug, Klimmzüge, Langhantelrudern, Kabelrudern, Kreuzheben
- **Schultern:** Schulterdrücken, Seitheben, Vorgebeugtes Seitheben, Frontheben
- **Trapez/Nacken:** Shrugs, Aufrechtes Rudern, Face Pulls
- **Beine:** Kniebeugen, Beinpresse, Beinstrecker, Beinbeuger, Wadenheben, Rumänisches Kreuzheben
- **Bizeps:** Langhantel-Curls, Kurzhantel-Curls, Hammer-Curls
- **Trizeps:** Trizepsdrücken (Kabel), Enges Bankdrücken, French Press
- **Core:** Crunches, Beinheben, Plank

### Example plans (editable) — Push / Pull / Beine
- **Push:** Bankdrücken, Schrägbankdrücken, Schulterdrücken, Seitheben, Trizepsdrücken (Kabel)
- **Pull:** Latzug, Langhantelrudern, Kabelrudern, Shrugs, Langhantel-Curls
- **Beine:** Kniebeugen, Beinpresse, Beinbeuger, Beinstrecker, Wadenheben

## 8. Testing & gate

Pure-logic modules (no native deps) carry the tests:
- "last time" resolver (map history → per-set prefill + reference line),
- set carry-over logic (new set inherits weight, empty reps),
- plan-merge for multi-select sessions (dedupe, keep order),
- export/import serialization round-trip,
- theme token selection.

**Gate (must be green before every commit):** `tsc --noEmit` + `jest` + `expo lint`.
Native adapters (expo-sqlite calls, screens) are kept thin and import-verified; on-device run is
Needs Nico.

## 9. Architecture for isolation

- `db/` — schema + migrations + a thin typed data layer (async functions returning plain objects).
- `domain/` — PURE functions (no imports of expo-sqlite/react): last-time resolver, carry-over,
  plan merge, export/import (de)serialize. This is the fully unit-tested core.
- `theme/` — tokens + context.
- `app/` — expo-router screens; screens call `db/` and render `domain/` results. Thin.
- `constants/app.ts` — product name and other trivially-changeable constants.

Rule: `domain/` must never import from `db/`, `app/`, or any native module — that keeps the core
testable in plain Node/Jest and the boundaries clean.

## 10. Outcome (2026-07-06)

Built end-to-end on `autopilot/work`; gate green at every commit (`tsc` + `jest` + `expo lint`,
28 domain tests). Implemented:

- **Phases 0–6** — bootstrap, SQLite data layer + migrations + seed, theme system (dark/light +
  persisted override), 5-tab nav shell, Übungen library (add/edit/archive), Pläne editor, and the
  core Heute flow (plan multi-select → session → per-set screen with last-time carry-over).
- **Phase 7 Verlauf** — past-sessions list (`formatSessionDate`, plan color dots, set counts),
  read-only `workout/[id]` detail (per-exercise `formatSetSummary`, delete), and `exercise/progress`
  (last 12 sessions, top-weight bars) reachable from the exercise editor.
- **Phase 8 Einstellungen** — theme toggle; JSON backup **export** (SDK 57 `File`/`Paths` + share
  sheet) and **import** (`expo-document-picker` → `parseBackup` validation → confirm-with-counts →
  replace-all). This is the working, backend-free "back up & restore on a new device" path.
- **Phase 9 Polish** — empty states across all list screens, themed status bar, `APP_NAME`/display
  name, dark splash background.

**Deferred / Needs Nico:**
- **Phase 8b Google Drive backup** — deliberately not built: blocked on a Google Cloud OAuth client
  and unverifiable without a dev build. Local export/import already covers device migration; the
  Drive login is a convenience layer to add once the OAuth client exists.
- On-device run, APK/EAS build, and visual sign-off (no Java/Android SDK in the build env).
- Real icon/splash **art** (foreground PNGs are still the Expo template).
- Confirm the product name; optionally swap the example plans for Nico's real splits.
