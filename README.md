# Reptic

A private, self-tailored **gym tracking** app — a local-first replacement for an
ad-hoc Notes workflow. Installable Android app, fully offline, single user.

Its core value over notes: every session is stored, and while training you see
**"letztes Mal" per set** — last time's weight is pre-filled (editable), reps are
typed fresh, and a grey `↳ letztes Mal: 80 kg × 8` line shows the target to beat.

## Features

- **Heute** — pick one or more plans (or an empty session), then log each exercise
  set by set with last-time carry-over. Resume an in-progress session.
- **Pause & Rekorde** — ticking a set done starts a rest timer (configurable, off-switch)
  that keeps counting across the whole session flow, and flags a personal record:
  heaviest weight, best Epley 1RM estimate, longest distance or fastest pace. A record
  is only claimed against real history — a tie is not a record, and nothing is announced
  until the exercise has three sessions behind it.
- **Hantelscheiben** — tap the "KG" caption on a set to see what to load per side, or an
  honest "nicht exakt stellbar" with the closest weights. Bar and plate sizes configurable.
- **Pläne** — create/edit training splits (name, color, ordered exercises).
- **Übungen** — exercise library grouped by muscle group; add/edit, archive when
  it already appears in history instead of deleting.
- **Verlauf** — past sessions (date, plan colors, performed sets + volume), a
  read-only session detail, per-exercise progression (last 12 sessions, top-weight
  bars), a month calendar, and **Trends**: volume per ISO week, per muscle group and
  weekly cardio distance over the last 12 weeks (untrained weeks shown as zero, never
  interpolated).
- **Einstellungen** — system/light/dark theme, rest duration, vibration, plate setup,
  gyms, an **automatic daily on-device backup** (newest 7, restorable in-app) and JSON
  **backup export/import** (share to Drive/Files, restore on a new device).

## Stack

Expo SDK 57 · React Native 0.86 · TypeScript · expo-router (typed routes) ·
expo-sqlite (async, `PRAGMA user_version` migrations) · expo-haptics · own theme
token system. No state/styling framework.

## Architecture

- `src/domain/` — **pure** logic (no native/react imports), fully unit-tested:
  last-time resolver, set carry-over, plan merge, formatting, backup (de)serialize.
- `src/db/` — thin typed data layer over expo-sqlite (snake_case rows → domain types).
- `src/theme/` — tokens + theme context (persisted system/light/dark override).
- `src/app/` — thin expo-router screens that call `db/` and render `domain/` output.
- `src/lib/` — impure device bridges (backup file I/O via `File`/`Paths`, sharing,
  picker, haptics).
- `src/test-support/` — the component-test harness: screens render against real SQLite
  (node:sqlite), only the router and haptics are mocked.
- `src/constants/app.ts` — product name and other trivially-changeable constants.

Rule: `domain/` must never import from `db/`, `app/`, or any native module, so the
core stays testable in plain Node/Jest.

## Develop

```bash
npm install
npx expo start        # open in Expo Go or a dev build
```

Gate (green before every commit):

```bash
npm run typecheck     # tsc --noEmit
npm test              # jest (domain, db against real SQLite, and screens)
npm run lint          # expo lint
```

Two things that bite when writing tests here: in `@testing-library/react-native` v14
`render`, `fireEvent` and `act` are **async** and must be awaited, and screen tests live
in `src/__tests__/`, never under `src/app/` — every file in that tree is a route.

After adding a screen, run `npx expo start` once: the expo-router route types are only
written by the dev server, and `tsc` rejects an unknown path until they are regenerated.

## Setup still required (device / accounts)

The build environment here has no Java/Android SDK, so the following are done by hand:

- **Run on device / APK**: `npx expo start` (Expo Go) for day-to-day; an
  [EAS build](https://docs.expo.dev/build/introduction/) (needs an Expo login) for a
  standalone APK.
- **Cloud backup (planned, Phase 8b)**: an optional Google Sign-In that backs up to the
  user's own Google Drive (`appDataFolder`) — no backend. It needs a Google Cloud OAuth
  client (Web + Android client ID with the signing SHA-1) and a dev build (native module,
  not Expo Go). Until then, local JSON export/import covers device migration.
- **Icon/splash art**: the foreground images are still the Expo template; only the
  colors are branded.

## Data & privacy

All data lives in a local SQLite database on the device. Nothing is sent anywhere;
the optional Drive backup (when added) writes only to the user's own Drive.

The automatic backup writes into the app's own document directory. It protects against
accidental deletes and corrupted app data — **not** against losing the device, since it
dies with the app. That case is what the manual export (and later the Drive backup) is
for, and the app says so in Einstellungen rather than implying more safety than it has.
