# Reptic (Repz)

An offline-first **gym tracking app** for Android, built with Expo / React Native.
Every session is stored locally; while training you see **"letztes Mal" per set**:
last time's weight is pre-filled (editable), reps are typed fresh, and a grey
`↳ letztes Mal: 80 kg × 8` line shows the target to beat. Single user, no backend,
no account. The UI is in German.

## Features

- **Heute** — pick one or more plans (or an empty session), then log each exercise
  set by set with last-time carry-over. Resume an in-progress session; a live clock in
  the header shows how long it has been running.
- **Progression** — per exercise, a double-progression hint from last time: once every
  working set reached the rep target (default 12), "Vorschlag: +2.5 kg" (rounded to what
  the plates can load), otherwise "bei X kg bleiben". Advice only; "Übernehmen" applies
  it on tap. Quiet without history or when last time was in another gym.
- **Zusammenfassung** — finishing a session shows duration, sets, volume, cardio
  distance, the records it set and the change against the last session with the same
  plans; reachable again from the history detail.
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
- **Designs** — four looks (Evolved, Warm, Arcade, Instrument) with their own fonts, shapes,
  tab bars and motion, picked in Einstellungen → Design; Evolved follows system/light/dark.
  Animations respect the OS reduced-motion setting.
- **Wochenziel** — weekly goal in kg and km, streak, XP/level and a week hero on Heute;
  goals and personal records are celebrated next to the input.
- **Kraftverlauf** — per exercise an e1RM chart with a saturating forecast (only when the
  history supports one; declining or noisy data gets no curve), range chips and a saved gym filter.
- **Pause-Hinweis** — after a 14+ day break the session offers lighter carried-over weights.
- **Duell** — compare weeks with a friend via a share code (WhatsApp text), no server.
- **Einstellungen** — design, system/light/dark theme, week goal, name, rest duration, rep target + progression
  step, vibration, plate setup,
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

Jest pins `TZ=Europe/Berlin` (`jest.global-setup.js`): week and break maths are DST-sensitive,
so results do not depend on the machine's timezone.

Browser click-through (needs `npx expo start`, web on :8081; uses a Playwright clock, so it is
date-independent):

```bash
npm run e2e                                 # one run (E2E_THEME=warm|arcade|instrument|evolved-dark, E2E_URL)
npm run e2e:all                             # the same click-through in all 5 looks
npm run screenshots                         # scripts/screenshots.mjs -> $TMPDIR/reptic-shots/<size>/<look>/
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
  standalone APK: `npx -y eas-cli@25.2.0 build -p android --profile preview`.
- **Updates without reinstalling**: APKs from the `preview` profile listen on the EAS
  Update channel `preview`. `npm run ship` (clean tree required) runs typecheck, lint and
  jest, then publishes the current commit; the phone picks it up on the next cold start
  (it waits up to 3 s, otherwise the start after that). Einstellungen shows the running
  bundle ("Update vom …"). The runtime version is a native fingerprint: after adding a
  native module or changing native config, `eas update` finds no compatible build — build
  a new APK instead.
- **Cloud backup (planned, Phase 8b)**: an optional Google Sign-In that backs up to the
  user's own Google Drive (`appDataFolder`) — no backend. It needs a Google Cloud OAuth
  client (Web + Android client ID with the signing SHA-1) and a dev build (native module,
  not Expo Go). Until then, local JSON export/import covers device migration.

## Data & privacy

All data lives in a local SQLite database on the device. Nothing is sent anywhere;
the optional Drive backup (when added) writes only to the user's own Drive.

The automatic backup writes into the app's own document directory. It protects against
accidental deletes and corrupted app data — **not** against losing the device, since it
dies with the app. That case is what the manual export (and later the Drive backup) is
for, and the app says so in Einstellungen rather than implying more safety than it has.

## License

MIT, see [LICENSE](LICENSE).
