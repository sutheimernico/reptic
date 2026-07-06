# Reptic

A private, self-tailored **gym tracking** app — a local-first replacement for an
ad-hoc Notes workflow. Installable Android app, fully offline, single user.

Its core value over notes: every session is stored, and while training you see
**"letztes Mal" per set** — last time's weight is pre-filled (editable), reps are
typed fresh, and a grey `↳ letztes Mal: 80 kg × 8` line shows the target to beat.

## Features

- **Heute** — pick one or more plans (or an empty session), then log each exercise
  set by set with last-time carry-over. Resume an in-progress session.
- **Pläne** — create/edit training splits (name, color, ordered exercises).
- **Übungen** — exercise library grouped by muscle group; add/edit, archive when
  it already appears in history instead of deleting.
- **Verlauf** — past sessions (date, plan colors, performed sets + volume), a
  read-only session detail, and per-exercise progression (last 12 sessions,
  top-weight bars).
- **Einstellungen** — system/light/dark theme, and JSON **backup export/import**
  (share to Drive/Files, restore on a new device).

## Stack

Expo SDK 57 · React Native 0.86 · TypeScript · expo-router (typed routes) ·
expo-sqlite (async, `PRAGMA user_version` migrations) · own theme token system.
No state/styling framework.

## Architecture

- `src/domain/` — **pure** logic (no native/react imports), fully unit-tested:
  last-time resolver, set carry-over, plan merge, formatting, backup (de)serialize.
- `src/db/` — thin typed data layer over expo-sqlite (snake_case rows → domain types).
- `src/theme/` — tokens + theme context (persisted system/light/dark override).
- `src/app/` — thin expo-router screens that call `db/` and render `domain/` output.
- `src/lib/` — impure device bridges (backup file I/O via `File`/`Paths`, sharing, picker).
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
npm test              # jest
npm run lint          # expo lint
```

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
