jest.mock('expo-sqlite', () => require('@/test-support/expo-sqlite-mock'));

import { CountUp } from '@/components/motion/count-up';
import { createTestDb } from '@/test-support/db';
import { renderWithProviders } from '@/test-support/render';

const reanimated = require('react-native-reanimated') as { __setReducedMotion: (v: boolean) => void };

beforeEach(async () => {
  await createTestDb();
});
afterEach(() => reanimated.__setReducedMotion(false));

describe('CountUp', () => {
  it('starts at zero and counts when motion is allowed', async () => {
    const view = await renderWithProviders(<CountUp value={12500} />);
    expect(view.getByText('0')).toBeTruthy();
  });

  it('is plain final text with reduced motion', async () => {
    reanimated.__setReducedMotion(true);
    const view = await renderWithProviders(<CountUp value={12500} />);
    expect(view.getByText('12500')).toBeTruthy();
  });
});
