// End-to-end click-through of the web preview. Needs `npx expo start` (web) running.
//   npm run e2e                       -> http://localhost:8081
//   E2E_URL=http://host:port npm run e2e   |   E2E_HEADED=1 npm run e2e
// A fresh browser context per run = empty expo-sqlite (wasm) storage, so the
// phone's data is never touched. Exit code 0 = all assertions passed.
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const BASE = process.env.E2E_URL ?? 'http://localhost:8081';
const SHOTS = process.env.E2E_SHOTS ?? join(tmpdir(), 'reptic-e2e');
const T = 8000;

const browser = await chromium.launch({ headless: !process.env.E2E_HEADED });
const context = await browser.newContext({
  viewport: { width: 412, height: 915 },
  locale: 'de-DE',
  colorScheme: 'light',
});
const page = await context.newPage();
page.setDefaultTimeout(T);

// ---- diagnostics -----------------------------------------------------------
const problems = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console.error: ${m.text()}`);
});
// Native dialogs (lib/web-alert.ts routes Alert.alert to confirm/alert).
// accept = first non-cancel button, dismiss = cancel.
let dialogMode = 'accept';
const dialogs = [];
page.on('dialog', async (d) => {
  dialogs.push({ type: d.type(), message: d.message() });
  if (dialogMode === 'accept') await d.accept();
  else await d.dismiss();
});
const lastDialog = () => dialogs[dialogs.length - 1]?.message ?? '';

// ---- tiny test harness -----------------------------------------------------
let steps = 0;
let assertions = 0;
const failures = [];
async function step(name, fn) {
  steps++;
  process.stdout.write(`- ${name} ... `);
  try {
    await fn();
    console.log('ok');
  } catch (e) {
    console.log('FAIL');
    failures.push(`${name}: ${e.message.split('\n')[0]}`);
    mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: `${SHOTS}/fail-${steps}.png` }).catch(() => {});
    throw e;
  }
}
const check = (cond, msg) => {
  assertions++;
  if (!cond) throw new Error(`assertion failed: ${msg}`);
};
async function expectVisible(locator, msg) {
  assertions++;
  try {
    await locator.first().waitFor({ state: 'visible' });
  } catch {
    throw new Error(`not visible: ${msg}`);
  }
}
async function expectGone(locator, msg) {
  assertions++;
  try {
    await locator.first().waitFor({ state: 'hidden' });
  } catch {
    throw new Error(`still visible: ${msg}`);
  }
}

// Tabs/Stack screens stay mounted, so only ever address what is on screen.
const vis = (loc) => loc.filter({ visible: true });
const button = (name, opts = {}) => vis(page.getByRole('button', { name, ...opts })).last();
const text = (t, opts = {}) => vis(page.getByText(t, opts)).last();
const tab = (name) => vis(page.getByRole('tab', { name })).first();
const field = (label) => vis(page.getByLabel(label, { exact: true })).last();
const doneBox = (n) => vis(page.getByRole('checkbox', { name: `Satz ${n} erledigt` })).last();
const click = (loc) => loc.click();
async function goTab(name) {
  await tab(name).click();
  // Header text of the tab screen is unique and visible once it is active.
  await expectVisible(vis(page.getByText(name, { exact: true })), `tab ${name}`);
}
/** Lists reload after navigation and deletes; poll instead of sleeping a fixed time. */
async function expectCount(loc, n, msg) {
  let got = -1;
  for (let i = 0; i < 50; i++) {
    got = await loc.count();
    if (got === n) break;
    await page.waitForTimeout(100);
  }
  check(got === n, `${msg} (got ${got})`);
}
/** Type a value the way a keyboard would (fires onChangeText per key). */
async function typeInto(loc, value) {
  await loc.click();
  // react-native-web runs selectTextOnFocus in a setTimeout(0) after focus. Typing before it
  // fires gets the first character selected and overwritten by the second ("25:30" -> "5:30").
  // A page-side setTimeout(0) queued now runs after it, so the selection is settled.
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
  await loc.press('ControlOrMeta+a');
  await loc.pressSequentially(value, { delay: 40 });
  check((await loc.inputValue()) === value, `typed "${value}" into field`);
}
/** The row (button) of a plan/exercise/session; matches the accessible name containing `name`. */
const row = (name) => vis(page.getByRole('button', { name })).first();

const GYM = 'E2E Gym';
const PLAN = 'E2E Push';
const STRENGTH = 'Brustpresse';
const CARDIO = 'E2E Ergometer';

try {
  // ---- 1. load -------------------------------------------------------------
  await step('app loads on Heute without errors', async () => {
    await page.goto(BASE, { waitUntil: 'load', timeout: 120000 }); // first hit may wait on the Metro bundle
    await expectVisible(vis(page.getByText('Heute', { exact: true })), 'Heute title');
    await expectVisible(button('Gym wählen'), 'Gym wählen row (no gym yet)');
    await expectVisible(text('Noch keine Pläne'), 'empty plans state');
    check((await button("Los geht's").isDisabled()) === true, "Los geht's disabled without gym/plan");
  });

  // ---- 2a. gym -------------------------------------------------------------
  await step('create gym via inline "Gym wählen" flow', async () => {
    await click(button('Gym wählen'));
    await expectVisible(text('Leg dein erstes Gym an', { exact: false }), 'first-gym hint');
    await field('Neues Gym').fill(GYM);
    await click(button('Gym anlegen'));
    await expectVisible(button(`Gym: ${GYM}`), 'Heute shows selected gym');
  });

  // ---- 2b. custom cardio exercise -----------------------------------------
  await step(`create Cardio exercise "${CARDIO}"`, async () => {
    await goTab('Übungen');
    await click(button('Übung hinzufügen'));
    await field('Name').fill(CARDIO);
    await click(button('Cardio', { exact: true }));
    await click(button('Speichern'));
    await goTab('Übungen');
    await expectVisible(text(CARDIO, { exact: true }), 'cardio exercise in list');
  });

  // ---- 2c. plan ------------------------------------------------------------
  await step('create plan with 1 strength + 1 cardio exercise', async () => {
    await goTab('Pläne');
    await expectVisible(text('Noch keine Pläne'), 'empty plans tab');
    await click(button('Plan hinzufügen'));
    await field('Name').fill(PLAN);
    await expectVisible(text('Übungen (0)'), 'zero exercises selected');
    await click(button(STRENGTH, { exact: true }).or(vis(page.getByText(STRENGTH, { exact: true }))).last());
    await expectVisible(text('Übungen (1)'), 'one exercise selected');
    await click(vis(page.getByText(CARDIO, { exact: true })).last());
    await expectVisible(text('Übungen (2)'), 'two exercises selected');
    await click(button('Speichern'));
    await expectVisible(text(PLAN, { exact: true }), 'plan in list');
    await expectVisible(text('2 Übungen'), 'plan shows 2 Übungen');
  });

  // ---- 2d. session from plan ----------------------------------------------
  await step('start session from plan on Heute', async () => {
    await goTab('Heute');
    await click(row(PLAN));
    await click(button("Los geht's"));
    await expectVisible(text(`Einheit · ${GYM}`), 'session header with gym');
    await expectVisible(button(`${STRENGTH}, Sätze aufklappen`), 'strength row');
    await expectVisible(button(`${CARDIO}, Sätze aufklappen`), 'cardio row');
  });

  await step('strength: open inline, enter 82,5 kg x 8, tick done', async () => {
    await click(button(`${STRENGTH}, Sätze aufklappen`));
    await expectVisible(button(`${STRENGTH}, Sätze zuklappen`), 'row expanded');
    await expectVisible(field('KG'), 'SetEditor KG field');
    await typeInto(field('KG'), '82,5');
    await typeInto(field('WDH'), '8');
    check((await field('KG').inputValue()) === '82,5', 'KG field keeps decimal comma');
    await click(doneBox(1));
    await expectVisible(text('1/1 Sätze'), 'progress 1/1');
  });

  await step('add a second strength set (carries weight over)', async () => {
    await click(text('Satz', { exact: true }));
    await expectVisible(doneBox(2), 'second set row');
    const kgs = vis(page.getByLabel('KG', { exact: true }));
    check((await kgs.count()) === 2, 'two KG fields');
    check((await kgs.nth(1).inputValue()) === '82,5', 'set 2 pre-filled with 82,5');
    await typeInto(vis(page.getByLabel('WDH', { exact: true })).nth(1), '7');
    await click(doneBox(2));
    await expectVisible(text('2/2 Sätze'), 'progress 2/2');
  });

  await step('cardio: km / mm:ss / Stufe, tick done', async () => {
    await click(button(`${STRENGTH}, Sätze zuklappen`));
    await click(button(`${CARDIO}, Sätze aufklappen`));
    await expectVisible(field('KM'), 'cardio KM field');
    await typeInto(field('KM'), '5,2');
    await typeInto(field('ZEIT (min:s)'), '25:30');
    await typeInto(field('STUFE'), '7');
    await field('STUFE').blur();
    const tv = await field('ZEIT (min:s)').inputValue();
    check((await field('KM').inputValue()) === '5,2', 'KM stays 5,2');
    check((await field('STUFE').inputValue()) === '7', 'Stufe stays 7');
    check(tv === '25:30', `time stays 25:30 (got "${tv}")`);
    await click(doneBox(1));
    await expectVisible(text('1/1 Sätze'), 'cardio progress 1/1');
  });

  await step('finish session -> summary', async () => {
    dialogMode = 'accept';
    await click(button('Einheit beenden'));
    check(lastDialog().startsWith('Einheit beenden?'), `confirm dialog shown (got "${lastDialog()}")`);
    await expectVisible(text('Einheit beendet'), 'summary header');
    await expectVisible(text('ÜBUNGEN', { exact: true }), 'summary tile ÜBUNGEN');
    await click(button('Fertig'));
    await expectVisible(button(`Gym: ${GYM}`), 'back on Heute');
  });

  // ---- 3. Verlauf ----------------------------------------------------------
  await step('Verlauf lists the session; detail -> exercise progress shows 82,5 kg', async () => {
    await goTab('Verlauf');
    await expectGone(text('Noch kein Verlauf'), 'empty history state');
    const sessionRow = vis(page.getByRole('button', { name: new RegExp(`${GYM}.*2 Übungen`) })).first();
    await expectVisible(sessionRow, 'session row with gym + 2 Übungen');
    await click(sessionRow);
    await expectVisible(text('Zusammenfassung', { exact: true }), 'detail screen');
    await expectVisible(text('82,5', { exact: false }), 'detail lists 82,5 weight');
    await click(button(`${STRENGTH}: Fortschritt ansehen`));
    await expectVisible(text('82,5 kg', { exact: true }), 'progress top weight 82,5 kg');
  });

  // ---- 4. second session ---------------------------------------------------
  await step('second session: "letztes Mal" reference + prefilled weight', async () => {
    await page.goto(BASE, { waitUntil: 'load' }); // fresh nav stack; storage persists in context
    await expectVisible(button(`Gym: ${GYM}`), 'gym persisted across reload');
    await click(row(PLAN));
    await click(button("Los geht's"));
    await click(button(`${STRENGTH}, Sätze aufklappen`));
    const kgs = vis(page.getByLabel('KG', { exact: true }));
    await expectVisible(kgs, 'KG fields');
    check((await kgs.count()) === 2, 'both sets seeded from last session');
    check((await kgs.nth(0).inputValue()) === '82,5', 'set 1 KG prefilled with 82,5');
    await expectVisible(text('letztes Mal: 82,5 kg × 8'), 'reference line for set 1');
    await expectVisible(text('letztes Mal: 82,5 kg × 7'), 'reference line for set 2');
  });

  await step('0 kg / bodyweight set is accepted and counted', async () => {
    await typeInto(vis(page.getByLabel('KG', { exact: true })).nth(1), '0');
    await typeInto(vis(page.getByLabel('WDH', { exact: true })).nth(1), '12');
    await click(doneBox(2));
    await expectVisible(text('1/2 Sätze'), 'progress with 0 kg set ticked');
  });

  await step('swipe-to-delete / remove exercise from session', async () => {
    const swipe = async (rowName) => {
      const box = await row(rowName).boundingBox();
      check(box !== null, `row "${rowName}" has a bounding box`);
      const y = box.y + box.height / 2;
      await page.mouse.move(box.x + 20, y);
      await page.mouse.down();
      for (let dx = 20; dx <= 300; dx += 40) await page.mouse.move(box.x + dx, y, { steps: 2 });
      await page.mouse.up();
    };
    // Cardio has no ticked sets -> removed without a dialog.
    await swipe(`${CARDIO}, Sätze`);
    await expectGone(page.getByRole('button', { name: `${CARDIO}, Sätze aufklappen` }), 'cardio row removed by swipe');
    // Strength row has a ticked set -> asks first; cancel keeps it.
    dialogMode = 'dismiss';
    await swipe(`${STRENGTH}, Sätze`);
    for (let i = 0; i < 30 && !lastDialog().startsWith('Übung entfernen?'); i++) await page.waitForTimeout(100);
    check(lastDialog().startsWith('Übung entfernen?'), `remove confirm shown (got "${lastDialog()}"; all: ${JSON.stringify(dialogs.map((d) => d.message.slice(0, 25)))})`);
    await expectVisible(button(`${STRENGTH}, Sätze`), 'strength row kept after cancel');
    dialogMode = 'accept';
  });

  await step('finish session with 0 kg set -> history now has 2 sessions', async () => {
    await click(button('Einheit beenden'));
    await expectVisible(text('Einheit beendet'), 'summary');
    await click(button('Fertig'));
    await goTab('Verlauf');
    const rows = vis(page.getByRole('button', { name: new RegExp(`${GYM}.*Übung`) }));
    await expectCount(rows, 2, '2 sessions in Verlauf');
  });

  await step('empty session start + discard leaves no history entry', async () => {
    await goTab('Heute');
    await click(button('Leere Einheit starten'));
    await expectVisible(text('Noch keine Übungen'), 'empty session screen');
    dialogMode = 'accept'; // first action = "Verwerfen"
    await click(button('Einheit beenden'));
    check(lastDialog().startsWith('Noch kein Satz abgehakt'), `discard dialog (got "${lastDialog()}")`);
    await expectVisible(button(`Gym: ${GYM}`), 'back on Heute after discard');
    await goTab('Verlauf');
    await page.waitForTimeout(300);
    const rows = vis(page.getByRole('button', { name: new RegExp(`${GYM}.*Übung`) }));
    check((await rows.count()) === 2, `still 2 sessions after discard (got ${await rows.count()})`);
  });

  await step('delete a session from its detail screen', async () => {
    const first = vis(page.getByRole('button', { name: new RegExp(`${GYM}.*Übung`) })).first();
    await click(first);
    await expectVisible(text('Zusammenfassung', { exact: true }), 'detail screen');
    dialogMode = 'accept';
    await click(button('Einheit löschen'));
    check(lastDialog().startsWith('Einheit löschen?'), `delete confirm (got "${lastDialog()}")`);
    const rows = vis(page.getByRole('button', { name: new RegExp(`${GYM}.*Übung`) }));
    await expectCount(rows, 1, '1 session left');
  });

  await step('theme toggle in Einstellungen (Dunkel / Hell / System)', async () => {
    await goTab('Einstellungen');
    const bg = () =>
      page.evaluate(() => {
        // Walk up from the title to the first element with an opaque background.
        const el = [...document.querySelectorAll('*')].find((e) => e.textContent === 'Einstellungen' && e.children.length === 0);
        for (let n = el; n; n = n.parentElement) {
          const c = getComputedStyle(n).backgroundColor;
          if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
        }
        return '';
      });
    await click(button('Hell', { exact: true }));
    const light = await bg();
    await click(button('Dunkel', { exact: true }));
    await page.waitForTimeout(300);
    const dark = await bg();
    check(light !== '' && dark !== '' && light !== dark, `background changes light(${light}) vs dark(${dark})`);
    // react-native-web drops aria-selected on role=button; the active segment is the one with an inline accent background.
    const filled = (name) =>
      button(name, { exact: true }).evaluate((e) => /background-color/.test(e.getAttribute('style') ?? ''));
    check((await filled('Dunkel')) && !(await filled('Hell')), 'Dunkel is the active segment');
    await click(button('System', { exact: true }));
  });

  await step('arcade theme: no screen is offset sideways after tab switches', async () => {
    await click(vis(page.getByRole('radio', { name: 'Arcade' })).last());
    for (const name of ['Heute', 'Verlauf', 'Einstellungen', 'Heute']) {
      await goTab(name);
      await page.waitForTimeout(500);
      const title = await vis(page.getByText(name, { exact: true })).first().boundingBox();
      check(title !== null && title.x >= 16, `${name} title not clipped at the left (x=${title?.x})`);
      const scrolled = await page.evaluate(
        () => [...document.querySelectorAll('*')].filter((e) => e.scrollLeft > 0).length,
      );
      check(scrolled === 0, `no container scrolled sideways after switching to ${name} (${scrolled})`);
    }
    // The offset used to appear when coming back to the tabs from a pushed screen.
    await goTab('Pläne');
    await click(button('Plan hinzufügen'));
    await field('Name').fill('Arcade Plan');
    await click(button('Speichern'));
    await goTab('Heute');
    await page.waitForTimeout(800);
    const back = await vis(page.getByText('Heute', { exact: true })).first().boundingBox();
    check(back !== null && back.x >= 16, `Heute title not clipped after saving a plan (x=${back?.x})`);
    const scrolledBack = await page.evaluate(
      () => [...document.querySelectorAll('*')].filter((e) => e.scrollLeft > 0).length,
    );
    check(scrolledBack === 0, `no container scrolled sideways after saving a plan (${scrolledBack})`);
    await goTab('Einstellungen');
    await click(vis(page.getByRole('radio', { name: 'Repz Evolved' })).last());
  });

  await step('gym listed in Einstellungen; archive offered (has workouts)', async () => {
    await expectVisible(text(GYM, { exact: true }), 'gym in settings');
    await click(row(GYM));
    await expectVisible(button('Archivieren'), 'Archivieren (gym has history)');
  });

  await step('duel: CTA on Heute, name prompt, share code, own code rejected, friend imported', async () => {
    await page.goBack(); // leave the gym edit screen the previous step ended on
    await goTab('Heute');
    await click(button('Fordere Freunde heraus'));
    await expectVisible(text('Noch kein Duell', { exact: false }), 'empty duel state');
    await click(button('Wochenkarte teilen'));
    await typeInto(field('Dein Name'), 'E2E Jörg');
    await click(button('Name speichern und teilen'));
    await expectVisible(button('Wochenkarte teilen'), 'share button back after naming');
    const shared = lastDialog();
    check(/Meine Repz-Woche KW \d+: .* Code: REPZ1\.[A-Za-z0-9_-]+\.[0-9a-z]{4}/.test(shared), `share message (${shared})`);
    const own = shared.match(/REPZ1\.[A-Za-z0-9_-]+\.[0-9a-z]{4}/)[0];
    await typeInto(field('Code eingeben'), `[12:00] Jörg: Hier meine Karte. ${own}.`);
    await click(button('Importieren'));
    await expectVisible(text('Das ist deine eigene Karte'), 'own card rejected');
    const friendCode = 'REPZ1.eyJ2IjoxLCJuIjoiSm9uYXMiLCJ3IjoiMjAyNi1XNDMiLCJrZyI6MjEwNTAsImttIjo4LjEsInMiOjV9.v1eu';
    await typeInto(field('Code eingeben'), friendCode.slice(0, -1) + 'x');
    await click(button('Importieren'));
    await expectVisible(text('Der Code ist beschädigt', { exact: false }), 'corrupt code rejected');
    await typeInto(field('Code eingeben'), friendCode);
    await click(button('Importieren'));
    await expectVisible(text('Karte von Jonas importiert'), 'friend imported');
    await expectVisible(text('Jonas', { exact: true }), 'friend name in the visual');
    await page.screenshot({ path: `${SHOTS}/duel.png` }).catch(() => {});
    await page.goBack();
    await expectVisible(text('Duell mit Jonas'), 'Heute duel card with the friend');
  });

  await step('no console/page errors during the whole run', async () => {
    check(problems.length === 0, `console/page errors:\n  ${problems.join('\n  ')}`);
  });
} catch (e) {
  if (!failures.length) failures.push(e.message);
} finally {
  if (problems.length && !failures.some((f) => f.startsWith('no console'))) {
    failures.push(`console/page errors:\n  ${problems.join('\n  ')}`);
  }
  await browser.close();
  console.log(`\n${steps} steps, ${assertions} assertions, ${failures.length} failure(s)`);
  if (failures.length) {
    for (const f of failures) console.log(`  x ${f}`);
    process.exit(1);
  }
  console.log('E2E OK');
}
