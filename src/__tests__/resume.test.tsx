/**
 * Screens that show "now" (the Heute date, the calendar's today marker, the backup age) must follow
 * the clock when the app comes back to the foreground, not freeze on the day they were mounted.
 */
jest.mock('expo-sqlite', () => require('@/test-support/expo-sqlite-mock'));

import { act } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import HeuteScreen from '@/app/(tabs)/index';
import SettingsScreen from '@/app/(tabs)/settings';
import HistoryCalendarScreen from '@/app/history/calendar';
import { setSetting } from '@/db';
import { createTestDb } from '@/test-support/db';
import { renderWithProviders, screen, waitFor } from '@/test-support/render';
import { resetRouter } from '@/test-support/router';

const reanimated = require('react-native-reanimated') as { __setReducedMotion: (v: boolean) => void };

let listeners: ((state: AppStateStatus) => void)[] = [];

beforeEach(async () => {
  resetRouter();
  await createTestDb();
  reanimated.__setReducedMotion(true);
  listeners = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, fn: never) => {
    listeners.push(fn);
    return { remove: () => (listeners = listeners.filter((l) => l !== fn)) };
  }) as never);
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval'], now: new Date('2026-11-04T12:00:00+01:00') });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  reanimated.__setReducedMotion(false);
});

/** The app is backgrounded overnight, then reopened. */
async function resumeNextMorning(days = 1) {
  jest.setSystemTime(new Date(Date.now() + days * 86_400_000));
  await act(async () => listeners.forEach((l) => l('active')));
}

it('Heute moves its date label on when the app resumes the next day', async () => {
  await renderWithProviders(<HeuteScreen />);
  expect(await screen.findByText('Mittwoch, 4. November')).toBeTruthy();
  await resumeNextMorning();
  await waitFor(() => expect(screen.getByText('Donnerstag, 5. November')).toBeTruthy());
});

it('the settings backup age grows after a resume', async () => {
  const db = await createTestDb();
  await setSetting(db, 'last_auto_backup_at', new Date(Date.now() - 3600_000 * 2).toISOString());
  await renderWithProviders(<SettingsScreen />);
  expect(await screen.findByText('vor 2 Stunden')).toBeTruthy();
  await resumeNextMorning();
  await waitFor(() => expect(screen.getByText('gestern')).toBeTruthy());
});

it('the calendar moves its today marker after a resume', async () => {
  const view = await renderWithProviders(<HistoryCalendarScreen />);
  const isMarked = (day: number) =>
    JSON.stringify(view.getByLabelText(new RegExp(`^${day}\\. November 2026`)).props.style).includes(
      '"borderWidth":1',
    );
  await waitFor(() => expect(isMarked(4)).toBe(true));
  expect(isMarked(5)).toBe(false);
  await resumeNextMorning();
  await waitFor(() => expect(isMarked(5)).toBe(true));
  expect(isMarked(4)).toBe(false);
});
