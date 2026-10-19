// End-to-end click-through of the web preview. Needs `npx expo start` (web) running.
//   npm run e2e                       -> http://localhost:8081, theme "evolved"
//   E2E_THEME=warm|arcade|instrument|evolved-dark npm run e2e
//   npm run e2e:all                   -> once per theme
//   E2E_URL=http://host:port npm run e2e   |   E2E_HEADED=1 npm run e2e
// Time runs on a Playwright clock (see TODAY in lib/e2e-kit.mjs): the click-through starts 61 days
// before "today", seeds a Brustpresse history through the UI, then jumps to today so the 16-day
// break banner and the forecast are reproducible. (Backup import is not reachable on web: the app
// answers "Im Browser nicht verfügbar", so the history is seeded by real sessions instead.)
// Exit code 0 = all assertions passed.
import {
  createKit,
  daysBefore,
  de,
  friendCode,
  THEME_ORDER,
  THEMES,
  TODAY,
  TODAY_WEEK_KEY,
  BASE,
} from './lib/e2e-kit.mjs';

const [VARIANT, MODE_SUFFIX] = (process.env.E2E_THEME ?? 'evolved').split('-');
const DARK = MODE_SUFFIX === 'dark';
if (!THEMES[VARIANT] || (MODE_SUFFIX && !(DARK && VARIANT === 'evolved'))) {
  console.error(`Unknown E2E_THEME "${process.env.E2E_THEME}" (evolved|warm|arcade|instrument|evolved-dark)`);
  process.exit(2);
}
console.log(`E2E theme: ${DARK ? 'evolved (dark)' : VARIANT}`);

const kit = await createKit({ clockStart: daysBefore(61) });
const {
  page, step, check, expectVisible, expectGone, vis, button, text, field, doneBox, click, row, goTab,
  expectCount, typeInto, settle, selectTheme, expectThemeFont, heroSummary, waitHero, expectNoGarbage, logSession,
  lastDialog, dialogs,
} = kit;

const GYM = 'E2E Gym';
const PLAN = 'E2E Push';
const STRENGTH = 'Brustpresse';
const CARDIO = 'E2E Ergometer';
const parseKg = (s) => Number(s.replace(',', '.'));

try {
  // ---- 1. load -------------------------------------------------------------
  await step('app loads on Heute without errors, empty hero is sane', async () => {
    await page.goto(BASE, { waitUntil: 'load', timeout: 120000 }); // first hit may wait on the Metro bundle
    await expectVisible(vis(page.getByText('Heute', { exact: true })), 'Heute title');
    await expectVisible(button('Gym wählen'), 'Gym wählen row (no gym yet)');
    await expectVisible(text('Noch keine Pläne'), 'empty plans state');
    check((await button("Los geht's").isDisabled()) === true, "Los geht's disabled without gym/plan");
    check(/^Wochenfortschritt: 0 kg von [\d.]+ kg$/.test(await heroSummary()), 'empty week hero reads 0 kg');
    await expectNoGarbage('empty Heute');
  });

  // ---- 1b. design picker ---------------------------------------------------
  await step(`design picker: switch to ${THEMES[VARIANT].name}${DARK ? ' (dark)' : ''}`, async () => {
    await selectTheme(VARIANT);
    if (DARK) {
      await click(button('Dunkel', { exact: true }));
      await settle(400);
    } else if (VARIANT === 'evolved') {
      await click(button('Hell', { exact: true }));
    }
    await expectThemeFont(VARIANT);
    await goTab('Heute');
    await expectNoGarbage('Heute after switching design');
    check(/^Wochenfortschritt: 0 kg/.test(await heroSummary()), 'hero survives the design switch');
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
    // A first-ever session has no history: no break banner.
    check((await page.getByText(/Tage nicht im Gym/).count()) === 0, 'no break banner on the very first session');
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

  await step('finish session -> summary -> Heute hero shows the kg moved', async () => {
    kit.dialogMode = 'accept';
    await click(button('Einheit beenden'));
    check(lastDialog().startsWith('Einheit beenden?'), `confirm dialog shown (got "${lastDialog()}")`);
    await expectVisible(text('Einheit beendet'), 'summary header');
    await expectVisible(text('ÜBUNGEN', { exact: true }), 'summary tile ÜBUNGEN');
    await click(button('Fertig'));
    await expectVisible(button(`Gym: ${GYM}`), 'back on Heute');
    // 82,5 x 8 + 82,5 x 7 = 1237,5 kg -> shown rounded; the cardio half appears once cardio exists.
    await waitHero(/^Wochenfortschritt: 1\.238 kg von [\d.]+ kg, 5,2 km von /, 'hero sums the run');
    // The number counts up (up to ~1 s in the calm themes): poll instead of sleeping.
    let body = '';
    for (let i = 0; i < 40 && !body.includes('1.238'); i++) {
      body = await page.evaluate(() => document.body.innerText);
      if (!body.includes('1.238')) await page.waitForTimeout(100);
    }
    check(body.includes('1.238'), 'hero text shows 1.238 after the count-up');
    await expectNoGarbage('Heute with data');
  });

  // ---- 3. Verlauf ----------------------------------------------------------
  await step('Verlauf lists the session; detail -> exercise progress (1 session = no forecast yet)', async () => {
    await goTab('Verlauf');
    await expectGone(text('Noch kein Verlauf'), 'empty history state');
    const sessionRow = vis(page.getByRole('button', { name: new RegExp(`${GYM}.*2 Übungen`) })).first();
    await expectVisible(sessionRow, 'session row with gym + 2 Übungen');
    await click(sessionRow);
    await expectVisible(text('Zusammenfassung', { exact: true }), 'detail screen');
    await expectVisible(text('82,5', { exact: false }), 'detail lists 82,5 weight');
    await click(button(`${STRENGTH}: Fortschritt ansehen`));
    await expectVisible(text('82,5 kg', { exact: true }), 'progress top weight 82,5 kg');
    await expectVisible(text('Noch zu wenig Daten für eine Prognose', { exact: false }), 'forecast says insufficient');
    await expectNoGarbage('progress with one session');
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

  await step('switching the design mid-session keeps typed input and the running rest timer', async () => {
    const timer = () => vis(page.getByLabel(/^Pause, noch \d+ Sekunden/)).first();
    const remaining = async () => Number((await timer().getAttribute('aria-label')).match(/(\d+)/)[1]);
    await expectVisible(timer(), 'rest timer running after the ticked set');
    // A typed-but-unticked value (no reps, so it is not a performed set) must survive too.
    await typeInto(vis(page.getByLabel('KG', { exact: true })).nth(0), '91');
    const before = await remaining();
    await page.goBack(); // leave the session; it stays open and the timer lives in the app root
    // Every design in turn, ending on the one under test.
    const cycle = [...THEME_ORDER.filter((v) => v !== VARIANT), VARIANT];
    for (const variant of cycle) {
      await selectTheme(variant);
      await expectThemeFont(variant);
    }
    if (DARK) await click(button('Dunkel', { exact: true }));
    await goTab('Heute');
    await click(button('Weiter zur Einheit'));
    await expectVisible(timer(), 'rest timer survived the design switches');
    const after = await remaining();
    check(after < before && after > 0, `timer kept running: ${before}s -> ${after}s (not restarted)`);
    if (await button(`${STRENGTH}, Sätze aufklappen`).isVisible()) {
      await click(button(`${STRENGTH}, Sätze aufklappen`));
    }
    const kgs = vis(page.getByLabel('KG', { exact: true }));
    await expectVisible(kgs, 'KG fields after returning');
    check((await kgs.nth(0).inputValue()) === '91', 'typed 91 kg survived the design switches');
    check((await kgs.nth(1).inputValue()) === '0', 'ticked 0 kg set survived');
    await expectVisible(text('1/2 Sätze'), 'progress unchanged after the switches');
    // Put the prefilled weight back so the later steps see the original numbers.
    await typeInto(kgs.nth(0), '82,5');
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
    kit.dialogMode = 'dismiss';
    await swipe(`${STRENGTH}, Sätze`);
    for (let i = 0; i < 30 && !lastDialog().startsWith('Übung entfernen?'); i++) await page.waitForTimeout(100);
    check(lastDialog().startsWith('Übung entfernen?'), `remove confirm shown (got "${lastDialog()}"; all: ${JSON.stringify(dialogs.map((d) => d.message.slice(0, 25)))})`);
    await expectVisible(button(`${STRENGTH}, Sätze`), 'strength row kept after cancel');
    kit.dialogMode = 'accept';
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
    kit.dialogMode = 'accept'; // first action = "Verwerfen"
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
    kit.dialogMode = 'accept';
    await click(button('Einheit löschen'));
    check(lastDialog().startsWith('Einheit löschen?'), `delete confirm (got "${lastDialog()}")`);
    const rows = vis(page.getByRole('button', { name: new RegExp(`${GYM}.*Übung`) }));
    await expectCount(rows, 1, '1 session left');
  });

  // ---- 5. settings ---------------------------------------------------------
  await step('Darstellung (Dunkel / Hell / System) exists for evolved only', async () => {
    await goTab('Einstellungen');
    const darstellung = vis(page.getByText('DARSTELLUNG', { exact: true }));
    if (VARIANT !== 'evolved') {
      check((await darstellung.count()) === 0, `${VARIANT} is single-scheme: no Darstellung control`);
      return;
    }
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
    await click(button(DARK ? 'Dunkel' : 'Hell', { exact: true })); // back to the mode under test
  });

  await step('arcade theme: no screen is offset sideways after tab switches', async () => {
    await selectTheme('arcade');
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
    await selectTheme(VARIANT);
    if (DARK) await click(button('Dunkel', { exact: true }));
  });

  await step('week goals: change both goals in Einstellungen -> Heute hero follows', async () => {
    await goTab('Einstellungen');
    await typeInto(field('Wochenziel (kg)'), '2000');
    await field('Wochenziel (kg)').blur();
    await typeInto(field('Wochenziel Cardio (km)'), '8');
    await field('Wochenziel Cardio (km)').blur();
    await settle(300);
    await goTab('Heute');
    const want = 'Wochenfortschritt: 1.238 kg von 2.000 kg, 5,2 km von 8 km';
    await waitHero(new RegExp(`^${want}$`), 'hero follows the goals');
    check((await page.getByText('Vorschlag · anpassen').count()) === 0, 'no "Vorschlag" hint once a goal is set');
  });

  await step('gym listed in Einstellungen; archive offered (has workouts)', async () => {
    await goTab('Einstellungen');
    await expectVisible(text(GYM, { exact: true }), 'gym in settings');
    await click(row(GYM));
    await expectVisible(button('Archivieren'), 'Archivieren (gym has history)');
    await page.goBack();
  });

  // ---- 6. history over time (Playwright clock) -------------------------------
  await step('seed 8 more Brustpresse sessions 60..16 days back, then jump to today', async () => {
    const history = [
      [60, 85], [53, 90], [46, 92.5], [39, 95], [32, 97.5], [25, 100], [20, 100], [16, 102.5],
    ];
    for (const [d, weight] of history) {
      await page.clock.setSystemTime(daysBefore(d));
      await logSession({ plan: PLAN, exercise: STRENGTH, weight, reps: 8 });
    }
    await page.clock.setSystemTime(TODAY);
    await goTab('Verlauf');
    const rows = vis(page.getByRole('button', { name: new RegExp(`${GYM}.*Übung`) }));
    await expectCount(rows, 9, '9 sessions in Verlauf');
    await goTab('Heute');
    await waitHero(/^Wochenfortschritt: 0 kg von 2\.000 kg/, 'new week starts at 0 kg');
    await expectNoGarbage('Heute on a new week');
  });

  await step('progress: forecast for 9 rising sessions', async () => {
    await goTab('Verlauf');
    await click(vis(page.getByRole('button', { name: new RegExp(`${GYM}.*Übung`) })).first());
    await click(button(`${STRENGTH}: Fortschritt ansehen`));
    await expectVisible(text('geschätztes 1RM (e1RM)', { exact: false }), 'e1RM headline');
    await expectVisible(text('Prognose', { exact: true }), 'Prognose heading');
    await expectVisible(text('pro Monat', { exact: false }), 'gain per month');
    await expectVisible(text('9 Einheiten', { exact: true }), '9 Einheiten stat');
    check((await page.getByText('Noch zu wenig Daten').count()) === 0, 'no "too little data" text');
    check((await page.getByText(/rückläufig|zu unruhig/).count()) === 0, 'no declining / unreliable warning');
    await expectNoGarbage('progress with forecast');
    await page.goBack();
    await page.goBack();
  });

  await step('break banner after 16 days: Später hides it, Übernehmen lowers the weights, PR shows', async () => {
    await goTab('Heute');
    await click(row(PLAN));
    await click(button("Los geht's"));
    await expectVisible(text('Du warst 16 Tage nicht im Gym'), 'break banner with 16 days');
    await expectVisible(text('Heute rund 10 % leichter starten?'), 'banner copy');
    await click(button('Später', { exact: true }));
    await expectGone(page.getByText('Du warst 16 Tage nicht im Gym'), 'banner gone after Später');
    kit.dialogMode = 'accept';
    await click(button('Einheit beenden'));
    check(lastDialog().startsWith('Noch kein Satz abgehakt'), 'empty session discarded');
    await expectVisible(button(`Gym: ${GYM}`), 'back on Heute');

    // Same break, fresh session: this time apply.
    await click(row(PLAN));
    await click(button("Los geht's"));
    await expectVisible(text('Du warst 16 Tage nicht im Gym'), 'banner again for a new session');
    await click(button(`${STRENGTH}, Sätze aufklappen`));
    const firstKg = () => vis(page.getByLabel('KG', { exact: true })).first();
    const kg0 = parseKg(await firstKg().inputValue());
    check(kg0 === 102.5, `prefilled weight before applying is 102,5 (got ${kg0})`);
    await click(button('Übernehmen', { exact: true }));
    await expectVisible(text('Gewichte um 10 % gesenkt'), 'banner confirms');
    let kg1 = kg0;
    for (let i = 0; i < 30 && kg1 === kg0; i++) {
      await page.waitForTimeout(100);
      kg1 = parseKg(await firstKg().inputValue());
    }
    check(Number.isFinite(kg1) && kg1 > 70 && kg1 < kg0, `weight lowered to a sane value (${kg0} -> ${kg1})`);
    // A fresh PR on top of the lowered start.
    await typeInto(firstKg(), '110');
    await typeInto(vis(page.getByLabel('WDH', { exact: true })).first(), '8');
    await click(vis(page.getByRole('checkbox', { name: 'Satz 1 erledigt' })).first());
    await expectVisible(vis(page.getByLabel(/^Rekord in Satz 1/)), 'PR marker on the set');
    await expectVisible(vis(page.getByLabel('Neuer Rekord', { exact: true })), 'PR celebration');
    await settle(1500);
    check((await vis(page.getByLabel('Neuer Rekord', { exact: true })).count()) === 0, 'celebration is gone after ~1.2 s');
    await click(button('Einheit beenden'));
    await expectVisible(text('Einheit beendet'), 'summary');
    await click(button('Fertig'));
    await expectVisible(button(`Gym: ${GYM}`), 'back on Heute');
    const summary = await waitHero(/^Wochenfortschritt: [1-9][\d.]* kg/, "hero shows this week's kg");
    const moved = Number(summary.match(/^Wochenfortschritt: ([\d.]+) kg/)[1].replace('.', ''));
    check(moved >= 880 && moved < 2000, `this week's kg is plausible (${summary})`);
  });

  // ---- 7. duel -------------------------------------------------------------
  await step('duel: CTA on Heute, name prompt, share code, own code rejected, friend imported', async () => {
    await goTab('Heute');
    await click(button('Fordere Freunde heraus'));
    await expectVisible(text('Noch kein Duell', { exact: false }), 'empty duel state');
    // Native stack header carries the design: title font + loaded.
    const header = await vis(page.getByText('Wochen-Duell', { exact: true })).first().evaluate(
      (e) => getComputedStyle(e).fontFamily,
    );
    check(header.includes(THEMES[VARIANT].header), `duel header uses ${THEMES[VARIANT].header} (got ${header})`);
    await click(button('Wochenkarte teilen'));
    await typeInto(field('Dein Name'), 'E2E Jörg');
    await click(button('Name speichern und teilen'));
    await expectVisible(button('Wochenkarte teilen'), 'share button back after naming');
    // The share alert opens after an async re-read of the week; wait for it instead of racing.
    for (let i = 0; i < 50 && !lastDialog().includes('REPZ1.'); i++) await page.waitForTimeout(100);
    const shared = lastDialog();
    check(/Meine Repz-Woche KW 45: .* Code: REPZ1\.[A-Za-z0-9_-]+\.[0-9a-z]{4}/.test(shared), `share message (${shared})`);
    const own = shared.match(/REPZ1\.[A-Za-z0-9_-]+\.[0-9a-z]{4}/)[0];
    // Long pastes: fill() sets the value in one go (typing 130 characters at 40 ms would be slow and flaky).
    await field('Code eingeben').fill(`[12:00] Jörg: Hier meine Karte. ${own}.`);
    await click(button('Importieren'));
    await expectVisible(text('Das ist deine eigene Karte'), 'own card rejected');
    const friend = friendCode({ n: 'Jonas', w: TODAY_WEEK_KEY, kg: 21050, km: 8.1, s: 5 });
    await field('Code eingeben').fill(friend.slice(0, -1) + (friend.endsWith('x') ? 'y' : 'x'));
    await click(button('Importieren'));
    await expectVisible(text('Der Code ist beschädigt', { exact: false }), 'corrupt code rejected');
    await field('Code eingeben').fill(`Hallo ${friend}.\nViel Erfolg!`);
    await click(button('Importieren'));
    await expectVisible(text('Karte von Jonas importiert'), 'friend imported');
    // Instrument prints names in capitals, hence the case-insensitive match.
    await expectVisible(text(/^Jonas$/i), 'friend name in the visual');
    await expectVisible(text('Jonas führt bei kg und Cardio', { exact: false }), 'verdict against this week');
    await expectNoGarbage('duel screen');
    await page.goBack();
    await expectVisible(text('Duell mit Jonas'), 'Heute duel card with the friend');
    await expectNoGarbage('Heute with duel card');
  });

  await step('no console/page errors during the whole run', async () => {
    check(kit.problems.length === 0, `console/page errors:\n  ${kit.problems.join('\n  ')}`);
  });
} catch (e) {
  if (!kit.failuresCount()) console.log(`  x ${e.message}`);
} finally {
  const ok = await kit.finish();
  if (!ok) process.exit(1);
  console.log('E2E OK');
}
