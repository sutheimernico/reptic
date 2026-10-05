# Reptic (display name: **Repz**)

A private, self-tailored gym tracking app for Nico. Replaces the ad-hoc Notes-app
workflow. Installable Android app, fully offline, local-first, single user.

**Core value over Notes:** every session is stored, and while training you always see
what you did **last time** per set — so you know the target to beat.

> Internal product name **Reptic** (rep + the ✓ tick of a completed set); the launcher
> shows **Repz** (2026-07-07 rename, display name only — slug/package unchanged).
> Both held in `src/constants/app.ts` / `app.json`.

## What it does

- Define **plans** (Trainingspläne) — named, colored groups of exercises.
- Start a **session** by picking the gym (last-used preselected) and multi-selecting
  plans; they merge into one exercise list.
- The session's exercise list is **fully editable per session** (add / remove /
  drag-and-drop reorder) without changing the saved plan.
- Per exercise, track **sets**: kg pre-filled from last time (editable), reps typed
  fresh, a grey "↳ letztes Mal: 80 kg × 8" reference line beneath each set. `+ Satz`
  adds, first set is present and deletable, a check marks a set done. Weight
  suggestions are **gym-aware** (same gym first, any-gym fallback with source label).
- **Cardio** exercises (muscle group Cardio) log km / time / level instead of kg × reps,
  with the same carry-over and reference line.
- **Exercise library** seeded with 18 exercises on fresh install; custom exercises
  addable, archived ones stay reachable and can be reactivated.
- **History** of every session (list + calendar); per-exercise progression with
  top-weight bars (cardio: distance/time).
- **Dark / Light** theme, follows system with a persisted manual toggle.
- **Export / Import** all data as JSON (backup format v2, gyms included).

## Stack

Expo (managed) SDK 57 + React Native 0.86 + TypeScript · expo-router · expo-sqlite
(async API, `PRAGMA user_version` migrations) · own theme token system · no state or
styling framework (React built-ins + SQLite as source of truth).

## Architecture (isolation)

- `src/domain/` — PURE logic, no native/react imports: types, set carry-over, last-time
  resolution, plan merge, backup (de)serialize, formatting. Fully unit-tested.
- `src/db/` — SQLite schema, migrations, starter-exercise seed, a thin typed data layer.
- `src/theme/` — color tokens + context (system/light/dark override).
- `src/app/` — expo-router screens; thin, call `db/`, render `domain/` results.

Rule: `domain/` never imports from `db/`, `app/`, or a native module — it stays testable
in plain Node/Jest.

## Gate (green before every commit)

`npm run typecheck` (tsc --noEmit) · `npm test` (jest) · `npm run lint` (expo lint).

## Needs Nico (cannot be done in the build environment — no Java/Android SDK here)

- On-device run + APK build (local Android SDK, or a free Expo EAS cloud build that
  needs Nico's Expo login).
- Visual / feel sign-off on a real device.

## Branch

Autonomous work lands on `autopilot/work`. Nico reviews and merges to `main`.
