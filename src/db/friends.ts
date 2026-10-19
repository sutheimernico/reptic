/**
 * Friends' week cards for the duel, kept in the settings table (device-local, no schema, not part
 * of a backup — a friend can simply send a new code).
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import { getSetting, setSetting } from '@/db/settings';
import { isWeekCard, type WeekCard } from '@/domain/week-card';
import { isoWeekKey, lastIsoWeeks } from '@/domain/weeks';

export const NAME_SETTING = 'display_name';
const FRIENDS_SETTING = 'friend_cards';
const KEEP_WEEKS = 8;

export interface FriendCard {
  card: WeekCard;
  /** ISO timestamp of the import. */
  importedAt: string;
}

export type ImportResult = 'added' | 'replaced' | 'own';

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export async function getFriendCards(db: SQLiteDatabase): Promise<FriendCard[]> {
  const raw = await getSetting(db, FRIENDS_SETTING);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is FriendCard =>
        typeof entry === 'object' &&
        entry !== null &&
        isWeekCard((entry as FriendCard).card) &&
        typeof (entry as FriendCard).importedAt === 'string',
    );
  } catch {
    return []; // a damaged setting must not break Heute; friends can re-send
  }
}

export async function importFriendCard(
  db: SQLiteDatabase,
  card: WeekCard,
  me: { name: string; card: WeekCard },
  now: Date,
): Promise<ImportResult> {
  // Own older codes (before more training) carry my name too: name + week is enough.
  if (sameName(card.n, me.name) && card.w === me.card.w) return 'own';

  const cutoff = isoWeekKey(lastIsoWeeks(now, KEEP_WEEKS)[0]);
  const existing = await getFriendCards(db);
  const entry: FriendCard = { card, importedAt: now.toISOString() };
  const index = existing.findIndex((f) => sameName(f.card.n, card.n) && f.card.w === card.w);
  const kept = existing.filter((f, i) => i !== index && f.card.w >= cutoff);
  await setSetting(db, FRIENDS_SETTING, JSON.stringify([...kept, entry]));
  return index >= 0 ? 'replaced' : 'added';
}

/** Cards for `weekKey` first (newest import first), older/newer weeks after. */
export function sortFriendCards(cards: FriendCard[], weekKey: string): FriendCard[] {
  const rank = (f: FriendCard) => (f.card.w === weekKey ? 0 : 1);
  return [...cards].sort(
    (a, b) => rank(a) - rank(b) || b.importedAt.localeCompare(a.importedAt),
  );
}
