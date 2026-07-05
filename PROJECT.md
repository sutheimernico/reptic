# Reptic

A private, self-tailored gym tracking app for Nico. Replaces the ad-hoc Notes-app
workflow. Installable Android app, fully offline, local-first, single user.

**Core value over Notes:** every session is stored, and while training you always see
what you did **last time** per set — so you know the target to beat.

> Product name **Reptic** (rep + the ✓ tick of a completed set), held in
> `src/constants/app.ts` so it is trivially renameable.

## What it does

- Define **plans** ("Trainingsbilder") — named, colored groups of exercises.
- Start a **session** by multi-selecting plans; they merge into one exercise list.
- The session's exercise list is **fully editable per session** (add / remove / reorder)
  without changing the saved plan.
- Per exercise, track **sets**: kg pre-filled from last time (editable), reps typed
  fresh, a grey "↳ letztes Mal: 80 kg × 8" reference line beneath each set. `+ Satz`
  adds, first set is present and deletable, a check marks a set done.
- **Exercise library** pre-seeded by muscle group; custom exercises addable.
- **History** of every session; simple per-exercise progression.
- **Dark / Light** theme, follows system with a persisted manual toggle.
- **Export / Import** all data as JSON (backup net).

## Stack

Expo (managed) SDK 57 + React Native 0.86 + TypeScript · expo-router · expo-sqlite
(async API, `PRAGMA user_version` migrations) · own theme token system · no state or
styling framework (React built-ins + SQLite as source of truth).

## Architecture (isolation)

- `src/domain/` — PURE logic, no native/react imports: types, set carry-over, last-time
  resolution, plan merge, backup (de)serialize, seed data, formatting. Fully unit-tested.
- `src/db/` — SQLite schema, migrations, seed insertion, a thin typed data layer.
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

Autonomous work lands on `autopilot/work`. Nico reviews and merges to `master`.
