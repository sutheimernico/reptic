// Screenshot sweep of the web preview: every look x two phone sizes. Needs `npx expo start` (web).
//   npm run screenshots                       -> $TMPDIR/reptic-shots/<size>/<look>/<NN-name>.png
//   SHOTS_LOOKS=warm,arcade SHOTS_SIZES=390x844 npm run screenshots   (subset while iterating)
// Never writes into the repo. Uses the same Playwright clock as the e2e (lib/e2e-kit.mjs) so the
// break banner, forecast and week hero are reproducible; "today" moves 16 days per look so the
// break banner shows again for every one.
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BASE, createKit, DAY_MS, daysBefore, de, friendCode, TODAY } from './lib/e2e-kit.mjs';

const OUT = join(tmpdir(), 'reptic-shots');
const ALL_LOOKS = [
  { id: 'evolved', variant: 'evolved', mode: 'Hell' },
  { id: 'evolved-dark', variant: 'evolved', mode: 'Dunkel' },
  { id: 'warm', variant: 'warm' },
  { id: 'arcade', variant: 'arcade' },
  { id: 'instrument', variant: 'instrument' },
];
const ALL_SIZES = ['390x844', '360x800'];
const pick = (env, all, key) =>
  env ? all.filter((x) => env.split(',').includes(key(x))) : all;
const LOOKS = pick(process.env.SHOTS_LOOKS, ALL_LOOKS, (l) => l.id);
const SIZES = pick(process.env.SHOTS_SIZES, ALL_SIZES, (s) => s);
const toViewport = (s) => ({ width: Number(s.split('x')[0]), height: Number(s.split('x')[1]) });

const GYM = 'Fitnessstudio Nord';
const PLAN = 'Push';
const CARDIO = 'Ergometer';
const BRUST = 'Brustpresse';
const BEIN = 'Beinpresse';

const kit = await createKit({ viewport: toViewport(SIZES[0]), clockStart: daysBefore(61), shots: OUT });
const { page, step, check, expectVisible, vis, button, text, field, click, row, goTab, typeInto, settle } = kit;

rmSync(OUT, { recursive: true, force: true });

let counter = 0;
let dir = OUT;
async function snap(name, waitMs = 900) {
  await settle(waitMs);
  counter += 1;
  await page.screenshot({ path: join(dir, `${String(counter).padStart(2, '0')}-${name}.png`) });
}
const goBack = async () => {
  await page.goBack();
  await settle(300);
};
/** Scroll every scrollable area to its end (settings, progress) so the lower half is shot too. */
const scrollToEnd = () =>
  page.evaluate(() => {
    for (const e of document.querySelectorAll('*')) {
      if (e.scrollHeight > e.clientHeight + 40 && getComputedStyle(e).overflowY !== 'visible') {
        e.scrollTop = e.scrollHeight;
      }
    }
  });
const scrollToTop = () =>
  page.evaluate(() => {
    for (const e of document.querySelectorAll('*')) e.scrollTop = 0;
  });

async function selectLook(look) {
  await kit.selectTheme(look.variant);
  if (look.mode) await click(button(look.mode, { exact: true }));
  await settle(300);
}

function isoWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const week = Math.ceil(((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / DAY_MS + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const setDirFor = (size, look) => {
  dir = join(OUT, size, look.id);
  mkdirSync(dir, { recursive: true });
  counter = 0;
};

try {
  // ---- 0. a brand-new install: every look x size -----------------------------------------
  await step('fresh install shots (Heute, Pläne, Verlauf, Übungen, Duell)', async () => {
    await page.goto(BASE, { waitUntil: 'load', timeout: 120000 });
    await expectVisible(vis(page.getByText('Heute', { exact: true })), 'Heute');
    for (const size of SIZES) {
      await page.setViewportSize(toViewport(size));
      for (const look of LOOKS) {
        setDirFor(size, look);
        await selectLook(look);
        await goTab('Heute');
        await snap('fresh-heute');
        await goTab('Pläne');
        await snap('fresh-plaene');
        await goTab('Verlauf');
        await snap('fresh-verlauf');
        await goTab('Übungen');
        await snap('fresh-uebungen');
        await goTab('Heute');
        await click(button('Fordere Freunde heraus'));
        await expectVisible(text('Noch kein Duell', { exact: false }), 'empty duel');
        await snap('fresh-duel');
        await goBack();
      }
    }
  });

  // ---- 1. gym, exercises, plan, goals ----------------------------------------------------
  await step('create gym, cardio exercise, plan, goals', async () => {
    await page.setViewportSize(toViewport(SIZES[0]));
    await selectLook(ALL_LOOKS[0]);
    await goTab('Heute');
    await click(button('Gym wählen'));
    await field('Neues Gym').fill(GYM);
    await click(button('Gym anlegen'));
    await expectVisible(button(`Gym: ${GYM}`), 'gym selected');
    await goTab('Übungen');
    await click(button('Übung hinzufügen'));
    await field('Name').fill(CARDIO);
    await click(button('Cardio', { exact: true }));
    await click(button('Speichern'));
    await goTab('Pläne');
    await click(button('Plan hinzufügen'));
    await field('Name').fill(PLAN);
    await click(vis(page.getByText(BRUST, { exact: true })).last());
    await click(vis(page.getByText(BEIN, { exact: true })).last());
    await click(vis(page.getByText(CARDIO, { exact: true })).last());
    await click(button('Speichern'));
    await expectVisible(text(PLAN, { exact: true }), 'plan in list');
    await goTab('Einstellungen');
    await typeInto(field('Wochenziel (kg)'), '2500');
    await field('Wochenziel (kg)').blur();
    await typeInto(field('Wochenziel Cardio (km)'), '10');
    await field('Wochenziel Cardio (km)').blur();
    await typeInto(field('Dein Name'), 'Nico');
    await field('Dein Name').blur();
  });

  // ---- 2. history over time ----------------------------------------------------------------
  await step('seed history: Brustpresse x9 (rising), Beinpresse x2, one cardio run', async () => {
    const firstKg = () => vis(page.getByLabel('KG', { exact: true })).first();
    const firstReps = () => vis(page.getByLabel('WDH', { exact: true })).first();
    const tick1 = () => vis(page.getByRole('checkbox', { name: 'Satz 1 erledigt' })).first();
    async function session(exercise, weight, reps, cardio = false) {
      await goTab('Heute');
      await click(row(PLAN));
      await click(button("Los geht's"));
      await click(button(`${exercise}, Sätze aufklappen`));
      await typeInto(firstKg(), de(weight));
      await typeInto(firstReps(), String(reps));
      await click(tick1());
      if (cardio) {
        await click(button(`${exercise}, Sätze zuklappen`));
        await click(button(`${CARDIO}, Sätze aufklappen`));
        await typeInto(field('KM'), '5,2');
        await typeInto(field('ZEIT (min:s)'), '25:30');
        await click(vis(page.getByRole('checkbox', { name: 'Satz 1 erledigt' })).last());
      }
      kit.dialogMode = 'accept';
      await click(button('Einheit beenden'));
      await expectVisible(text('Einheit beendet'), 'summary');
      await click(button('Fertig'));
      await expectVisible(vis(page.getByRole('button', { name: /^Gym: / })), 'back on Heute');
    }
    const timeline = [
      [61, BRUST, 82.5, 8, true],
      [60, BRUST, 85, 8],
      [58, BEIN, 140, 10],
      [53, BRUST, 90, 8],
      [46, BRUST, 92.5, 8],
      [39, BRUST, 95, 8],
      [32, BRUST, 97.5, 8],
      [30, BEIN, 150, 10],
      [25, BRUST, 100, 8],
      [20, BRUST, 100, 8],
      [16, BRUST, 102.5, 8],
    ];
    for (const [d, exercise, weight, reps, cardio] of timeline) {
      await page.clock.setSystemTime(daysBefore(d));
      await session(exercise, weight, reps, cardio);
    }
    await page.clock.setSystemTime(TODAY);
  });

  // ---- 3. the data shots: every look x size -------------------------------------------------
  let clockNow = TODAY.getTime();
  let best = 102.5;
  for (const size of SIZES) {
    await page.setViewportSize(toViewport(size));
    for (const look of LOOKS) {
      await step(`data shots ${size} / ${look.id}`, async () => {
        setDirFor(size, look);
        counter = 100; // fresh-install shots keep 01-05, the data shots start at 101
        await page.clock.setSystemTime(new Date(clockNow));
        await selectLook(look);
        await snap('settings-top');
        await scrollToEnd();
        await snap('settings-bottom');
        await scrollToTop();

        // Heute before this week's training, then the session with break banner and PR.
        await goTab('Heute');
        await snap('heute-week-start');
        await click(row(PLAN));
        await click(button("Los geht's"));
        await expectVisible(text(/Du warst \d+ Tage nicht im Gym/), 'break banner');
        await snap('session-break-banner');
        await click(button('Übernehmen', { exact: true }));
        await click(button(`${BRUST}, Sätze aufklappen`));
        await snap('session-expanded-lowered');
        best += 2.5;
        await typeInto(vis(page.getByLabel('KG', { exact: true })).first(), de(best));
        await typeInto(vis(page.getByLabel('WDH', { exact: true })).first(), '8');
        await click(vis(page.getByRole('checkbox', { name: 'Satz 1 erledigt' })).first());
        await page.waitForTimeout(380); // mid-celebration
        counter += 1;
        await page.screenshot({ path: join(dir, `${String(counter).padStart(2, '0')}-session-pr-celebration.png`) });
        await snap('session-pr-settled');
        await click(button('Übung hinzufügen'));
        await snap('add-exercise');
        await goBack();
        await click(button('Einheit beenden'));
        await expectVisible(text('Einheit beendet'), 'summary');
        await snap('workout-summary');
        await click(button('Fertig'));
        await settle(1500);
        await snap('heute-with-data');

        await goTab('Verlauf');
        await snap('verlauf');
        await click(button('Trends öffnen'));
        await snap('trends');
        await goBack();
        await click(button('Kalenderansicht öffnen'));
        await snap('calendar');
        await goBack();
        await click(vis(page.getByRole('button', { name: new RegExp(`${GYM}.*Übung`) })).first());
        await snap('workout-detail');
        await goBack();

        await goTab('Pläne');
        await snap('plaene');
        await click(row(PLAN));
        await snap('plan-edit');
        await goBack();

        await goTab('Übungen');
        await snap('uebungen');
        for (const [name, shot] of [
          [BRUST, 'progress-forecast'],
          [BEIN, 'progress-insufficient'],
        ]) {
          await click(vis(page.getByText(name, { exact: true })).first());
          await click(button('Fortschritt ansehen'));
          await expectVisible(text('geschätztes 1RM (e1RM)', { exact: false }), 'progress loaded');
          await snap(shot, 3800); // the chart draws and fades its forecast in over ~3 s in warm
          await scrollToEnd();
          await snap(`${shot}-bottom`);
          await goBack();
          await snap(`exercise-edit-${name === BRUST ? 'brust' : 'bein'}`);
          await goBack();
        }

        await goTab('Heute');
        await click(button(/^Gym: /));
        await snap('gym-select');
        await goBack();

        // The friend's card for the clock's current week, so the verdict is a real comparison.
        const friend = friendCode({ n: 'Jonas', w: isoWeekKey(new Date(clockNow)), kg: 4200, km: 6.4, s: 3 });
        const duel = vis(page.getByRole('button', { name: /Duell|Fordere/ })).first();
        await click(duel);
        await field('Code eingeben').fill(friend);
        await click(button('Importieren'));
        await expectVisible(text(/Karte von Jonas/), 'friend imported');
        await snap('duel');
        await goBack();
        await goTab('Heute');
        await snap('heute-with-duel');

        clockNow += 16 * DAY_MS; // the next look returns after a break
      });
    }
  }

  await step('no console/page errors during the sweep', async () => {
    check(kit.problems.length === 0, `console/page errors:\n  ${kit.problems.join('\n  ')}`);
  });
} catch (e) {
  if (!kit.failuresCount()) console.log(`  x ${e.message}`);
} finally {
  const ok = await kit.finish();
  console.log(`Screenshots: ${OUT}`);
  if (!ok) process.exit(1);
}
