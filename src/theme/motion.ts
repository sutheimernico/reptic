/**
 * Motion helpers shared by every animated component: all of them read the active
 * theme, so the four themes feel different without any per-screen branching.
 */

import { Easing, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated';

import type { AppTheme } from './themes';

/** A long list must not make the last row wait seconds: stagger stops after this many items. */
export const MAX_STAGGERED_ITEMS = 8;

/** The last staggered row starts at most this late, whatever the theme's pace (warm would take 1.4 s). */
export const STAGGER_BUDGET_MS = 200;

export function staggerDelay(index: number, theme: AppTheme): number {
  const step = Math.min(theme.motion.durationMs.fast, STAGGER_BUDGET_MS / MAX_STAGGERED_ITEMS);
  return Math.min(Math.max(index, 0), MAX_STAGGERED_ITEMS) * step;
}

export function springFor(theme: AppTheme): WithSpringConfig {
  const { damping, stiffness, mass } = theme.motion.spring;
  return { damping, stiffness, mass };
}

/** Instrument is mechanical (linear), warm is calm (ease-out), the rest use a standard ease-out. */
export function timingFor(theme: AppTheme, speed: 'fast' | 'base' | 'slow'): WithTimingConfig {
  const easing = theme.variant === 'instrument' ? Easing.linear : Easing.out(Easing.cubic);
  return { duration: theme.motion.durationMs[speed], easing };
}
