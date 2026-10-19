/**
 * The weekly duel's share card: a tiny JSON summary of one week that friends swap as text
 * (WhatsApp), with a checksum so a mangled paste is caught instead of showing wrong numbers.
 *
 * Everything here is pure and dependency-free on purpose: Hermes has no Buffer, and the same
 * code must run in Jest, the browser preview and on the phone.
 */

import { formatDistance, formatVolume, groupThousands, plural } from '@/domain/format';

export interface WeekCard {
  v: 1;
  /** Display name of the sender. */
  n: string;
  /** ISO week key, `2026-W43`. */
  w: string;
  /** Kilos moved. */
  kg: number;
  /** Cardio kilometres. */
  km: number;
  /** Sessions. */
  s: number;
}

export type DecodeResult =
  | { ok: true; card: WeekCard }
  | { ok: false; reason: 'no-code' | 'corrupt' | 'version' };

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const WEEK_PATTERN = /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/;
const CODE_PATTERN = /REPZ(\d+)\.([A-Za-z0-9_-]+)\.([0-9a-z]{4})/;
export const MAX_NAME_LENGTH = 24;

/** A name that survives UTF-8 encoding: trimmed, capped, no unpaired surrogates. */
export function cleanName(raw: string): string {
  let out = '';
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = raw.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += raw[i] + raw[i + 1];
        i += 1;
      }
      continue; // unpaired high surrogate: drop
    }
    if (code >= 0xdc00 && code <= 0xdfff) continue; // unpaired low surrogate: drop
    out += raw[i];
  }
  return Array.from(out.trim()).slice(0, MAX_NAME_LENGTH).join('').trim();
}

function utf8Bytes(text: string): number[] {
  const escaped = encodeURIComponent(text); // %XX per UTF-8 byte, ASCII as is
  const bytes: number[] = [];
  for (let i = 0; i < escaped.length; i += 1) {
    if (escaped[i] === '%') {
      bytes.push(parseInt(escaped.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(escaped.charCodeAt(i));
    }
  }
  return bytes;
}

function utf8String(bytes: number[]): string | null {
  try {
    const escaped = bytes.map((b) => `%${b.toString(16).padStart(2, '0')}`).join('');
    return decodeURIComponent(escaped);
  } catch {
    return null; // not valid UTF-8
  }
}

export function encodeBase64Url(text: string): string {
  const bytes = utf8Bytes(text);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b, c] = [bytes[i], bytes[i + 1], bytes[i + 2]];
    const triple = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += ALPHABET[(triple >> 18) & 63] + ALPHABET[(triple >> 12) & 63];
    if (b !== undefined) out += ALPHABET[(triple >> 6) & 63];
    if (c !== undefined) out += ALPHABET[triple & 63];
  }
  return out;
}

/** Null when `encoded` is not valid unpadded base64url holding UTF-8. */
export function decodeBase64Url(encoded: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/.test(encoded) || encoded.length % 4 === 1) return null;
  const bytes: number[] = [];
  for (let i = 0; i < encoded.length; i += 4) {
    const chunk = encoded.slice(i, i + 4);
    let triple = 0;
    for (let j = 0; j < 4; j += 1) {
      triple = (triple << 6) | (j < chunk.length ? ALPHABET.indexOf(chunk[j]) : 0);
    }
    bytes.push((triple >> 16) & 255);
    if (chunk.length > 2) bytes.push((triple >> 8) & 255);
    if (chunk.length > 3) bytes.push(triple & 255);
  }
  return utf8String(bytes);
}

/** 32-bit FNV-1a, folded to 4 base36 characters. Detects typos and cut-off pastes, not tampering. */
export function checksumOf(payload: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return (hash % 36 ** 4).toString(36).padStart(4, '0');
}

export function encodeWeekCard(card: WeekCard): string {
  const json = JSON.stringify({ v: card.v, n: card.n, w: card.w, kg: card.kg, km: card.km, s: card.s });
  const payload = encodeBase64Url(json);
  return `REPZ1.${payload}.${checksumOf(payload)}`;
}

const isCount = (x: unknown, max: number): x is number =>
  typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= max;
// Generous ceilings: a hand-edited code must not blow up bars and layouts.
const MAX_KG = 10_000_000;
const MAX_KM = 100_000;
const MAX_SESSIONS = 1_000;

export function isWeekCard(x: unknown): x is WeekCard {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return false;
  const c = x as Record<string, unknown>;
  return (
    c.v === 1 &&
    typeof c.n === 'string' &&
    c.n.trim().length > 0 &&
    typeof c.w === 'string' &&
    WEEK_PATTERN.test(c.w) &&
    isCount(c.kg, MAX_KG) &&
    isCount(c.km, MAX_KM) &&
    isCount(c.s, MAX_SESSIONS) &&
    Number.isInteger(c.s)
  );
}

/** Finds a `REPZ…` code anywhere in pasted text (a whole chat message is fine) and decodes it. */
export function extractAndDecode(text: string): DecodeResult {
  const match = CODE_PATTERN.exec(text);
  if (!match) return { ok: false, reason: 'no-code' };
  const [, version, payload, checksum] = match;
  if (version !== '1') return { ok: false, reason: 'version' };
  if (checksumOf(payload) !== checksum) return { ok: false, reason: 'corrupt' };
  const json = decodeBase64Url(payload);
  if (json === null) return { ok: false, reason: 'corrupt' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
  if (!isWeekCard(parsed)) return { ok: false, reason: 'corrupt' };
  const { v, n, w, kg, km, s } = parsed;
  return { ok: true, card: { v, n: cleanName(n) || n.trim(), w, kg, km, s } };
}

/** The week number of `2026-W43`, for "KW 43". */
export function weekNumberOf(weekKey: string): number {
  return Number(weekKey.split('-W')[1]) || 0;
}

export function shareMessage(card: WeekCard): string {
  return (
    `Meine Repz-Woche KW ${weekNumberOf(card.w)}: ${formatVolume(card.kg)} bewegt, ` +
    `${formatDistance(card.km)} Cardio, ${plural(card.s, 'Einheit', 'Einheiten')}. ` +
    `Code: ${encodeWeekCard(card)}`
  );
}

/** German genitive for a first name: `Jonas'`, `Mias`. */
export function genitive(name: string): string {
  return /[sßxz]$/i.test(name) ? `${name}'` : `${name}s`;
}

/** Same metric rounding the card carries, so "equal" means equal on both phones. */
const tenth = (km: number) => Math.round(km * 10);

/** The one-line verdict shown on the duel screen and the Heute card. */
export function duelStatus(me: WeekCard, friend: WeekCard): string {
  if (friend.w !== me.w) {
    const week = weekNumberOf(friend.w);
    return friend.w > me.w
      ? `${genitive(friend.n)} Karte ist schon von KW ${week}.`
      : `${genitive(friend.n)} Karte ist von KW ${week} — schick deine aktuelle Wochenkarte.`;
  }
  const kgGap = Math.round(friend.kg) - Math.round(me.kg);
  const kmGap = tenth(friend.km) - tenth(me.km);
  if (kgGap === 0 && kmGap === 0) return 'Gleichstand bei kg und Cardio.';
  if (kgGap > 0 && kmGap > 0) {
    return `${friend.n} führt bei kg und Cardio — dir fehlen ${groupThousands(kgGap)} kg.`;
  }
  if (kgGap < 0 && kmGap < 0) return 'Du führst bei kg und Cardio.';
  const kg =
    kgGap > 0
      ? `${friend.n} führt bei den kg, dir fehlen ${groupThousands(kgGap)} kg.`
      : kgGap < 0
        ? `Du führst bei den kg, ${friend.n} fehlen ${groupThousands(-kgGap)} kg.`
        : 'Bei den kg steht es unentschieden.';
  const cardio =
    kmGap > 0
      ? `Beim Cardio liegt ${friend.n} vorn.`
      : kmGap < 0
        ? 'Beim Cardio liegst du vorn.'
        : 'Beim Cardio steht es unentschieden.';
  return `${kg} ${cardio}`;
}

/** This week's numbers as a card, rounded the way they travel (whole kg, tenths of km). */
export function cardFromProgress(
  name: string,
  progress: { weekKey: string; volumeKg: number; distanceKm: number; sessions: number },
): WeekCard {
  return {
    v: 1,
    n: name,
    w: progress.weekKey,
    kg: Math.round(progress.volumeKg),
    km: Math.round(progress.distanceKm * 10) / 10,
    s: progress.sessions,
  };
}
