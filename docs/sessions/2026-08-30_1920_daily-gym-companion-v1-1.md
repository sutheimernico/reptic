# Session 2026-08-30 19:20 — Daily Gym Companion v1.1 (Plan komplett abgearbeitet)

## Kontext & Ziel

Nicos Auftrag war ein Satz: „Bau mal die Gym App zuende." Im Repo lag genau ein
offener, ausführbarer Plan — `docs/superpowers/plans/2026-07-21-daily-gym-companion.md`
mit Status *awaiting go*, 11 Tasks in drei Phasen. Den habe ich als das Go behandelt
und vollständig umgesetzt.

Ausgangsstand: `autopilot/work` @ `0d8879f` (Hardening-Session 10.07.), 62 Tests,
Schema v3, versionCode 5.

## Ergebnis

13 Commits `1892fdf`…`ccf05e3`, +5167/−1150 über 51 Dateien. **Tests 62 → 179.**
Gate am Ende frisch gelaufen: `tsc` exit 0 · 179/179 jest in 15 Suiten · `expo lint`
exit 0 · `expo export --platform android` exit 0 (4,3 MB Bundle).

Was gebaut wurde, steht im **Outcome-Abschnitt am Ende des Plan-Docs** (inkl. der
sechs Abweichungen und Nicos Smoke-Test-Checkliste) sowie als Phase 15 in `PLAN.md`
und als Eintrag in `AUTOPILOT_LOG.md`. Feature-Liste im README aktualisiert.
Hier nur nicht anderswo Festgehaltenes.

**Schema und `app.json` sind bitgleich zum Sessionstart** (`git diff 0d8879f --
src/db/schema.ts app.json` ist leer) — kein Migrationsrisiko für Nicos echte
Gerätedaten, versionCode bleibt 5, kein Build. Der Migrations-Harness wurde als
Pflicht-No-Op nachgewiesen (9/9 grün).

## Entscheidungen

- **Task-Reihenfolge strikt nach Plan gehalten** (Task 2 Tests *vor* Task 3 Split,
  Task 4 Umbau erst nach dem festnagelnden Test) — genau das hat den 911-Zeilen-Split
  und den N+1-Umbau risikofrei gemacht.
- **In-App-Restore für Auto-Backups gebaut**, obwohl der Plan nur „über den bestehenden
  Import" vorsah: Androids Document-Picker erreicht die App-eigenen Privatdateien
  nicht, ein nicht wiederherstellbares Backup wäre wertlos gewesen.
- **Scheibenrechner öffnet per Tap aufs „KG"-Label statt per Long-press**, weil Android
  Long-press auf einem TextInput für die Textauswahl belegt.
- **Erreichbare Gewichte aufzählen statt greedy zu laden** — nur so ist „nicht exakt
  stellbar" eine belastbare Aussage und nicht bloß eine Greedy-Sackgasse.
- **Endsignal des Pausentimers im Provider, nicht im Banner:** im Stack bleibt der
  Session-Screen unter dem Satz-Screen gemountet, zwei Banner hätten doppelt vibriert.
- **`src/global.css` gelöscht** statt per Jest-Mock am Leben gehalten — die Font-Tokens
  waren im 10.07.-Sweep schon entfernt worden, der Import blockierte jeden Theme-Test.
  Bewusst außerhalb des Task-Scopes, aber er blockierte Task 10 direkt.
- **Lint-Ausnahmen für Testdateien in `eslint.config.js`** statt `eslint-disable` in
  jeder Testdatei: `jest.mock` *muss* über den Imports stehen und darf nur `require`.

## Sackgassen und Zeitfresser (damit sie nicht zweimal passieren)

- **RNTL v14 hat `render`, `fireEvent` und `act` auf async umgestellt.** Ohne `await`
  gibt `render` ein Promise zurück, `screen` meldet „render function has not been
  called" und man sucht den Fehler an der völlig falschen Stelle. Steht jetzt als
  Warnung in `src/test-support/render.tsx` und im README.
- **RNTL v14 braucht den Peer `test-renderer`** (nicht mehr `react-test-renderer`).
  `npm install` hat das nicht laut angemerkt.
- **expo-router-Routentypen schreibt nur der Dev-Server.** Nach `history/trends.tsx`
  hat `tsc` den neuen Pfad abgelehnt; `expo export` regeneriert sie *nicht*, es
  brauchte einmal `npx expo start`.
- **Dateien unter `__tests__/` werden alle als Suite geladen** — der geteilte
  SQLite-Adapter liegt deshalb in `src/db/test-support/`, nicht daneben.
- Zwei eigene Testerwartungen waren falsch, nicht der Code: 80 kg × 8 schätzt ein
  höheres 1RM als 90 kg × 2, und `[20, 20]` ist die bessere Scheibenlösung als
  `[25, 10, 5]`. Beide Male habe ich den Test korrigiert, nicht die Implementierung.

## Offene Fragen

- **Scheibenbestand:** Der Plan sagte „×2 each". Ich habe das als *zwei Paare je Größe*
  gelesen (ein Paar je Größe deckelt die Stange bei 177,5 kg und meldet für normale
  Gewichte „nicht stellbar"). Wie viele Scheiben hat dein Gym wirklich?
- **Pausendauer 2:00** ist der Plan-Vorschlag, nicht deine Angabe.
- **Haptik-Muster** (`Confirm` / `Long_Press` / Doppelschlag) sind ungetestet am Gerät —
  reine Schreibtischwahl.
- Der Smoke-Test der 10.07.-Arbeit (Splash, Cardio-Progression, Back-Nav-Flush) steht
  **immer noch** aus; er ist in der v1.1-Checkliste mit abgedeckt.

## To-dos

### Nico

1. **App am Handy durchklicken** — die 7-Punkte-Liste steht ganz unten im Plan-Doc
   `docs/superpowers/plans/2026-07-21-daily-gym-companion.md`. Wichtigster Punkt:
   Timer starten, App zwei Minuten weglegen, zurückkommen — es muss „Pause vorbei"
   stehen, keine eingefrorene Zahl.
2. **Sag mir, was sich falsch anfühlt:** Pausendauer (aktuell 2:00), Vibrationsstärke,
   und welche Hantelscheiben dein Gym wirklich hat. Alles drei ist in Einstellungen
   einstellbar, aber die Startwerte sollten stimmen.
3. **Danach Bescheid geben, dann baue ich versionCode 6.** Vorher bewusst nicht —
   das ist die Regel aus den 3-Stunden-Blindbuilds.
4. Weiterhin offen und unabhängig davon: „Trainingspläne"-Wording bestätigen oder
   verwerfen, Icon-/Splash-Grafik, Play Store ($25), Google-OAuth-Client für das
   Drive-Backup, `autopilot/work` → `master` mergen.

### Nächste Session (Agent)

- Nach Nicos Feedback: Defaults in `DEFAULT_REST_SECONDS` (`src/domain/rest-timer.ts`)
  und `DEFAULT_PLATE_SETUP` (`src/domain/plates.ts`) anpassen, Haptik-Muster in
  `src/lib/haptics.ts`. Alles drei sind Einzeiler mit Testabdeckung.
- Erst nach Live-Sign-off: versionCode in `app.json` auf 6, dann
  `eas build -p android --profile preview --non-interactive --no-wait`.
- Phase 8b (Drive-Backup) bleibt blockiert, bis Nico den OAuth-Client angelegt hat.
- Nicht angefasst und weiterhin bewusst zurückgestellt: Inline-/Akkordeon-Satzeingabe
  ohne Screenwechsel, Widget/Shortcut, Audio-Signale (siehe „Explicitly deferred"
  im Plan).

## Einstieg für die nächste Session

Branch `autopilot/work`, sauberer Working Tree, HEAD `ccf05e3`. Alles committet,
kein Remote. Gate: `npm run typecheck && npm test && npm run lint`.
Nichts ist halbfertig — die nächste Session beginnt mit Nicos Gerätefeedback und
ist danach reine Feintuning-Arbeit an drei Konstanten; dafür braucht es keinen
neuen Plan. Erst wenn Nico ein neues Feature will, wieder über `brainstorming` →
`writing-plans`.
