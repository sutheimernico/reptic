# Themes & Strength Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Four switchable themes (A Evolved, C Warm, D Arcade, E Instrument) with real motion, plus weekly goal/streak/XP, a per-exercise e1RM chart with saturating forecast and gym filter, break detection, and a server-less weekly duel.

**Architecture:** One `AppTheme` object (colors, fonts, shape, motion, variant) from an extended `ThemeProvider`; screens stay single implementations reading tokens; five skinned components switch on `variant`. New logic is pure TS in `src/domain/` with unit tests; thin db queries in `src/db/`; everything new persisted in the `settings` table (schema stays v3).

**Tech Stack:** Expo SDK 57, RN 0.86, TypeScript, expo-router, expo-sqlite, react-native-reanimated 4, new: react-native-svg + @expo-google-fonts/*; jest-expo + RNTL v14 (async API) + Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-10-19-repz-themes-and-strength-insights-design.md` (read it first). Mockup: `docs/superpowers/specs/2026-10-19-repz-designs-v1.html` — CSS per direction: `.dA` (line 87 ff., classes `a*`), `.dC` (348 ff., `c*`), `.dD` (469 ff., `d*`), `.dE` (589 ff., `e*`); screen markup from line 800 ff.

## Global Constraints

- Read https://docs.expo.dev/versions/v57.0.0/ for any Expo API you touch (repo AGENTS.md).
- New packages only via `npx expo install`: `react-native-svg`, `@expo-google-fonts/plus-jakarta-sans`, `@expo-google-fonts/fraunces`, `@expo-google-fonts/dm-sans`, `@expo-google-fonts/bricolage-grotesque`, `@expo-google-fonts/jetbrains-mono`, `@expo-google-fonts/ibm-plex-sans`. No other new dependency (no expo-blur).
- Schema stays `DATABASE_VERSION` 3; no migration. New state lives in `settings` (`getSetting`/`setSetting`).
- "Ticked/performed set" = `performedSql` in `src/db/totals.ts` (reps entered, cardio as today) — never a new definition.
- UI text German; code, identifiers, comments, commits English; Conventional Commits.
- Animate transform/opacity only (reanimated); UI transitions 150–400 ms; celebrations ≤ ~1.2 s and never block input; honour `useReducedMotion()`.
- Mock data never ships; empty states instead.
- RNTL v14: `render`/`fireEvent`/`act` are async (await them). Screen tests live in `src/__tests__/`, never under `src/app/`. After adding a route run `npx expo start` once (or rely on the running dev server) so typed routes regenerate.
- Gate before every commit: `npm run typecheck && npm test && npm run lint`. Stage explicit paths only; check `git branch --show-current` == `feat/themes-insights` before committing.
- No EAS build, no versionCode bump.

## Review Focus

1. A brand-new install with zero workouts: Heute hero, streak, duel card, progress screen, break banner must all show sane empty states (no NaN, no "0 von 0", no crash). → Task 4 + Task 5 + Task 7 tests.
2. Week boundaries in local time: a set finished Sunday 23:30 counts for that week; Monday 00:10 starts a new week with 0 kg and the streak still shows last week's run. → Task 4 tests.
3. Switching theme mid-session (session screen open, rest timer running) must not lose input or reset the timer. → Task 3 screen test + Task 10 e2e.
4. A pasted WhatsApp message with extra text, line breaks or a trailing period around the code must import; a code with one changed character must be rejected with a clear message. → Task 9 tests.
5. Break banner on an exercise whose prefilled weight is empty/0 kg/bodyweight must not produce negative or NaN weights and must leave typed values alone. → Task 8 tests.

---

### Task 1: Theme model, provider and Design picker

**Files:**
- Create: `src/theme/themes.ts`, `src/theme/palettes.ts`, `src/hooks/use-app-theme.ts`, `src/theme/__tests__/themes.test.ts`, `src/components/theme-picker.tsx`
- Modify: `src/theme/theme-provider.tsx`, `src/hooks/use-theme.ts`, `src/constants/theme.ts`, `src/app/(tabs)/settings.tsx`, `src/app/_layout.tsx`
- Test: `src/theme/__tests__/themes.test.ts`, `src/__tests__/theme-picker.test.tsx`

**Interfaces:**
- Produces (`src/theme/themes.ts`):
  - `type ThemeVariant = 'evolved' | 'warm' | 'arcade' | 'instrument'`
  - `type ThemeColor` = today's keys + `accent2 | warning | chartLine | chartBand | grid | celebrate | surfaceStrong`
  - `interface AppTheme { variant: ThemeVariant; scheme: 'light'|'dark'; colors: Record<ThemeColor,string>; fonts: { display: string; body: string; bodyBold: string; numeric: string; label: string }; shape: { radius: { sm: number; md: number; lg: number; xl: number }; borderWidth: number; shadow: 'glow'|'soft'|'hard'|'none' }; motion: { spring: { damping: number; stiffness: number; mass: number }; durationMs: { fast: number; base: number; slow: number }; celebration: 'pill'|'confetti'|'starburst'|'flash' } }`
  - `const THEME_VARIANT_SETTING = 'theme_variant'`
  - `parseThemeVariant(stored: string | null): ThemeVariant` (unknown/null → `'evolved'`)
  - `resolveTheme(variant: ThemeVariant, mode: ThemeMode, system: 'light'|'dark'|null): AppTheme` — only `evolved` honours mode (system→system scheme, null system→light); `warm`/`arcade` always light, `instrument` always dark.
  - `THEME_OPTIONS: { variant: ThemeVariant; name: string; tagline: string }[]` — names `Repz Evolved`, `Warm Athletic`, `Arcade`, `Instrument`.
- Produces: `ThemeContextValue` gains `variant`, `theme: AppTheme`, `setVariant(v)`; `colors` stays (= `theme.colors`). `useTheme()` keeps returning colors. `useAppTheme(): AppTheme` (falls back to `resolveTheme('evolved', 'system', systemScheme)` outside the provider).
- Fonts in this task: use `'System'`-safe placeholders (`undefined` → platform default) — Task 2 fills real families.

- [ ] **Step 1: Write failing tests** in `src/theme/__tests__/themes.test.ts`: `parseThemeVariant(null) === 'evolved'`, `parseThemeVariant('arcade') === 'arcade'`, `parseThemeVariant('neon') === 'evolved'`; `resolveTheme('evolved','dark',null).scheme === 'dark'`; `resolveTheme('evolved','system','dark').scheme === 'dark'`; `resolveTheme('warm','dark','dark').scheme === 'light'`; `resolveTheme('instrument','light','light').scheme === 'dark'`; every variant×scheme has every `ThemeColor` key as a `#rrggbb`/`rgba(...)` string; `THEME_OPTIONS.map(o=>o.variant)` equals the four variants.
- [ ] **Step 2: Run** `npx jest src/theme` → FAIL (module missing).
- [ ] **Step 3: Implement** `palettes.ts` (A light = today's `Colors.light`, A dark = today's `Colors.dark`, plus new keys; C/D/E from the mockup CSS vars: C bg `#F3ECE2` card `#FFFBF6` text `#2B2521` muted `#8C8075` accent `#CF5F3F` accent2 `#7C8C3C`; D bg `#FFF3DC` ink `#161616` accent `#FF4F8B` accent2 `#3EC1FF` warning `#FFCF33` success `#2FD08A` celebrate `#7B5CFF`; E bg `#0E1116` panel `#14171C` line `#232830` text `#D9DEE5` muted `#6B7480` accent `#4DD4EA` accent2 `#F5A524` danger `#FF6B6B` success `#34D399`), shape/motion per spec §3.1 (A radius 12/16/20/28 border 1 glow spring damping 15 stiffness 180; C radius 14/20/26/32 border 0 soft, slow ease (base 320 ms); D radius 10/14/18/22 border 2.5 hard shadow, bouncy damping 9 stiffness 260; E radius 2/3/4/6 border 1 none, linear-ish base 180 ms), then `themes.ts`. Keep `Colors` in `constants/theme.ts` re-exported from palettes for back-compat; keep `Radius` export but mark it as A's radius (screens migrate in Task 2).
- [ ] **Step 4: Extend `ThemeProvider`**: hydrate `theme_variant` alongside `theme_mode`, expose `theme`, `setVariant` (persist via `setSetting`). `_layout.tsx` StatusBar uses `theme.scheme`.
- [ ] **Step 5: Theme picker** `src/components/theme-picker.tsx`: four cards (palette swatches, `name`, `tagline`, accessibilityRole `radio`, `accessibilityState.checked`), tap → `setVariant`. In `settings.tsx` add section "Design" above the existing theme mode control; show the Hell/Dunkel/System control only when `variant === 'evolved'`.
- [ ] **Step 6: Screen test** `src/__tests__/theme-picker.test.tsx` (existing SQLite harness, see `src/__tests__/session-finish.test.tsx` for setup): tap "Instrument" → `getSetting(db,'theme_variant') === 'instrument'` and the mode control is gone; tap "Repz Evolved" → mode control back.
- [ ] **Step 7: Gate + commit** `feat(theme): theme model with four variants and a Design picker`.

### Task 2: Fonts and shape tokens across the shared components

**Files:**
- Create: `src/theme/fonts.ts`
- Modify: `src/theme/palettes.ts` (font families), `src/components/splash-overlay.tsx` or `src/app/_layout.tsx` (load fonts behind splash), `src/components/themed-text.tsx`, `src/components/ui/{button,card,list-row,text-field,segmented-control,empty-state,icon-button,screen}.tsx`, `src/components/set-editor.tsx` (inputs/labels), every file importing `Radius` from `@/constants/theme`
- Test: `src/theme/__tests__/fonts.test.ts`

**Interfaces:**
- Consumes: `useAppTheme()` (Task 1).
- Produces: `FONT_MAP` in `src/theme/fonts.ts` (object passed to `useFonts`), constant family names `FONTS.evolved|warm|arcade|instrument` = `{display, body, bodyBold, numeric, label}`; `ThemedText` gains `variant?: 'display' | 'numeric' | 'label'` mapping to theme fonts (numeric uses `fontVariant: ['tabular-nums']`).

- [ ] **Step 1: Install** `npx expo install @expo-google-fonts/plus-jakarta-sans @expo-google-fonts/fraunces @expo-google-fonts/dm-sans @expo-google-fonts/bricolage-grotesque @expo-google-fonts/jetbrains-mono @expo-google-fonts/ibm-plex-sans`. Families: A Plus Jakarta Sans 400/600/800; C Fraunces 600 (display) + DM Sans 400/700; D Bricolage Grotesque 500/800; E IBM Plex Sans 400/600 (body) + JetBrains Mono 500/700 (numeric, label).
- [ ] **Step 2: Failing test** `fonts.test.ts`: every family name referenced in `FONTS.*` is a key of `FONT_MAP`; no `undefined`.
- [ ] **Step 3: Implement** `fonts.ts`; load with `useFonts(FONT_MAP)` in `_layout.tsx` and keep the splash (`SplashScreen.hideAsync` path in `splash-overlay.tsx`) until loaded or errored (on error log + continue with system fonts — never block the app).
- [ ] **Step 4: Migrate components** to `theme.shape.radius`, `theme.shape.borderWidth`, shadow style (glow = colored shadow with accent at low opacity; soft = neutral drop; hard = `{shadowOffset:{width:3,height:3}, shadowOpacity:1, shadowRadius:0, elevation:0}` + border in ink — on Android emulate hard shadow with an absolutely positioned offset View behind the card; none = no shadow) and fonts. Replace every `Radius.*` import in screens with `useAppTheme().shape.radius`.
- [ ] **Step 5: Verify** gate green; `npm run e2e` still passes (dev server on :8081 must be running; start it with `npx expo start --port 8081` in the background if `curl -s localhost:8081` fails).
- [ ] **Step 6: Commit** `feat(theme): bundled fonts and per-theme shape tokens in shared components`.

### Task 3: Skinned tab bar and the shared motion layer

**Files:**
- Create: `src/theme/motion.ts`, `src/components/motion/{fade-in-list-item,pressable-scale,count-up,check-pop}.tsx`, `src/components/tab-bar/{index,evolved,warm,arcade,instrument}.tsx`
- Modify: `src/app/(tabs)/_layout.tsx` (custom `tabBar`), `src/components/set-editor.tsx` (check pop on tick, row settle), `src/components/rest-timer.tsx` (animated fill), `src/components/plate-sheet.tsx` (sheet in/out), list screens (`(tabs)/exercises.tsx`, `plans.tsx`, `history.tsx`, `session/[id].tsx`) use `FadeInListItem` for first render only
- Test: `src/theme/__tests__/motion.test.ts`, `src/__tests__/theme-switch-session.test.tsx`

**Interfaces:**
- Produces (`src/theme/motion.ts`): `staggerDelay(index: number, theme: AppTheme): number` (capped at 8 items × fast duration), `springFor(theme: AppTheme)` → reanimated `WithSpringConfig`, `timingFor(theme, speed: 'fast'|'base'|'slow')` → `WithTimingConfig` (E uses `Easing.linear`, C `Easing.out(Easing.cubic)`).
- Produces components: `<FadeInListItem index>`, `<PressableScale onPress …>` (scale 0.97 on press, D 0.94), `<CountUp value format>` (plain text when reduced motion), `<CheckPop checked>`.
- `TabBar` API: same props as `@react-navigation/bottom-tabs` `tabBar` render prop; picks variant file. A: floating translucent pill (no blur) with sliding indicator; C: soft pill bar, active tab expands with label; D: chunky outlined bar, active tab raised with offset shadow and accent fill; E: flat bar, numbered labels `01 HEUTE`, top scan line under active tab. Keep the five tabs, titles and accessibility (`role=tab`, selected state) — the e2e relies on tab names.

- [ ] **Step 1: Failing tests** `motion.test.ts`: `staggerDelay(0, A) === 0`, `staggerDelay(20, A) === staggerDelay(8, A)`; `timingFor(E,'base').duration === 180`; `springFor(D).damping < springFor(A).damping`.
- [ ] **Step 2: Implement** motion helpers + components (reduced motion → no movement, opacity only).
- [ ] **Step 3: Tab bar** per variant (match mockup bottom navs; look at `.aTabs/.cTabs/.dTabs/.eTabs` in the mockup).
- [ ] **Step 4: Wire animations** listed in Files. Set tick: `CheckPop` + row background crossfade; no layout animation on inputs while typing.
- [ ] **Step 5: Screen test** `theme-switch-session.test.tsx`: start a session, type `82,5` into KG, change `setVariant('arcade')` via context, field still shows `82,5`, the set row is still there.
- [ ] **Step 6: Gate + e2e green; commit** `feat(motion): skinned tab bars and shared motion components`.

### Task 4: Week stats domain (totals, streak, goal suggestion, XP)

**Files:**
- Create: `src/domain/week-stats.ts`, `src/domain/__tests__/week-stats.test.ts`, `src/db/week-stats.ts`
- Modify: `src/db/index.ts` (export), `src/db/__tests__/queries.test.ts`

**Interfaces:**
- Produces (`src/domain/week-stats.ts`):
  - `const WEEK_GOAL_KG_SETTING = 'week_goal_kg'`, `WEEK_GOAL_KM_SETTING = 'week_goal_km'`
  - `interface WeekProgress { weekKey: string; volumeKg: number; distanceKm: number; sessions: number }`
  - `currentWeekProgress(rows: SessionMuscleTotals[], now: Date): WeekProgress` (reuses `bucketByWeek`; sessions = distinct `finishedAt`)
  - `weekStreak(sessionDates: string[], now: Date): number` — consecutive ISO weeks with ≥1 finished workout; current week counts only if it has one, else start counting at last week.
  - `suggestGoalKg(weeks: WeekTotals[]): number` — median of the last 4 weeks with volume > 0 (excluding the current week), rounded **up** to next 500; none → 10000.
  - `suggestGoalKm(weeks: WeekTotals[]): number | null` — null if no week ever had distance; else median of last 4 weeks with distance, rounded up to whole km; fallback 10.
  - `interface WeekGoal { kg: number; km: number | null; kgIsSuggestion: boolean; kmIsSuggestion: boolean }` and `resolveWeekGoal(storedKg: string|null, storedKm: string|null, weeks: WeekTotals[]): WeekGoal`
  - `xpFor(setCount: number, prCount: number): number` = 10·sets + 50·PRs; `levelFor(xp: number): { level: number; xpIntoLevel: number; xpForNext: number }` where cumulative XP to reach level n = `Math.round(100 * n ** 1.5)` (level 1 starts at 0 XP).
- Produces (`src/db/week-stats.ts`): `getWeekOverview(db, now: Date): Promise<{ progress: WeekProgress; weeks: WeekTotals[]; streak: number; goal: WeekGoal; xp: number }>` — uses `getSessionMuscleTotals` (12-week window) + `SELECT finished_at FROM workouts WHERE finished_at IS NOT NULL` for the streak + count of performed sets and PR sets over all time for XP (PR sets: reuse `sessionRecords`/bests logic if cheap; otherwise count via a query that compares each set to prior bests — implementer's choice, must agree with the badge on the seeded test data). The running (unfinished) workout's performed sets count live in `progress`.

- [ ] **Step 1: Failing tests** (`week-stats.test.ts`), using `new Date(2026, 9, 19, 10)` (Mon) style local dates:
  - Sunday 2026-10-18 23:30 local set counts for week `2026-W42`; Monday 00:10 is `W43` with 0 kg (Review Focus 2).
  - `weekStreak([...W41, W42 dates], Monday W43 morning) === 2`; with a W43 session `=== 3`; gap week → resets; `[]` → 0.
  - `suggestGoalKg` of weeks `[0, 8200, 9100, 0, 12000, 7600]` (current last) → median of 8200,9100,12000 excluding current = 9100 → 9500; empty → 10000.
  - `suggestGoalKm` no distance → null; `[3.2, 5, 0]` → 5 (median of 3.2,5 = 4.1 → up → 5).
  - `resolveWeekGoal('20000', null, weeks)` → `{kg:20000, kgIsSuggestion:false, …}`; `resolveWeekGoal(null,…)` → suggestion flagged; garbage `'abc'` → suggestion.
  - Level = largest n ≥ 1 with `round(100*(n-1)**1.5) <= xp`: `levelFor(0).level===1`, `levelFor(99).level===1`, `levelFor(100).level===2`, `levelFor(282).level===2`, `levelFor(283)` → `{level:3, xpIntoLevel:0, xpForNext:237}` (520−283).
- [ ] **Step 2: Run → FAIL.** **Step 3: Implement domain.** **Step 4: Run → PASS.**
- [ ] **Step 5: Query tests** in `queries.test.ts` (real SQLite harness): seed 2 finished workouts this week + 1 last week + an unfinished one with a performed set → `getWeekOverview` volume includes the live set; empty db → zeros, streak 0, goal suggestion 10000 (Review Focus 1).
- [ ] **Step 6: Gate + commit** `feat(stats): weekly progress, streak, goal suggestion and XP`.

### Task 5: Heute hero, celebrations and goal settings

**Files:**
- Create: `src/components/week-hero/{index,evolved,warm,arcade,instrument}.tsx`, `src/components/celebration/{index,evolved,warm,arcade,instrument}.tsx`, `src/lib/celebrations.ts`
- Modify: `src/app/(tabs)/index.tsx`, `src/app/(tabs)/settings.tsx` (Wochenziel kg / Cardio-km steppers or fields), `src/components/set-editor.tsx` (PR → `<Celebration kind="pr">`), `src/app/session/[id].tsx` (goal reached during session → `<Celebration kind="goal">` once per week per goal)
- Test: `src/__tests__/heute-hero.test.tsx`, `src/lib/__tests__/celebrations.test.ts`

**Interfaces:**
- Consumes: `getWeekOverview` (Task 4), motion components (Task 3), `useAppTheme`.
- Produces: `<WeekHero overview={…} />`; `<Celebration kind: 'pr' | 'goal' label: string visible: boolean onDone() />` (absolute-positioned overlay inside its parent, `pointerEvents="none"`, never modal); `shouldCelebrateGoal(db, goal: 'kg'|'km', weekKey): Promise<boolean>` + `markGoalCelebrated(...)` in `src/lib/celebrations.ts` using settings key `celebrated_<goal>_<weekKey>`.
- Visuals per spec §3.3/2–3 and the mockup "heute" screens: A gradient ring + count-up; C nested rings (kg outer, km inner) + week dots; D level/XP bar + streak flame + quest list (quests: kg goal, km goal if set, "1 Rekord diese Woche"); E segmented gauge + per-day bars Mo–So. Suggestion label "Vorschlag · anpassen" (tap → Einstellungen). km part hidden when `goal.km === null`.

- [ ] **Step 1: Failing tests**: `celebrations.test.ts` — first `shouldCelebrateGoal` true, after `markGoalCelebrated` false, other week true again. `heute-hero.test.tsx` — empty db renders "0 kg" and "Vorschlag · anpassen" without NaN (Review Focus 1); with seeded week volume 18400 and stored goal 25000 shows "18.400" and "25.000"; arcade variant shows "Level"; instrument shows "KW".
- [ ] **Step 2–4:** implement, run → PASS.
- [ ] **Step 5:** settings fields "Wochenziel (kg)" and "Wochenziel Cardio (km)" with German number parsing via `parseWeight`; empty = back to suggestion.
- [ ] **Step 6: Gate + e2e green; commit** `feat(heute): themed week hero, goal settings and celebrations`.

### Task 6: e1RM series and saturating forecast (domain)

**Files:**
- Create: `src/domain/forecast.ts`, `src/domain/__tests__/forecast.test.ts`
- Modify: `src/db/workouts.ts` (new query), `src/db/__tests__/queries.test.ts`

**Interfaces:**
- Produces (`src/domain/forecast.ts`):
  - `interface StrengthPoint { date: string; dayIndex: number; e1rm: number; gymId: number | null; workoutId: number }`
  - `strengthSeries(entries: ExerciseHistoryEntry[]): StrengthPoint[]` — per session max `epleyE1rm` over sets (Epley already returns null for reps > 12 / weight ≤ 0); sessions without a usable set dropped; sorted ascending; `dayIndex` = whole days since first point (local).
  - `const MIN_FORECAST_SESSIONS = 6`, `MIN_FORECAST_SPAN_DAYS = 28`, `FORECAST_HORIZON_DAYS = 84`
  - `type Forecast = { kind: 'insufficient'; sessions: number } | { kind: 'fit'; plateauKg: number | null; k: number; y0: number; sigma: number; gainPerMonthKg: number; curve: { dayIndex: number; value: number; low: number; high: number }[] }` — `plateauKg === null` means "Noch kein Plateau erkennbar".
  - `fitForecast(points: StrengthPoint[]): Forecast`
- Algorithm (fixed by spec §4.3): model `y = P − (P − y0)·e^(−k·t)`; k on a log grid of 60 values from 1/1000 to 1/7; for each k solve 2×2 least squares for (P, y0) with basis `(1 − e^(−kt), e^(−kt))`; reject solutions with `P < max(y)` (clamp P = max(y) and refit y0 alone); pick min SSE. `plateauKg = null` if the chosen k is the smallest grid value or `P > 1.5·max(y)`. `sigma` = sqrt(SSE/(n−2)). Curve: daily-ish points from last dayIndex to +84 (every 7 days), band `±sigma·(1 + 0.5·Δt/span)`. `gainPerMonthKg` = model derivative at the last point × 30.
- Produces (`src/db/workouts.ts`): `interface ExerciseHistoryEntry extends ExerciseSessionEntry { gymId: number | null }` and `getExerciseHistoryAll(db, exerciseId): Promise<ExerciseHistoryEntry[]>` (same performed filter as `getExerciseSessionHistory`, no limit, includes `w.gym_id`, oldest first).

- [ ] **Step 1: Failing tests** (`forecast.test.ts`):
  - synthetic exact curve P=120, y0=80, k=1/60, 10 points over 120 days → `kind 'fit'`, `plateauKg` within ±2 of 120, k within 30 %.
  - same with seeded ±1.5 kg noise (deterministic LCG) → plateau within ±6.
  - linear 80→104 over 120 days → `plateauKg === null`, curve still present.
  - 5 sessions → `{kind:'insufficient', sessions:5}`; 8 sessions over 20 days → insufficient.
  - flat data (all 100) → fit, `plateauKg` ≈ 100, `gainPerMonthKg` ≈ 0, no NaN anywhere.
  - one outlier (a 140 among ~100s) → no NaN, band wider than without it.
  - `strengthSeries` ignores sets with reps 15 or weight 0, picks the session max.
- [ ] **Step 2–4:** implement, run → PASS.
- [ ] **Step 5:** query test for `getExerciseHistoryAll` (gymId present, unfinished workouts excluded, no limit — seed 15 sessions).
- [ ] **Step 6: Gate + commit** `feat(forecast): e1RM series with a saturating forecast`.

### Task 7: Progress screen with chart, ranges and gym filter

**Files:**
- Create: `src/components/strength-chart.tsx`, `src/domain/gym-filter.ts`, `src/domain/__tests__/gym-filter.test.ts`
- Modify: `src/app/exercise/progress.tsx`, `package.json` (`npx expo install react-native-svg`)
- Test: `src/__tests__/exercise-progress.test.tsx`

**Interfaces:**
- Consumes: `getExerciseHistoryAll`, `strengthSeries`, `fitForecast` (Task 6), `getGyms` from `src/db/gyms.ts`.
- Produces (`src/domain/gym-filter.ts`): `gymFilterKey(exerciseId: number): string` → `` `progress_gyms_${exerciseId}` ``; `parseGymFilter(stored: string|null, availableGymIds: number[]): number[] | 'all'` (drops ids no longer available; empty → 'all'); `toggleGym(current: number[]|'all', gymId: number|'all'): number[]|'all'` ('all' and individual gyms mutually exclusive; deselecting the last → 'all'); `applyGymFilter(points, filter)`.
- Range chips 3M/6M/1J/Alles filter by date before fitting? **No** — fit on the full gym-filtered series, the range only crops the visible window (forecast stays stable when toggling range).
- Screen: header current e1RM + change over visible range; `StrengthChart` (svg path for history, dashed forecast, band polygon, plateau guide line + label, theme-styled per variant; E adds grid + readout box; draw-in animation via reanimated `strokeDashoffset`); readouts "Plateau ~112 kg" / "Noch kein Plateau erkennbar", "+2,2 kg pro Monat", "16 Einheiten"; explanation line from spec; insufficient state "Noch zu wenig Daten für eine Prognose (x von 6 Einheiten)". Bodyweight-only and cardio exercises keep today's view (no chart change). Keep today's per-session list below.

- [ ] **Step 1: Failing tests** `gym-filter.test.ts`: parse null → 'all'; parse `'[3,9]'` with available `[3]` → `[3]`; parse `'[9]'` with available `[3]` → 'all'; toggle('all',3) → [3]; toggle([3],3) → 'all'; toggle([3],'all') → 'all'; toggle([3],5) → [3,5].
- [ ] **Step 2: Screen test** `exercise-progress.test.tsx`: seed 8 sessions over 60 days in 2 gyms → shows "Prognose" and plateau/no-plateau text; tap gym chip → settings key stored as JSON array; remount → filter restored; filter to a gym with 2 sessions → "Noch zu wenig Daten".
- [ ] **Step 3–4:** implement, run → PASS.
- [ ] **Step 5: Gate + e2e green; commit** `feat(progress): strength chart with forecast, ranges and saved gym filter`.

### Task 8: Break detection

**Files:**
- Create: `src/domain/break.ts`, `src/domain/__tests__/break.test.ts`, `src/components/break-banner.tsx`
- Modify: `src/db/workouts.ts` (`getLastFinishedWorkoutDate`), `src/app/session/[id].tsx` (banner), `src/components/set-editor.tsx` (apply factor when seeding; suppress progression hint)
- Test: `src/__tests__/break-banner.test.tsx`

**Interfaces:**
- Produces (`src/domain/break.ts`):
  - `breakFactor(daysSinceLast: number | null): number | null` — null days → null (first ever session: no banner); `< 14` → null; `14..55` → 0.9; `≥ 56` → 0.85.
  - `daysBetween(lastIso: string, now: Date): number` (local calendar days).
  - `lowerWeight(kg: number | null, factor: number, incrementKg: number, plates: PlateSetup | null): number | null` — null/≤0 → unchanged; if `solvePlates(kg, plates)?.exact` → `solvePlates(kg*factor, plates).totalKg` (largest loadable ≤ target); else `Math.floor(kg*factor / incrementKg) * incrementKg` rounded to 2 decimals; never below 0. `lowerWeight(82.5, 0.9, 2.5, null) === 72.5`.
  - Settings keys: `break_applied_<workoutId>` = factor string, `break_dismissed_<workoutId>` = '1'.
- `getLastFinishedWorkoutDate(db, excludeWorkoutId): Promise<string | null>`.
- Behaviour: banner on session screen top when factor ≠ null and neither key set. Übernehmen → store applied key; lower every *untouched* set (no reps, not done, not edited — i.e. not performed) of exercises already seeded in this workout; SetEditor seeding for later-opened exercises applies `lowerWeight` to drafts when the applied key exists; progression hint hidden when applied key or banner active. Später → dismissed key. Copy: "Du warst {n} Tage nicht im Gym" / "Heute rund {10|15} % leichter starten?" / buttons "Übernehmen", "Später"; after apply a short confirmation "Gewichte um {10|15} % gesenkt".

- [ ] **Step 1: Failing tests** `break.test.ts`: factor(null)=null, (13)=null, (14)=0.9, (55)=0.9, (56)=0.85; `lowerWeight(82.5,.9,2.5,null)===72.5`; `lowerWeight(100,.9,2.5,DEFAULT_PLATE_SETUP)` is loadable and ≤ 90; `lowerWeight(null,…)===null`; `lowerWeight(0,…)===0`; `lowerWeight(2,.9,2.5,null)===0` (never negative) (Review Focus 5); `daysBetween` across DST change counts calendar days.
- [ ] **Step 2: Screen test** `break-banner.test.tsx`: seed a finished workout 16 days ago with Brustpresse 82,5×8; start a new session → banner text "16 Tage"; tap Übernehmen → expanded exercise KG shows "72,5"; a value typed before tapping stays; progression hint absent; restart screen → no banner. Später path → no banner, weights unchanged. Fresh db first session → no banner.
- [ ] **Step 3–4:** implement, run → PASS.
- [ ] **Step 5: Gate + e2e green; commit** `feat(session): suggest lighter weights after a long break`.

### Task 9: Weekly duel (share code, friends, duel screen)

**Files:**
- Create: `src/domain/week-card.ts`, `src/domain/__tests__/week-card.test.ts`, `src/db/friends.ts` (settings-backed store), `src/app/duel.tsx`, `src/components/duel-visual/{index,evolved,warm,arcade,instrument}.tsx`, `src/components/duel-card.tsx`
- Modify: `src/app/(tabs)/index.tsx` (duel card below hero), `src/app/(tabs)/settings.tsx` ("Dein Name")
- Test: `src/__tests__/duel.test.tsx`

**Interfaces:**
- Produces (`src/domain/week-card.ts`):
  - `interface WeekCard { v: 1; n: string; w: string /* "2026-W43" */; kg: number; km: number; s: number }`
  - `encodeWeekCard(card: WeekCard): string` → `REPZ1.<base64url(json)>.<checksum>` where checksum = 4 base36 chars of a 32-bit FNV-1a over the payload.
  - `type DecodeResult = { ok: true; card: WeekCard } | { ok: false; reason: 'no-code' | 'corrupt' | 'version' }`
  - `extractAndDecode(text: string): DecodeResult` — finds `/REPZ\d+\.[A-Za-z0-9_-]+\.[0-9a-z]{4}/` anywhere (trims trailing punctuation/whitespace/newlines), checks checksum, parses, validates field types; `REPZ2.` → 'version'.
  - `shareMessage(card: WeekCard): string` — `Meine Repz-Woche KW {n}: {kg} kg bewegt, {km} km Cardio, {s} Einheiten. Code: {code}` (German number format via `formatVolume`/`formatDistance`).
  - `duelStatus(me: WeekCard, friend: WeekCard): string` — e.g. "Jonas führt bei den kg, dir fehlen 2.650 kg. Beim Cardio liegst du vorn." / ties / other week: "Jonas' Karte ist von KW 42 — schick ihm deine aktuelle".
- Produces (`src/db/friends.ts`): settings key `friend_cards` JSON `{ card: WeekCard; importedAt: string }[]`; `getFriendCards(db)`, `importFriendCard(db, card, me: {name: string; card: WeekCard}, now): Promise<'added'|'replaced'|'own'>` (own = same name **and** identical kg/km/s/w; replace = same name + same week; keep last 8 weeks); `NAME_SETTING = 'display_name'`.
- Share via RN `Share.share({ message })` (web: copy to clipboard fallback is not available without a dep → on web show the message in the web alert so e2e can read it).
- Duel screen route `/duel`: friend picker if > 1 friend this week; `DuelVisual` skinned (A twin bars, C tug-of-war, D boss HP bars, E split readout with deltas); "Wochenkarte teilen" (asks for name inline if empty); "Code eingeben" text field + "Importieren" with result messages: added "Karte von {n} importiert", own "Das ist deine eigene Karte", corrupt "Der Code ist beschädigt — bitte nochmal kopieren", version "Dieser Code ist von einer neueren Repz-Version", no-code "Kein Repz-Code gefunden".
- Heute duel card: compact (you vs top friend this week) or "Fordere Freunde heraus" CTA when none → opens `/duel`.

- [ ] **Step 1: Failing tests** `week-card.test.ts`: round-trip encode→extract; whole WhatsApp message with prefix text, newline and trailing "." decodes (Review Focus 4); one changed payload char → 'corrupt'; `REPZ2.` → 'version'; random text → 'no-code'; negative/NaN kg in JSON → 'corrupt'; `duelStatus` lead/tie/other-week strings exact.
- [ ] **Step 2: Screen test** `duel.test.tsx`: empty → CTA; import friend code → visual shows both names and "fehlen"; import same twice → replaced (one entry); import own code → message; name required before share.
- [ ] **Step 3–4:** implement, run → PASS.
- [ ] **Step 5: Gate + e2e green; commit** `feat(duel): weekly duel via share codes, no server`.

### Task 10: E2E across all four themes, screenshot sweep, polish

**Files:**
- Modify: `scripts/e2e-smoke.mjs`
- Create: `scripts/screenshots.mjs` (writes to `$TMPDIR/reptic-shots/`, never into the repo)

- [ ] **Step 1:** Extend e2e with: Design picker switch; Heute hero "kg bewegt" after a finished session = Σ weight×reps of the run; goal setting change; break banner and forecast — seed history by having the script build a backup v2 JSON (format: `src/domain/backup.ts`) with sessions 60…16 days back (≥ 8 Brustpresse sessions) and import it via Einstellungen → Import (on web the document picker is a file input: use `page.setInputFiles`; if that is not reachable, report it and seed by a second backup flow instead of skipping); then start a session → banner "16 Tage", progress screen → "Prognose"; duel: the script duplicates the small encoder from `src/domain/week-card.ts` to generate a friend code and asserts the app imports it.
- [ ] **Step 2:** Run the full e2e once per variant (`E2E_THEME=evolved|warm|arcade|instrument`, loop in a `npm run e2e:all` script); 0 console errors; repeat `e2e:all` 3× → all green.
- [ ] **Step 3:** `scripts/screenshots.mjs`: Heute, session (expanded set + PR), progress (with forecast), duel, settings × 4 themes at 390×844; review each image critically against the mockup (spacing, clipping, contrast, font loaded, tab bar not covering content); fix issues; re-run.
- [ ] **Step 4:** Full gate + `npx expo export --platform android` succeeds.
- [ ] **Step 5: Commit** `test(e2e): run the click-through in every theme and add a screenshot sweep` (+ separate `fix:` commits for polish).

### Task 11: Docs

- [ ] Append an **Outcome** section to this plan (what shipped, deviations, open points, device-check list: haptics, animation smoothness, fonts on device, hard shadows on Android).
- [ ] Update `PLAN.md` (new phase entry) and `README.md` (themes, e2e commands).
- [ ] Commit `docs: record themes and strength insights outcome`.
