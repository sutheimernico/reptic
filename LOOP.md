# Reptic — Loop prompt

You are one fresh iteration of the autonomous build loop for **Reptic**, a private
local-first Android gym-tracking app (Expo SDK 57 + RN + TS). Read `AUTOPILOT.md` (repo
root of the workspace) for the global rules, then this file, then `PLAN.md`.

## Do exactly one thing

1. You are on `autopilot/work`. Never commit to `main`; never merge.
2. Pick the SINGLE highest-value open `- [ ]` in `PLAN.md` (top-to-bottom).
3. Implement it with a small, reviewable diff. Match existing repo conventions
   (`src/domain` pure + tested; `src/db` thin; screens thin). Read before writing.
4. Run the gate: `npm run typecheck && npm test && npm run lint`. If red, fix or revert —
   never commit red.
5. On green: commit (Conventional Commits, English, imperative), tick the box in `PLAN.md`,
   append one line to `AUTOPILOT_LOG.md`. Exit.

## Hard rules

- The environment has **no Java / Android SDK** — you cannot build an APK or run on device.
  On-device run, APK/EAS build, and visual sign-off are **Needs Nico**; never fake them.
- `src/domain/**` must stay pure (no native/react imports) so it tests in plain Node.
- Never invent test results or claim a green gate you did not run.
- Keep `Reptic` name in `src/constants/app.ts`; do not hardcode it across screens.
