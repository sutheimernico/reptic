# Repz: switchable themes, strength insights and weekly challenges

Status: design, waiting for Nico's approval · 2026-10-19
Mockup (open in a browser, click through): `docs/superpowers/specs/2026-10-19-repz-designs-v1.html`
Previous specs: `2026-07-05-reptic-gym-app-design.md`, `2026-07-06-gyms-empty-library-calendar-design.md`

## 1. Intent

Repz works, but it looks like a decent default app. Nico uses it at every gym session and judges
it by look and feel as much as by function. He wants it to feel *geil*: a distinctive visual
language, clean animations everywhere, and playful motivation (weekly kilos, streaks, duels with
friends). He also wants to see how he got stronger per exercise and where that is heading —
honestly, i.e. flattening towards a plateau instead of a straight line — and wants the app to
notice a long gym break and suggest starting lighter.

Of five design directions in the mockup he liked **D Arcade** and **E Instrument** most and wants
**A Repz Evolved** and **C Warm Athletic** too. All four become themes he can switch in
Einstellungen. (B Iron Editorial is dropped.)

## 2. Goals, non-goals, anti-goals

Goals
- Four selectable themes A, C, D, E, each matching its mockup direction in palette, typography,
  shape language and motion — not just colours. Switching is instant and persisted.
- Clean animations on the existing app (tab change, list entrance, set tick, PR, timer, sheets)
  in every theme's own motion language.
- Weekly goal: moved kilos (Σ weight × reps of ticked sets) and cardio km per ISO week, with
  progress visual and a celebration when reached; week streak.
- Strength chart per exercise with a non-linear forecast (saturating curve + uncertainty band).
- Break detection: after ≥ 14 days without any training, suggest lighter starting weights.
- Weekly duel with friends without a server: share a week card as a text code, import a friend's
  code, compare kilos and cardio km.
- Everything verified by automated tests across all four themes before Nico clicks anything.

Non-goals (this round)
- Any server, account, sync or live leaderboard (Nico: "erstmal keinen Server").
- Sharing the week card as an image (needs an extra native library; text code first).
- Forecasts for cardio exercises.
- B Iron Editorial.
- Play Store release, Google Drive backup (Phase 8b stays blocked).

Anti-goals (a failure even if it technically works)
- Four copies of every screen. Themes must be one set of screens with tokens plus a small number
  of theme-skinned components (§3.3). A fifth theme later must not mean touching every screen.
- Animations that slow down logging a set. Mid-set the app is a tool: no animation may block
  input or delay a tap by more than one frame; celebrations play next to the input, never modal.
- A forecast that invents certainty: no curve without enough data, always a visible band, always
  labelled "Prognose".
- Gamification that nags or shames (no red "you failed your goal" states, no push notifications).
- Losing or touching Nico's existing training data. Schema stays at v3 (§5).

## 3. Theme system

### 3.1 What a theme is
A theme is a typed object providing:
- `colors` — today's token names (`text`, `background`, `card`, `accent`, `accentEnd`, …) plus
  new ones the mockups need (e.g. `accent2`, `warning`, `chartLine`, `chartBand`, `grid`).
- `fonts` — family names for `display`, `body`, `numeric` (E uses tabular monospace for numbers).
- `shape` — radii (sm/md/lg/xl), border width (D has thick outlines), shadow style
  (A soft glow, C soft drop, D hard offset shadow, E none + corner brackets).
- `motion` — presets the animated components read: spring config (A springy, C calm/slow ease,
  D bouncy overshoot, E linear/stepped), durations, and the celebration type.
- `variant` — `'evolved' | 'warm' | 'arcade' | 'instrument'`, used only by skinned components.
- `statusBar` — light/dark content.

`Radius` and `Spacing` are imported as static constants in many files today; radii move into the
theme (spacing stays static and shared).

### 3.2 Picking a theme
- Einstellungen → "Design": four cards, each a small live preview (palette, font sample, shape),
  tap to apply immediately. Persisted in the settings table (`theme_variant`). Default for an
  existing install: A (no surprise on update).
- **Builder's call / Claude's call:** A keeps today's Hell / Dunkel / System control; C and D are
  light-only, E is dark-only — as in the mockups. The Hell/Dunkel/System control is only shown
  while A is active.
- Fonts are bundled via `@expo-google-fonts/*` packages and loaded at startup behind the existing
  splash overlay, so no theme ever flashes in a fallback font. Families per mockup: A Plus Jakarta
  Sans · C Fraunces (display) + DM Sans · D Bricolage Grotesque · E JetBrains Mono (numbers,
  labels) + IBM Plex Sans. Load only the weights the mockup uses.

### 3.3 Shared screens, skinned components
All screens stay single implementations reading tokens. Only these components switch on
`variant` (each in its own file per variant, behind one component API):
1. **Tab bar** — A floating translucent bar with sliding indicator (no real blur: no extra
   dependency, and blur on Android is slow/experimental — **Claude's call**); C soft pill bar; D chunky outlined
   bar with "pressed" active tab; E flat bar with numbered labels and a top scan line.
2. **Week goal hero** (Heute) — A gradient ring; C nested activity rings (kg outer, km inner);
   D XP/level bar + streak flame + quest list; E segmented gauge + per-day bars.
3. **Celebration** (PR and goal reached) — A pill floating above the card edge with glow;
   C confetti; D starburst "NEUER REKORD! +50 XP"; E value flash + "▲ PR" readout.
4. **Duel visual** — A twin bars; C tug-of-war slider; D boss-fight HP bars; E split readout
   with deltas.
5. **Chart style** — line/area/band styling per theme (one chart component, styled by tokens
   plus a variant flag for E's grid and readout box).

Everything else (cards, buttons, inputs, list rows, segmented control, sheets) gets its look from
tokens (radius, border width, shadow, fonts, colours) only.

### 3.4 Motion rules (all themes)
- Use `react-native-reanimated` (already a dependency); animate transform and opacity only.
- 150–400 ms for UI transitions; celebrations up to ~1.2 s but never block input.
- Must cover: tab switch transition, list item entrance (staggered, first render only), set tick
  (check pop + row settle), rest timer fill, PR celebration, goal-reached celebration, ring/gauge
  fill on Heute, chart draw-in, sheet open/close, number count-up on Heute hero.
- Respect the OS "reduce motion" setting (`useReducedMotion`): no count-ups, no confetti, instant
  fills, fades only.
- Haptics stay behind the existing switch; D may add a light haptic on XP gain (same switch).

## 4. Features

### 4.0 Which sets count
"Ticked set" in this document means the app's existing *performed* rule (`performedSql` in
`src/db/sets.ts`: reps entered; for cardio as today), not only the `done` flag. **Claude's call:**
every new number must agree with Verlauf, Trends, the session summary and the PR badge, and Nico
does not tick every set. Reuse the existing queries in `src/db/totals.ts` where they fit.

### 4.1 Weekly goal and streak
- Moved kilos = Σ (weightKg × reps) over ticked sets of finished workouts in the current ISO week
  (local time, Monday start — reuse `src/domain/weeks.ts`). Sets with 0 kg or no weight count 0.
  The running session counts live.
- Cardio km = Σ distanceKm of ticked cardio sets in the same week.
- Goals are set in Einstellungen ("Wochenziel kg", "Wochenziel Cardio-km"), stored in settings.
  **Claude's call:** if no goal is set, suggest one = median of the last 4 trained weeks rounded
  up to the next 500 kg (fallback 10 000 kg); the km goal is hidden until the user has logged
  cardio at least once (fallback suggestion 10 km). Until Nico sets a goal himself, the
  suggestion is used right away (ring, celebration, quests, duel status), labelled "Vorschlag ·
  anpassen", and recomputed each week; once he sets a value it is stored and fixed.
- Streak = consecutive ISO weeks with at least one finished workout, counting back from the
  current week (current week counts only if it already has a workout; otherwise start from last
  week, so Monday morning does not show 0).
- Reaching a goal during a session triggers the theme celebration once per week per goal.

### 4.2 XP and level (D only, derived)
- **Claude's call:** XP is not stored; it is computed from history: 10 XP per ticked set, +50 XP
  per set that set a personal record (existing PR detection). Level curve: level n needs
  `100 · n^1.5` cumulative XP (rounded). Quests on Heute = the week's goals + "1 Rekord diese
  Woche". Other themes do not show XP.

### 4.3 Strength chart and forecast
Lives on the existing exercise progress screen (`src/app/exercise/progress.tsx`), reached from
Übungen and from a past session's detail (already wired).
- Series: per session, e1RM = max Epley over ticked sets with weight > 0 and 1 ≤ reps ≤ 12
  (Epley gets unreliable above ~12 reps — **Claude's call**). Bodyweight-only and cardio exercises
  keep today's top-reps / top-distance view without forecast.
- Range chips 3M / 6M / 1J / Alles; header shows current e1RM and change over the range.
- Gym filter (Nico's decision): multi-select chips "Alle Gyms" plus one chip per gym that has
  history for this exercise (archived gyms included if they have history). "Alle" and individual
  gyms are mutually exclusive; deselecting the last gym falls back to "Alle". The series, the
  header numbers and the forecast all use the filtered sessions; if the filter leaves too little
  data, the usual "Noch zu wenig Daten" state shows. The filter is persisted in settings
  **per exercise** (**Claude's call**: machines differ per gym for one exercise but not another);
  a stored gym that no longer has history is dropped silently.
- Forecast model (pure TS in `src/domain/`, no new math dependency):
  `y(t) = P − (P − y0) · e^(−k·t)`, t in days since the first point. For a given k the model is
  linear in (P, y0) → closed-form least squares; search k on a log grid (e.g. 1/1000 … 1/7 per
  day). Constrain P ≥ max observed. Choose the k with the smallest squared error.
- No plateau yet: if the best fit sits at the slow end of the k grid or P > 1.5 × max observed,
  the data is still roughly linear. Then the forecast line and band are still drawn for the
  12-week horizon, but the plateau readout says "Noch kein Plateau erkennbar" instead of a number
  (**Claude's call** — a "Plateau ~300 kg" would be invented certainty). The fit returns this as an
  explicit state; tests include a linear-data case.
- Shown only with ≥ 6 sessions spanning ≥ 28 days; otherwise "Noch zu wenig Daten für eine
  Prognose (x von 6 Einheiten)".
- Forecast horizon 12 weeks, dashed line, band = ± residual standard deviation, widening
  linearly with distance from the last point (**Claude's call**: ×(1 + 0.5 · Δt / data span)).
- Readouts below the chart: estimated plateau P ("Plateau ~112 kg"), current gain per month, and
  number of sessions used. A one-line plain explanation: "Die Kurve flacht ab: je näher du deinem
  Limit kommst, desto langsamer geht es."
- Charts are drawn with `react-native-svg` (new dependency, Expo-supported) and draw in with the
  theme's motion.

### 4.4 Break detection
- On session start, compute days since the last finished workout (any exercise, any gym).
- ≥ 14 days → suggest −10 %; ≥ 56 days → −15 % (**Claude's call** for the second step; Nico set
  the 14-day / ~10 % rule).
- Shown as a banner at the top of the session screen: "Du warst 16 Tage nicht im Gym — heute rund
  10 % leichter starten?" with "Übernehmen" and "Später".
- Übernehmen lowers every *prefilled* weight of this session's seeded sets (not values the user
  already typed) by the factor and rounds down, mirroring `nextWeight` in
  `src/domain/progression.ts` (**Claude's call**): if the old weight was exactly loadable with the
  plate setup, round down to the next loadable barbell weight; otherwise (machines, cables,
  dumbbells — most of Nico's library) round down to a multiple of the progression increment
  (default 2,5 kg). Example: 82,5 kg machine → 74,25 → 72,5 kg. Sets added later in this session get the
  lowered weight as their carry-over.
- While the banner applies, the double-progression hint is suppressed for that session (they
  would contradict each other).
- Shown at most once per session; "Später" dismisses it for that session.

### 4.5 Weekly duel (no server)
- New setting "Dein Name" (used on the card; required before sharing, prompted inline).
- "Wochenkarte teilen" uses React Native's built-in `Share` with a human message plus a code, e.g.
  `Meine Repz-Woche KW 43: 18.400 kg bewegt, 12,4 km Cardio, 4 Einheiten. Code: REPZ1.<payload>`.
  Payload = base64url of compact JSON `{v:1, n, w:"2026-W43", kg, km, s}` plus a short checksum,
  so a mangled paste is detected.
- "Code eingeben": a text field that accepts the whole pasted WhatsApp message and extracts the
  `REPZ1.` code. Rejects: invalid/corrupt code, own code (same name and identical values),
  unknown version. A newer card from the same name for the same week replaces the older one.
- Stored in settings as JSON (device-local, no schema change, not part of backup — friends can
  re-send a code). Keep the last 8 weeks.
- Duel screen: you vs. one friend for the current week (friend picker if several), kg and km head
  to head, a one-line status ("Jonas führt bei den kg, dir fehlen 2.650 kg — etwa eine
  Push-Einheit"), and the code's import time. If the friend's card is for another week, say so.
- **Claude's call — navigation:** the five tabs stay as they are. Heute shows the week goal hero
  and a compact duel card that opens the duel screen (new stack route). The mockup's four-tab
  phone nav was only for showing screens.

## 5. Data and constraints
- Schema stays at **v3**: goals, theme, name and friend cards live in the `settings` key-value
  table. No migration, Nico's device data is untouched.
- Backup format unchanged (settings are device-local by design).
- Read the Expo SDK 57 docs before writing code (repo AGENTS.md). Use `npx expo install` for new
  packages: `react-native-svg`, `@expo-google-fonts/plus-jakarta-sans`, `…/fraunces`,
  `…/dm-sans`, `…/bricolage-grotesque`, `…/jetbrains-mono`, `…/ibm-plex-sans`.
- Mock data never ships in the app; empty states instead.
- UI text German, code/comments English.
- Branch off the current `fix/decimal-comma` (it contains the inline set editor this builds on).
- No EAS build and no versionCode bump until Nico signs off live (process rule from 2026-07).

## 6. Verification (Nico's bar: "perfekt durchgetestet")
- Pure domain logic with unit tests: week totals, streak, goal suggestion, XP/level, e1RM series,
  forecast fit (known synthetic curves recover P and k within tolerance; noisy data; too few
  points; flat data; a single huge outlier), break factor and plate rounding, share-code
  encode/decode/checksum/extraction from a message, own-code rejection, week mismatch.
- Screen tests (RNTL against real SQLite, existing harness) for the new/changed screens.
- `npm run e2e` extended: theme switch, week goal, break banner (seeded old workout), duel import,
  forecast visible with enough seeded history — and the whole run repeated for **each of the four
  themes**, 0 console errors. Repeat runs to prove no flakes.
- Headless screenshots of every main screen × 4 themes, reviewed critically, and compared to the
  mockup.
- Full gate: typecheck, jest, lint, `expo export` Android bundle.
- Honest limits: haptics, real-device performance of animations and Android-native gestures
  cannot be proven in the web preview — listed for Nico's device check.

## 7. Left to the builder
- File layout of theme objects and skinned components, the exact token additions.
- Exact animation curves within the per-theme character above, as long as the mockup's feel holds.
- Phase order (suggested: theme foundation + A → C/D/E → week goal/streak/XP → chart/forecast →
  break detection → duel → verification sweep).
- Copy wording beyond the quoted strings.
