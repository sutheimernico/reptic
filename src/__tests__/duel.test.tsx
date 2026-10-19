/**
 * The weekly duel against real SQLite: empty states, importing friends' codes (incl. a pasted
 * WhatsApp message), replacing, own-code rejection and the inline name prompt before sharing.
 */
jest.mock('expo-sqlite', () => require('@/test-support/expo-sqlite-mock'));

import type { SQLiteDatabase } from 'expo-sqlite';
import { Alert, Share } from 'react-native';

import { DuelCard } from '@/components/duel-card';
import DuelScreen from '@/app/duel';
import {
  addWorkoutExercise,
  createExercise,
  createGym,
  finishWorkout,
  getFriendCards,
  getSetting,
  getWeekOverview,
  insertSet,
  NAME_SETTING,
  setSetting,
  startWorkout,
} from '@/db';
import { encodeWeekCard, shareMessage, type WeekCard } from '@/domain/week-card';
import { isoWeekKey, isoWeekOf } from '@/domain/weeks';
import { createTestDb } from '@/test-support/db';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/test-support/render';
import { resetRouter, routerMock } from '@/test-support/router';

const reanimated = require('react-native-reanimated') as { __setReducedMotion: (v: boolean) => void };

let db: SQLiteDatabase;
const thisWeek = isoWeekKey(isoWeekOf(new Date()));
const jonas: WeekCard = { v: 1, n: 'Jonas', w: thisWeek, kg: 21050, km: 8.1, s: 5 };

beforeEach(async () => {
  resetRouter();
  db = await createTestDb();
  reanimated.__setReducedMotion(true);
});
afterEach(() => {
  reanimated.__setReducedMotion(false);
  jest.restoreAllMocks();
});

async function seedWorkout(weight = 92, reps = 200) {
  const gymId = await createGym(db, 'Gym');
  const exerciseId = await createExercise(db, 'Bankdrücken', 'Brust');
  const now = new Date();
  const workoutId = await startWorkout(db, [], gymId, now.toISOString());
  const workoutExerciseId = await addWorkoutExercise(db, workoutId, exerciseId);
  await insertSet(db, {
    workoutId, workoutExerciseId, exerciseId, setNumber: 1, weightKg: weight, reps, done: true,
  });
  await finishWorkout(db, workoutId, now.toISOString());
}

async function importCode(text: string) {
  await fireEvent.changeText(await screen.findByLabelText('Code eingeben'), text);
  await fireEvent.press(await screen.findByText('Importieren'));
}

describe('DuelScreen', () => {
  it('shows an empty state without a friend', async () => {
    await renderWithProviders(<DuelScreen />);
    expect(await screen.findByText(/Noch kein Duell/)).toBeTruthy();
    expect(screen.queryByText(/fehlen/)).toBeNull();
  });

  it('imports a friend code and shows both names and the gap', async () => {
    await seedWorkout();
    await renderWithProviders(<DuelScreen />);
    await importCode(encodeWeekCard(jonas));
    expect(await screen.findByText('Karte von Jonas importiert')).toBeTruthy();
    expect(await screen.findByText('Du')).toBeTruthy();
    expect(screen.getAllByText('Jonas').length).toBeGreaterThan(0);
    expect(screen.getByText(/dir fehlen/)).toBeTruthy();
    expect(await getFriendCards(db)).toHaveLength(1);
  });

  it('imports a whole pasted WhatsApp message with a trailing period', async () => {
    await renderWithProviders(<DuelScreen />);
    await importCode(`[19.10., 21:03] Jonas: ${shareMessage(jonas)}.\n`);
    expect(await screen.findByText('Karte von Jonas importiert')).toBeTruthy();
  });

  it('replaces the card when the same friend sends the same week again', async () => {
    await renderWithProviders(<DuelScreen />);
    await importCode(encodeWeekCard(jonas));
    await screen.findByText('Karte von Jonas importiert');
    await importCode(encodeWeekCard({ ...jonas, kg: 22000 }));
    expect(await screen.findByText('Karte von Jonas aktualisiert')).toBeTruthy();
    const cards = await getFriendCards(db);
    expect(cards).toHaveLength(1);
    expect(cards[0].card.kg).toBe(22000);
  });

  it('rejects the own card', async () => {
    await seedWorkout();
    await setSetting(db, NAME_SETTING, 'Nico');
    const overview = await getWeekOverview(db, new Date());
    const own: WeekCard = {
      v: 1,
      n: 'Nico',
      w: overview.progress.weekKey,
      kg: Math.round(overview.progress.volumeKg),
      km: Math.round(overview.progress.distanceKm * 10) / 10,
      s: overview.progress.sessions,
    };
    await renderWithProviders(<DuelScreen />);
    await waitFor(async () => expect(await getSetting(db, NAME_SETTING)).toBe('Nico'));
    await importCode(encodeWeekCard(own));
    expect(await screen.findByText('Das ist deine eigene Karte')).toBeTruthy();
    expect(await getFriendCards(db)).toHaveLength(0);
  });

  it.each([
    ['hallo zusammen', 'Kein Repz-Code gefunden'],
    [encodeWeekCard(jonas).replace('REPZ1.', 'REPZ2.'), 'Dieser Code ist von einer neueren Repz-Version'],
  ])('reports %j', async (text, expected) => {
    await renderWithProviders(<DuelScreen />);
    await importCode(text);
    expect(await screen.findByText(expected)).toBeTruthy();
  });

  it('rejects a code with one changed character', async () => {
    await renderWithProviders(<DuelScreen />);
    const code = encodeWeekCard(jonas);
    const at = code.indexOf('.') + 4;
    const changed = `${code.slice(0, at)}${code[at] === 'A' ? 'B' : 'A'}${code.slice(at + 1)}`;
    await importCode(changed);
    expect(
      await screen.findByText('Der Code ist beschädigt — bitte nochmal kopieren'),
    ).toBeTruthy();
    expect(await getFriendCards(db)).toHaveLength(0);
  });

  it('asks for a name before sharing, then shares a code with it', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderWithProviders(<DuelScreen />);
    await fireEvent.press(await screen.findByText('Wochenkarte teilen'));
    expect(share).not.toHaveBeenCalled();
    const field = await screen.findByLabelText('Dein Name');
    await fireEvent.changeText(field, '   ');
    await fireEvent.press(screen.getByText('Name speichern und teilen'));
    expect(share).not.toHaveBeenCalled(); // a blank name is not a name
    expect(await getSetting(db, NAME_SETTING)).toBeNull();
    await fireEvent.changeText(field, 'Jörg');
    await fireEvent.press(screen.getByText('Name speichern und teilen'));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const message = share.mock.calls[0][0].message as string;
    expect(message).toMatch(/^Meine Repz-Woche KW \d+: .* Code: REPZ1\./);
    expect(await getSetting(db, NAME_SETTING)).toBe('Jörg');
  });

  it('shares straight away once a name exists', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    await setSetting(db, NAME_SETTING, 'Nico');
    await renderWithProviders(<DuelScreen />);
    await waitFor(async () => expect(await getSetting(db, NAME_SETTING)).toBe('Nico'));
    await fireEvent.press(await screen.findByText('Wochenkarte teilen'));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
  });

  it('offers a picker when several friends sent a card this week', async () => {
    await renderWithProviders(<DuelScreen />);
    await importCode(encodeWeekCard(jonas));
    await screen.findByText('Karte von Jonas importiert');
    await importCode(encodeWeekCard({ ...jonas, n: 'Mia', kg: 100 }));
    await screen.findByText('Karte von Mia importiert');
    expect(screen.getByRole('radio', { name: 'Jonas' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Jonas' }));
    expect(await screen.findByText(/Jonas führt bei kg und Cardio/)).toBeTruthy();
  });

  it('says so when the friend card is from another week', async () => {
    await renderWithProviders(<DuelScreen />);
    await importCode(encodeWeekCard({ ...jonas, w: '2020-W10' }));
    expect(await screen.findByText(/Karte ist von KW 10 — schick deine aktuelle Wochenkarte\./)).toBeTruthy();
  });
});

describe('DuelCard on Heute', () => {
  it('invites to the first duel on a fresh install and opens /duel', async () => {
    const overview = await getWeekOverview(db, new Date());
    await renderWithProviders(<DuelCard overview={overview} />);
    await fireEvent.press(await screen.findByText('Fordere Freunde heraus'));
    expect(routerMock.push).toHaveBeenCalledWith('/duel');
  });

  it('survives a damaged friend_cards setting', async () => {
    await setSetting(db, 'friend_cards', '{{{ nope');
    const overview = await getWeekOverview(db, new Date());
    await renderWithProviders(<DuelCard overview={overview} />);
    expect(await screen.findByText('Fordere Freunde heraus')).toBeTruthy();
  });

  it('shows you vs. the top friend once a card exists', async () => {
    await setSetting(
      db,
      'friend_cards',
      JSON.stringify([{ card: jonas, importedAt: new Date().toISOString() }]),
    );
    const overview = await getWeekOverview(db, new Date());
    await renderWithProviders(<DuelCard overview={overview} />);
    expect(await screen.findByText('Duell mit Jonas')).toBeTruthy();
    expect(screen.queryByText('Fordere Freunde heraus')).toBeNull();
    expect(screen.queryByText(/NaN/)).toBeNull();
  });
});
