/** Friend-card store: retention, own-card rule, damaged settings. */
jest.mock('expo-sqlite', () => require('@/test-support/expo-sqlite-mock'));

import type { SQLiteDatabase } from 'expo-sqlite';

import { getFriendCards, importFriendCard, setSetting } from '@/db';
import type { WeekCard } from '@/domain/week-card';
import { createTestDb } from '@/test-support/db';

let db: SQLiteDatabase;
beforeEach(async () => {
  db = await createTestDb();
});

const card = (n: string, w: string, kg = 1000): WeekCard => ({ v: 1, n, w, kg, km: 0, s: 1 });
// Monday of 2026-W43; 8 weeks window = W36..W43.
const now = new Date(2026, 9, 19, 12, 0);
const me = { name: 'Nico', card: card('Nico', '2026-W43', 5000) };

describe('importFriendCard', () => {
  it('keeps the last 8 weeks and drops older cards', async () => {
    for (const w of ['2026-W34', '2026-W35', '2026-W36', '2026-W40']) {
      await importFriendCard(db, card(`F${w}`, w), me, now);
    }
    const kept = (await getFriendCards(db)).map((f) => f.card.w).sort();
    expect(kept).toEqual(['2026-W36', '2026-W40']);
  });

  it('treats the own name in the same week as own, even with other numbers', async () => {
    expect(await importFriendCard(db, card(' nico ', '2026-W43', 1), me, now)).toBe('own');
    expect(await getFriendCards(db)).toHaveLength(0);
  });

  it('accepts the own name for another week as a normal card', async () => {
    expect(await importFriendCard(db, card('Nico', '2026-W42'), me, now)).toBe('added');
  });
});

describe('getFriendCards', () => {
  it.each(['not json', '{"a":1}', '[1,"x",null,{"card":{"v":1}}]'])(
    'survives garbage %j',
    async (raw) => {
      await setSetting(db, 'friend_cards', raw);
      await expect(getFriendCards(db)).resolves.toEqual([]);
    },
  );
});
