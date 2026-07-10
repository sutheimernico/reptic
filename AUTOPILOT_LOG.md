# Reptic — Autopilot log

One line per completed loop iteration (newest at bottom).

- 2026-07-05 — Phase 0 bootstrap: Expo SDK 57 scaffold on `autopilot/work`, test/lint/typecheck
  tooling wired, pure domain core (types/format/sets/plans/backup/seed) + 24 unit tests,
  full gate green (tsc + jest + eslint), project docs written.
- 2026-07-05 — Phase 1 data layer: SQLite schema + `PRAGMA user_version` migration, first-run seed,
  typed data layer (exercises/plans/workouts/sets/settings CRUD, `getLastSetsForExercise`, backup
  export/import), `SQLiteProvider` wired into root layout. Gate green (import-verified).
- 2026-07-05 — Phase 2 theme: extended palette (dark #0B0D14/indigo, light #F4F5F7) + Radius tokens,
  ThemeProvider with persisted system/light/dark override in settings, useTheme() reads context with
  system fallback, root layout + nav theme follow resolved scheme. Gate green.
- 2026-07-05 — Phase 3 nav shell: replaced sample tabs/NativeTabs with root Stack + (tabs) group of
  5 classic Tabs (Heute/Pläne/Übungen/Verlauf/Einstellungen, Ionicons, themed bar), shared Screen
  scaffold, themed placeholders; removed sample routes. Gate green.
- 2026-07-06 — Shared UI kit: Card, Button (primary/secondary/danger), IconButton, TextField,
  ListRow (selectable), EmptyState, SegmentedControl — all themed off the palette. Gate green.
- 2026-07-06 — Phase 4 Übungen: library grouped by muscle group with add, exercise editor
  (name + muscle-group chips), delete-or-archive (archive when in history), themed native nav
  headers. Gate green.
- 2026-07-06 — Phase 5 Pläne: plans tab lists plans (color dot + exercise count), plan editor
  (name, 6 color swatches with accent ring, exercise assignment grouped by muscle group with
  selection order = plan order, delete with confirm). Gate green.
- 2026-07-06 — Phase 6 Heute/core: plan multi-select + empty/resume session start; session screen
  (exercise list with set progress, add via picker, remove via long-press, finish); exercise set
  screen (kg prefilled from last time, reps empty, grey "letztes Mal" line, +Satz, delete, done,
  live persist). getSetProgressForWorkout added; ListRow gained onLongPress. Gate green.
- 2026-07-06 — Phase 7 (list): Verlauf tab lists finished sessions (date via new pure
  `formatSessionDate`, plan color dots, "N Übungen · M Sätze") + read-only session detail
  `workout/[id]` showing each exercise's `formatSetSummary`, with delete. New
  `getFinishedWorkoutSummaries` (correlated subqueries, no row multiplication) + 2 date tests.
  Also logged the decision to add Google Drive backup as Phase 8b. Gate green (tsc + 26 jest + lint).
- 2026-07-06 — Phase 7 (progression): `exercise/progress` screen shows an exercise's last 12
  finished sessions with top-weight bars (scaled to the max) + per-session `formatSetSummary`;
  reachable via a new "Fortschritt ansehen" button in the exercise editor (only when history
  exists). New pure `topSetWeight` (+2 tests) and `getExerciseSessionHistory`. Phase 7 complete.
  Gate green (tsc + 28 jest + lint).
- 2026-07-06 — Phase 8 (theme toggle): Einstellungen tab now has a system/light/dark
  SegmentedControl wired to `useThemeMode().setMode` (persists via the existing settings row).
  Export/import + Drive backup still open. Gate green (tsc + 28 jest + lint).
- 2026-07-06 — Phase 8 (export/import): new `src/lib/backup.ts` bridges domain (de)serialize +
  db export/import to the device via SDK 57 `File`/`Paths`, `expo-sharing`, `expo-document-picker`
  (checked v57 docs per AGENTS.md — new class-based FS API, not legacy `*Async`). Einstellungen
  gained a "DATEN" section: export → share sheet, import → pick + validate + confirm-with-counts +
  replace-all. Installed 3 deps. Phase 8 complete. Gate green (tsc + 28 jest + lint).
- 2026-07-06 — Phase 9 (polish): themed StatusBar in the root layout (follows resolved scheme),
  display name → `Reptic`, dark splash background `#0B0D14`; empty states already covered.
  Appended the spec Outcome section. Icon art + Phase 8b Drive backup remain Needs Nico.
  Final gate green (tsc + 28 jest + expo lint; `expo config` resolves). Autopilot phases done.
- 2026-07-06 — Hardening loop A: real session volume (Σ weight×reps) in the Verlauf list via a
  SQL SUM in `getFinishedWorkoutSummaries` + new pure `formatVolume` (German thousands, +1 test),
  shown only when > 0. Gate green (tsc + 29 jest + lint).
- 2026-07-06 — Hardening loop B: frontend review of the session diff, then fixed the real findings.
  (1) "Performed set" = `reps IS NOT NULL` so opened-but-untouched carried-over rows no longer
  inflate history counts or fabricate progress bars (`topSetWeight` + history/summary/session-history
  queries; +1 test, dropped unused `doneCount`). (2) Backup import accepts text/plain +
  octet-stream (Drive/Files report .json that way). (3) a11y: SegmentedControl selected-state,
  ListRow `accessibilityLabel` exposing Verlauf plan names (were color-only). Skipped the review's
  cancel-guard/.catch notes — they match the existing tab-screen convention and React 19 no longer
  warns on unmount setState. Gate green (tsc + 30 jest + lint).
- 2026-07-07 — Feedback round 1 (overnight autonomous build, Nico's go): gyms + user-owned
  library + calendar. Schema v2 (gyms table, workouts.gym_id NOT NULL, seed wipe — app starts
  empty), final muscle groups (Bauch/Cardio in, Trapez/Nacken out), mandatory gym pick at
  session start (last-used preselected, inline create), two-stage gym-aware weight suggestions
  ("↳ letztes Mal im <Gym>" on fallback), gym management in Einstellungen, gym in history/
  detail/progression, custom calendar screen (Monday-first month grid, plan-color markers),
  backup v2 with gyms (v1 rejected). Review pass caught a CRITICAL migration bug (DELETE FROM
  exercises before dropping referencing workout tables → FK failure → startup crash-loop on
  any device with v1 data); fixed drop order + IF EXISTS retry guards, verified against real
  sqlite3 (happy + retry path). 9 commits, gate green (tsc + 43 jest + expo lint), Android
  bundle compiles via Metro. Not fixed (pre-existing): ListRow lacks accessibilityRole.
- 2026-07-07 — Gym-save bug root-caused + fixed (continuation of docs/sessions/2026-07-07_1010).
  Evidence: expo-sqlite@57 source analysis (execAsync = raw sqlite3_exec, statement-by-statement
  autocommit, no rollback; onInit re-runs on every provider remount; native connections are
  CACHED across Metro reloads incl. their open transactions) + SQLite scenario harness. Two
  mechanisms reproduce the symptom (one gym saved, later writes lost, reads fine): an orphaned
  transaction inherited through the connection cache after a reload killed a
  withTransactionAsync mid-flight (writes join it, vanish on rollback), and/or the non-atomic
  non-idempotent migration stranding user_version=0 with schema applied. Fix `96bf4cc`:
  migration wrapped in BEGIN EXCLUSIVE..COMMIT incl. user_version, V1 schema IF NOT EXISTS
  (self-repair of stranded devices), ROLLBACK guard at init, module-level serialization of
  concurrent onInit runs, progress/error logging. Fix `860ac48`: all gym/exercise/plan write
  handlers surface errors via alert (incl. raw SQLite message) instead of silent unhandled
  rejections. The previously uncommitted foreign_keys-OFF change is folded into `96bf4cc`.
  New: src/db/__tests__/schema.test.ts runs the REAL migrateDbIfNeeded against real SQLite
  via node:sqlite (exec matches sqlite3_exec semantics) — 7 scenarios incl. interrupt-recovery,
  mid-failure rollback, orphaned-txn cleanup, concurrent runs. Gate green (tsc + 50 jest + lint).
  Which mechanism hit Nico's device stays unconfirmed until the next on-device test — the new
  alerts + [db] logs will show it immediately if anything still fails.
- 2026-07-07 — Gym-save fix VERIFIED on device (Nico, Expo Go tunnel): gyms and exercises save
  and persist across an app kill. His earlier "still broken" report predated the device loading
  the fixed bundle (Metro log shows the full rebundle only at ~14:17). Temporary [db] forensics
  instrumentation (never committed) discarded; code stands at 860ac48/96bf4cc. Which of the two
  proven mechanisms hit the device stays forensically open — moot now: the class is fixed,
  regression-tested, and any future write failure surfaces as an alert with the SQLite message.
- 2026-07-07 — Feedback round 2 (swipe-delete, reorder, icon, exercises). Icon design D
  (barbell, indigo->violet gradient) rendered to all Android/adaptive/monochrome/splash/
  favicon assets via sharp. New: swipe-to-delete an exercise in a running session
  (ReanimatedSwipeable red trash panel; open->delete; long-press keeps the confirm dialog;
  GestureHandlerRootView added at root). Plan editor gained an ordered "Reihenfolge" list
  with up/down + remove, persisted via existing setPlanExercises order; pure moveBy helper
  (src/domain/ordering.ts) with 7 tests. Session delete already existed (workout/[id]) — left
  as is per Nico. Nico's 18 dictated exercises delivered as an optional Reptic v2 backup in
  Downloads (reptic-starter-uebungen.json, 2 gyms + 18 exercises), validated against the real
  parseBackup; NOT seeded in code (library-stays-empty product decision holds). versionCode 3.
  Gate green (tsc + 57 jest + expo lint). EAS build 8937038f (preview APK). Superseded the
  icon-only build 2 (ac1301a8, canceled in queue).
- 2026-07-07 — Feedback round 3 (drag-and-drop, swipe fix, tap targets, name, seed). Fixes after
  live Expo Go testing: (1) swipe-to-delete now actually deletes — friction 1 + leftThreshold 40
  so a normal swipe settles open, delete on open, with immediate reflow (was: only flashed red).
  (2) Drag-and-drop reorder in the SESSION via react-native-reorderable-list (long-press → drag,
  persisted via reorderWorkoutExercises); tap opens, swipe deletes. (3) Drag-and-drop in the PLAN
  editor too (NestedReorderableList in ScrollViewContainer) — arrows removed per Nico; moveBy/
  ordering.ts kept but now unused. (4) Long-press hold shortened 500→150ms (ListRow delayLongPress).
  (5) Button hit area forced full-width (Android new-arch Pressable collapsed to content — only the
  label was tappable). (6) Renamed app to "Repz" (display only; slug/package unchanged). (7) 18
  dictated exercises seeded once on fresh install (fromVersion 0, in migration txn; not re-seeded on
  upgrade) — reverses the earlier empty-start default per Nico's request. Process change: iterated on
  Expo Go tunnel + forced Metro Android bundle (HTTP 200) to validate BEFORE building, instead of
  blind 3h EAS builds. Gate green (tsc + 58 jest + expo lint). versionCode 4, EAS build 3eee2904
  (preview APK) after Nico's live sign-off.
- 2026-07-08 — Cardio set input (km / time / level). Additive schema v3: three nullable columns
  on workout_sets via ALTER TABLE (distance_km, duration_sec, level) — provably non-destructive
  (test migrates a v2 DB with data → columns added, rows preserved). Cardio exercises
  (muscleGroup 'Cardio') show KM · ZEIT (mm:ss or minutes) · STUFE instead of KG/WDH, with the
  same last-time carry-over (distance+level carried, time typed fresh) and reference line
  ("↳ letztes Mal: 5 km · 32:30 · Stufe 8"). Uniform fieldsOf() persistence (no cardio branching
  in save logic); updateSetNumber() added so set renumber-on-delete preserves cardio values.
  History "performed" counts broadened to include cardio sets. Domain parsers/formatters
  (parseDuration/formatDuration/formatCardioReference) + migration tested; 67 jest green.
  Known gap (told Nico): history detail summary + progress bars still strength-only for cardio.
  versionCode 5, EAS build 0981fd79. Feature works for the user's existing exercises via their
  muscle group — the seed does NOT run on an update, so his ~20 APK exercises are untouched.
- 2026-07-10 — Review-driven hardening + polish (autonomous, Nico away; plan:
  docs/superpowers/plans/2026-07-10-cardio-history-refactor-polish.md). Two independent
  code reviews (screens+components, db/domain/lib) → findings triaged and fixed:
  (1) Cardio gap CLOSED: getExerciseSessionHistory's inner set query was reps-only and
  never selected the cardio columns → cardio history detail said "Keine Sätze
  eingetragen", progression cards were empty. Now cardio-aware (same performed-rule as
  getFinishedWorkoutSummaries); new domain helpers formatCardioSetSummary +
  topCardioMetrics (tested); progression bars scale by top distance (duration fallback),
  labels km / m:ss. (2) exerciseHasHistory checked workout_sets (created lazily on first
  open) — deleting an exercise that sat in a session but was never opened hit the
  workout_exercises FK (no cascade) with a raw error. Now checks workout_exercises;
  delete dialog names the plan_exercises cascade. (3) Archived exercises were a dead end
  (no list, no unarchive — unlike gyms): Übungen tab gained an "Archiviert" section,
  editor a "Reaktivieren" button. (4) Error-handling: start/finish/delete workout,
  add-exercise, addSet/removeSet all surfaced nothing on failure; set screen had a local
  zero-arg showSaveError shadowing lib/alerts (dropping the SQLite message the gym-save
  fix made visible). All unified on lib/alerts. beforeRemove flush now preventDefaults
  and re-dispatches after the writes commit (was fire-and-forget → stale-count race).
  (5) Splash: AnimatedSplashOverlay still rendered the Expo template art — expo-logo.png
  on Expo-blue #208AEF flashing over the dark barbell native splash on EVERY app start.
  Rebuilt as components/splash-overlay.tsx mirroring app.json (splash-icon.png, 76px,
  #0B0D14). (6) Polish: "1 Übungen"→plural() everywhere (calendar had the bug, helper
  moved to domain/format), "Deine Trainingsbilder"→"Deine Trainingspläne" (dictation
  artifact — Nico may veto), a11y roles/states/labels on ListRow, TextField, SetInput,
  chips, swatches, done-toggle. (7) Dead code removed (grep-verified): domain/ordering.ts,
  domain addSet/removeSet, db getFinishedWorkouts, template components
  (Collapsible/HintRow/WebBadge/ExternalLink/ThemedView), use-color-scheme hooks,
  AnimatedIcon+web+css, ThemedText variants (title/subtitle/link/linkPrimary/code, incl.
  hardcoded #3c87f7), Fonts/MaxContentWidth tokens, template assets (expo/react logos,
  badges, tabIcons, tutorial-web). (8) db: sort_order now computed inside the INSERT
  (race-free), exportAllData via selectAll helper + plan_exercises mapper, importAllData
  clears last_gym_id (cross-device id collision). Skipped consciously: muscle_group CHECK
  constraint (needs migration; enum edits come with migrations anyway), get*/exists*
  naming unification (API churn without payoff), swipe-delete's white trash icon (fine
  contrast on danger-red in both themes). Gate green (tsc + 62 jest + expo lint) after
  every commit. NO EAS build — versionCode stays 5; per process rule builds only after
  Nico's live Expo-Go sign-off. Needs Nico: Expo-Go smoke test (esp. splash overlay,
  cardio progression, back-nav flush feel), then build decision.
