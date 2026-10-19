jest.mock('expo-sqlite', () => require('@/test-support/expo-sqlite-mock'));

import type { SQLiteDatabase } from 'expo-sqlite';

import { WeekGoalFields } from '@/components/week-goal-fields';
import { getSetting, setSetting } from '@/db';
import { createTestDb } from '@/test-support/db';
import { fireEvent, renderWithProviders, waitFor } from '@/test-support/render';

let db: SQLiteDatabase;
beforeEach(async () => {
  db = await createTestDb();
});

async function type(view: Awaited<ReturnType<typeof renderWithProviders>>, label: string, text: string) {
  const input = view.getByLabelText(label);
  await fireEvent.changeText(input, text);
  await fireEvent(input, 'blur');
}

describe('WeekGoalFields', () => {
  it('stores a German decimal comma as a dot', async () => {
    const view = await renderWithProviders(<WeekGoalFields />);
    await type(view, 'Wochenziel Cardio (km)', '12,5');
    await waitFor(async () => expect(await getSetting(db, 'week_goal_km')).toBe('12.5'));
    expect(view.getByLabelText('Wochenziel Cardio (km)').props.value).toBe('12,5');
  });

  it('reads a thousands dot as thousands', async () => {
    const view = await renderWithProviders(<WeekGoalFields />);
    await type(view, 'Wochenziel (kg)', '25.000');
    await waitFor(async () => expect(await getSetting(db, 'week_goal_kg')).toBe('25000'));
  });

  it('clears the goal when emptied so the suggestion returns', async () => {
    await setSetting(db, 'week_goal_kg', '25000');
    const view = await renderWithProviders(<WeekGoalFields />);
    await waitFor(() => expect(view.getByLabelText('Wochenziel (kg)').props.value).toBe('25000'));
    await type(view, 'Wochenziel (kg)', '');
    await waitFor(async () => expect(await getSetting(db, 'week_goal_kg')).toBeNull());
  });

  it('puts the stored value back after nonsense', async () => {
    await setSetting(db, 'week_goal_kg', '25000');
    const view = await renderWithProviders(<WeekGoalFields />);
    await waitFor(() => expect(view.getByLabelText('Wochenziel (kg)').props.value).toBe('25000'));
    await type(view, 'Wochenziel (kg)', 'viel');
    await waitFor(() => expect(view.getByLabelText('Wochenziel (kg)').props.value).toBe('25000'));
    expect(await getSetting(db, 'week_goal_kg')).toBe('25000');
  });
});
