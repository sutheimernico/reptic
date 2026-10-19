/** Celebrations are overlays: label shown, never touchable, gone after ~1.2 s. */
jest.mock('expo-sqlite', () => require('@/test-support/expo-sqlite-mock'));

import { Celebration } from '@/components/celebration';
import { setSetting } from '@/db';
import { createTestDb } from '@/test-support/db';
import { act, renderWithProviders, waitFor } from '@/test-support/render';

const reanimated = require('react-native-reanimated') as { __setReducedMotion: (v: boolean) => void };

beforeEach(async () => {
  jest.useFakeTimers();
  await createTestDb();
});
afterEach(() => {
  reanimated.__setReducedMotion(false);
  jest.useRealTimers();
});

describe.each([
  ['evolved', /Neuer Rekord/],
  ['warm', /Neuer Rekord/],
  ['arcade', /NEUER REKORD!/],
  ['instrument', /▲/], // typed in character by character, so only the first glyph is sure to be there
])('Celebration (%s)', (variant, text) => {
  it('shows the label as a touch-through overlay and reports done after 1.2 s', async () => {
    const db = await createTestDb();
    await setSetting(db, 'theme_variant', variant);
    const onDone = jest.fn();
    const view = await renderWithProviders(
      <Celebration kind="pr" label="Neuer Rekord" visible onDone={onDone} />,
    );
    await waitFor(() => expect(view.getAllByText(text).length).toBeGreaterThan(0));
    expect(view.getByLabelText('Neuer Rekord').props.pointerEvents).toBe('none');
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1250);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('Celebration', () => {
  it('renders nothing while not visible', async () => {
    const view = await renderWithProviders(
      <Celebration kind="goal" label="Wochenziel geschafft" visible={false} onDone={jest.fn()} />,
    );
    expect(view.queryByText(/Wochenziel/)).toBeNull();
  });

  it('falls back to a plain fade with reduced motion', async () => {
    reanimated.__setReducedMotion(true);
    const view = await renderWithProviders(
      <Celebration kind="goal" label="Wochenziel geschafft" visible onDone={jest.fn()} />,
    );
    expect(view.getByText('Wochenziel geschafft')).toBeTruthy();
  });
});
