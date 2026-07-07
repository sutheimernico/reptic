/**
 * Pure month-grid math for the history calendar screen. Weeks start on Monday
 * (German convention). Months are 0-based throughout, matching JS Date.
 */

import { MONTHS_DE } from '@/domain/format';

export interface MonthCell {
  /** Day of month, or null for a leading/trailing blank cell. */
  day: number | null;
  /** Stable unique key for list rendering. */
  key: string;
}

/** The month as rows of 7 cells, Monday-first, padded with blanks. */
export function buildMonthGrid(year: number, month0: number): MonthCell[][] {
  const leadingBlanks = (new Date(year, month0, 1).getDay() + 6) % 7; // Mon=0 … Sun=6
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();

  const cells: MonthCell[] = [];
  for (let i = 0; i < leadingBlanks; i += 1) cells.push({ day: null, key: `lead-${i}` });
  for (let day = 1; day <= daysInMonth; day += 1) cells.push({ day, key: `day-${day}` });
  while (cells.length % 7 !== 0) cells.push({ day: null, key: `trail-${cells.length}` });

  const weeks: MonthCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function shiftMonth(
  year: number,
  month0: number,
  delta: -1 | 1,
): { year: number; month0: number } {
  const shifted = new Date(year, month0 + delta, 1);
  return { year: shifted.getFullYear(), month0: shifted.getMonth() };
}

export function monthTitle(year: number, month0: number): string {
  return `${MONTHS_DE[month0]} ${year}`;
}

/** Day of month of an ISO timestamp, in the device's local timezone. */
export function localDayOf(iso: string): number {
  return new Date(iso).getDate();
}
