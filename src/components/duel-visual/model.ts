/**
 * What every duel skin shows, derived once so the four of them cannot disagree.
 * Bars are scaled to the larger side, so an empty week on both sides renders no bars (no NaN).
 */

import { formatDistance, formatSigned, groupThousands } from '@/domain/format';
import { duelStatus, weekNumberOf, type WeekCard } from '@/domain/week-card';

export type Lead = 'me' | 'friend' | 'tie';

export interface DuelMetric {
  key: 'kg' | 'km' | 's';
  /** Sentence-case label, e.g. "Bewegte kg". */
  label: string;
  me: number;
  friend: number;
  meText: string;
  friendText: string;
  /** me − friend, formatted with a sign. */
  deltaText: string;
  lead: Lead;
  mePct: number;
  friendPct: number;
  /** My share of both sides together, for the tug-of-war; 0.5 when both are 0. */
  sharePct: number;
}

export interface DuelModel {
  /** Name on my own card; "Du" until a name is set. */
  meName: string;
  friendName: string;
  weekLabel: string;
  sameWeek: boolean;
  metrics: { kg: DuelMetric; km: DuelMetric; s: DuelMetric };
  /** The kg leader's sticker text for the boss fight skin. */
  headline: string;
  status: string;
  /** "Karte importiert So., 12:04", empty when unknown. */
  importedText: string;
}

const kgText = (n: number) => groupThousands(Math.round(n));
const kmText = (n: number) => formatDistance(n).replace(' km', '');
const countText = (n: number) => String(Math.round(n));

function metric(
  key: DuelMetric['key'],
  label: string,
  me: number,
  friend: number,
  fmt: (n: number) => string,
  unit: string,
): DuelMetric {
  const tenth = key === 'km' ? 10 : 1;
  const gap = Math.round(me * tenth) - Math.round(friend * tenth);
  const max = Math.max(me, friend);
  const total = me + friend;
  return {
    key,
    label,
    me,
    friend,
    meText: `${fmt(me)}${unit}`,
    friendText: `${fmt(friend)}${unit}`,
    deltaText: formatSigned(gap / tenth, (abs) => `${fmt(abs)}${unit}`),
    lead: gap > 0 ? 'me' : gap < 0 ? 'friend' : 'tie',
    mePct: max > 0 ? me / max : 0,
    friendPct: max > 0 ? friend / max : 0,
    sharePct: total > 0 ? me / total : 0.5,
  };
}

export function importedLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const day = date.toLocaleDateString('de-DE', { weekday: 'short' });
  const time = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `Karte importiert ${day}, ${time}`;
}

export function duelModel(me: WeekCard, friend: WeekCard, importedAt?: string): DuelModel {
  const kg = metric('kg', 'Bewegte kg', me.kg, friend.kg, kgText, '');
  return {
    meName: me.n,
    friendName: friend.n,
    weekLabel: `KW ${weekNumberOf(friend.w)}`,
    sameWeek: me.w === friend.w,
    metrics: {
      kg,
      km: metric('km', 'Cardio-km', me.km, friend.km, kmText, ''),
      s: metric('s', 'Einheiten', me.s, friend.s, countText, ''),
    },
    headline:
      kg.lead === 'friend' ? `${friend.n} führt!` : kg.lead === 'me' ? 'Du führst!' : 'Gleichstand!',
    status: duelStatus(me, friend),
    importedText: importedAt ? importedLabel(importedAt) : '',
  };
}

/** Second-player colour per skin: a clear contrast to the accent in every palette. */
export function friendColor(variant: string, accent2: string): string {
  if (variant === 'evolved') return '#22D3EE';
  if (variant === 'warm') return '#5C7C8A';
  return accent2;
}

export const initialOf = (name: string) => Array.from(name.trim())[0]?.toUpperCase() ?? '?';
