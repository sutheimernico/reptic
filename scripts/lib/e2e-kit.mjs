// Shared Playwright harness for scripts/e2e-smoke.mjs and scripts/screenshots.mjs.
// A fresh browser context per run = empty expo-sqlite (wasm) storage, so the phone's data is never touched.
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

export const BASE = process.env.E2E_URL ?? 'http://localhost:8081';
export const T = 8000;
export const DAY_MS = 86_400_000;

export const THEMES = {
  evolved: { name: 'Repz Evolved', display: 'PlusJakartaSans_800ExtraBold', header: 'PlusJakartaSans_600SemiBold' },
  warm: { name: 'Warm Athletic', display: 'Fraunces_600SemiBold', header: 'Fraunces_600SemiBold' },
  arcade: { name: 'Arcade', display: 'BricolageGrotesque_800ExtraBold', header: 'BricolageGrotesque_800ExtraBold' },
  instrument: { name: 'Instrument', display: 'IBMPlexSans_600SemiBold', header: 'JetBrainsMono_500Medium' },
};
export const THEME_ORDER = ['evolved', 'warm', 'arcade', 'instrument'];

/**
 * The fixed "today" of the click-through. Everything time dependent (week boundaries, the 16-day
 * break) is laid out relative to it with the Playwright clock, so a run gives the same result on
 * any real date and weekday.
 */
export const TODAY = new Date('2026-11-04T12:00:00+01:00'); // a Wednesday, ISO week 2026-W45
export const TODAY_WEEK_KEY = '2026-W45';
export const daysBefore = (n) => new Date(TODAY.getTime() - n * DAY_MS);

/** Format a number the way the app's fields show it (decimal comma). */
export const de = (n) => String(n).replace('.', ',');

export async function createKit({ viewport = { width: 412, height: 915 }, clockStart = null, shots } = {}) {
  const SHOTS = shots ?? process.env.E2E_SHOTS ?? join(tmpdir(), 'reptic-e2e');
  const browser = await chromium.launch({ headless: !process.env.E2E_HEADED });
  const context = await browser.newContext({
    viewport,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    colorScheme: 'light',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(T);
  if (clockStart) await page.clock.install({ time: clockStart });

  // ---- diagnostics ---------------------------------------------------------
  const problems = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console.error: ${m.text()}`);
  });
  // Native dialogs (lib/web-alert.ts routes Alert.alert to confirm/alert).
  // accept = first non-cancel button, dismiss = cancel.
  const k = { dialogMode: 'accept' };
  const dialogs = [];
  page.on('dialog', async (d) => {
    dialogs.push({ type: d.type(), message: d.message() });
    if (k.dialogMode === 'accept') await d.accept();
    else await d.dismiss();
  });
  const lastDialog = () => dialogs[dialogs.length - 1]?.message ?? '';

  // ---- tiny test harness ---------------------------------------------------
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
  /** The row (button) of a plan/exercise/session; matches the accessible name containing `name`. */
  const row = (name) => vis(page.getByRole('button', { name })).first();

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
  async function typeInto(loc, value, { delay = 40 } = {}) {
    await loc.click();
    // react-native-web runs selectTextOnFocus in a setTimeout(0) after focus. Typing before it
    // fires gets the first character selected and overwritten by the second ("25:30" -> "5:30").
    // A page-side setTimeout(0) queued now runs after it, so the selection is settled.
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
    await loc.press('ControlOrMeta+a');
    await loc.pressSequentially(value, { delay });
    check((await loc.inputValue()) === value, `typed "${value}" into field`);
  }

  /** Let animations (celebrations, count-ups, tab slides) finish before reading or shooting. */
  const settle = (ms = 700) => page.waitForTimeout(ms);

  /** Pick a design card in Einstellungen and wait until it is applied. Ends on Einstellungen. */
  async function selectTheme(variant) {
    const { name } = THEMES[variant];
    await goTab('Einstellungen');
    const radio = vis(page.getByRole('radio', { name, exact: true })).last();
    await click(radio);
    // react-native-web drops accessibilityState.checked on role=radio; the checked card is the one with the 2px border.
    const checked = () => radio.evaluate((e) => /border-width: 2px/.test(e.getAttribute('style') ?? ''));
    for (let i = 0; i < 50 && !(await checked()); i++) await page.waitForTimeout(100);
    check(await checked(), `${name} is the checked design`);
    await settle(500);
  }

  /** The screen title uses the theme's display family, and that family is really loaded. */
  async function expectThemeFont(variant) {
    const { display } = THEMES[variant];
    const state = await page.evaluate(async (family) => {
      await document.fonts.ready;
      const used = [...document.querySelectorAll('*')].some(
        (e) => e.children.length === 0 && getComputedStyle(e).fontFamily.includes(family),
      );
      return { loaded: document.fonts.check(`16px ${family}`), used };
    }, display);
    check(state.used, `${display} is used on screen for ${variant}`);
    check(state.loaded, `${display} is loaded for ${variant}`);
  }

  /** Text of the week hero's accessible summary ("Wochenfortschritt: 1.238 kg von …"). */
  async function heroSummary() {
    const hero = vis(page.locator('[aria-label^="Wochenfortschritt"]')).first();
    await hero.waitFor({ state: 'visible' });
    return hero.getAttribute('aria-label');
  }

  /** Heute reloads its week on focus, so poll until the summary matches instead of reading it once. */
  async function waitHero(pattern, msg) {
    let summary = '';
    for (let i = 0; i < 50; i++) {
      summary = await heroSummary();
      if (pattern.test(summary)) break;
      await page.waitForTimeout(100);
    }
    check(pattern.test(summary), `${msg} (${summary})`);
    return summary;
  }

  /** Fail on any NaN/undefined/[object Object] visible anywhere on the current screen. */
  async function expectNoGarbage(where) {
    const body = await page.evaluate(() => document.body.innerText);
    const bad = body.match(/NaN|undefined|\[object Object\]|Infinity/);
    check(!bad, `no "${bad?.[0]}" on screen at ${where}`);
  }

  /**
   * From Heute: start a session from `plan`, log one strength set (weight x reps) on `exercise`,
   * tick it and finish. Returns after the summary's "Fertig" brought us back to Heute.
   * Pass `stopBeforeFinish` to stay on the running session (rest timer running).
   */
  async function logSession({ plan, exercise, weight, reps, stopBeforeFinish = false }) {
    await goTab('Heute');
    await click(row(plan));
    await click(button("Los geht's"));
    await click(button(`${exercise}, Sätze aufklappen`));
    // Earlier sessions leave a carried-over second row, so address the first set explicitly.
    await typeInto(vis(page.getByLabel('KG', { exact: true })).first(), de(weight));
    await typeInto(vis(page.getByLabel('WDH', { exact: true })).first(), String(reps));
    await click(vis(page.getByRole('checkbox', { name: 'Satz 1 erledigt' })).first());
    await expectVisible(text(/^1\/\d+ Sätze$/), 'set ticked');
    if (stopBeforeFinish) return;
    k.dialogMode = 'accept';
    await click(button('Einheit beenden'));
    await expectVisible(text('Einheit beendet'), 'summary');
    await click(button('Fertig'));
    await expectVisible(vis(page.getByRole('button', { name: /^Gym: / })), 'back on Heute');
  }

  async function finish() {
    if (problems.length && !failures.some((f) => f.startsWith('no console'))) {
      failures.push(`console/page errors:\n  ${problems.join('\n  ')}`);
    }
    await browser.close();
    console.log(`\n${steps} steps, ${assertions} assertions, ${failures.length} failure(s)`);
    if (failures.length) {
      for (const f of failures) console.log(`  x ${f}`);
      return false;
    }
    return true;
  }

  return Object.assign(k, {
    browser,
    context,
    page,
    SHOTS,
    problems,
    dialogs,
    lastDialog,
    step,
    check,
    expectVisible,
    expectGone,
    vis,
    button,
    text,
    tab,
    field,
    doneBox,
    click,
    row,
    goTab,
    expectCount,
    typeInto,
    settle,
    selectTheme,
    expectThemeFont,
    heroSummary,
    waitHero,
    expectNoGarbage,
    logSession,
    finish,
    failuresCount: () => failures.length,
    assertionCount: () => assertions,
  });
}

/** The friend's share code (duplicates the tiny encoder of src/domain/week-card.ts on purpose). */
export function friendCode(card) {
  const json = JSON.stringify({ v: 1, n: card.n, w: card.w, kg: card.kg, km: card.km, s: card.s });
  const payload = Buffer.from(json, 'utf8').toString('base64url');
  let hash = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const sum = (hash % 36 ** 4).toString(36).padStart(4, '0');
  return `REPZ1.${payload}.${sum}`;
}
