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
