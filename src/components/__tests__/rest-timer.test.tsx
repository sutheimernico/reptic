jest.mock('expo-sqlite', () => require('@/test-support/expo-sqlite-mock'));

import { Pressable, Text } from 'react-native';

import { RestTimerBanner, useRestTimer } from '@/components/rest-timer';
import { setSetting } from '@/db';
import { REST_TIMER_SETTING } from '@/domain/rest-timer';
import { createTestDb } from '@/test-support/db';
import { act, fireEvent, renderWithProviders, waitFor } from '@/test-support/render';

/** Drives the provider from inside the tree, the way the set screen does. */
function Harness() {
  const { start } = useRestTimer();
  return (
    <>
      <RestTimerBanner />
      <Pressable accessibilityRole="button" accessibilityLabel="Satz abhaken" onPress={start}>
        <Text>tick</Text>
      </Pressable>
    </>
  );
}

/** Render and wait for the provider to have read its settings. */
async function mount() {
  const view = await renderWithProviders(<Harness />);
  await waitFor(() => expect(view.getByLabelText('Satz abhaken')).toBeTruthy());
  return view;
}

beforeEach(async () => {
  await createTestDb();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('RestTimerBanner', () => {
  it('shows nothing until a set starts the rest', async () => {
    const view = await mount();
    expect(view.queryByText(/Pause/)).toBeNull();
  });

  it('counts down from the configured duration and reports the end', async () => {
    const view = await mount();
    jest.useFakeTimers();

    await fireEvent.press(view.getByLabelText('Satz abhaken'));
    expect(view.getByText('Pause 2:00')).toBeTruthy();

    await act(() => {
      jest.advanceTimersByTime(30_000);
    });
    expect(view.getByText('Pause 1:30')).toBeTruthy();

    await act(() => {
      jest.advanceTimersByTime(90_000);
    });
    expect(view.getByText('Pause vorbei')).toBeTruthy();
  });

  it('shows the expired state after a long gap, not a frozen countdown', async () => {
    const view = await mount();
    jest.useFakeTimers();
    await fireEvent.press(view.getByLabelText('Satz abhaken'));

    // The app was backgrounded: the wall clock moved on in one jump.
    await act(() => {
      jest.advanceTimersByTime(10 * 60_000);
    });
    expect(view.getByText('Pause vorbei')).toBeTruthy();
  });

  it('disappears on "Weiter"', async () => {
    const view = await mount();
    jest.useFakeTimers();

    await fireEvent.press(view.getByLabelText('Satz abhaken'));
    expect(view.getByText('Pause 2:00')).toBeTruthy();

    await fireEvent.press(view.getByLabelText('Pause beenden'));
    expect(view.queryByText(/Pause/)).toBeNull();
  });

  it('stays away entirely when the timer is switched off', async () => {
    const db = await createTestDb();
    await setSetting(db, REST_TIMER_SETTING, '0');

    const view = await mount();
    jest.useFakeTimers();

    await fireEvent.press(view.getByLabelText('Satz abhaken'));
    expect(view.queryByText(/Pause/)).toBeNull();
  });
});
