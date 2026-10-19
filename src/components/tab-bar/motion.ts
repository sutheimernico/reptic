import { useEffect, useRef } from 'react';
import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '@/hooks/use-app-theme';
import { springFor, timingFor } from '@/theme/motion';

/**
 * Bars where the active tab is wider than the rest (it carries the label). Tab `i` starts at
 * `unit * (i + (weight - 1) if it lies right of the active one)` — the same numbers the flex
 * layout produces, so transforms can bridge between two layouts.
 */
export function expandedLeft(i: number, active: number, unit: number, weight: number): number {
  return unit * (i + (i > active ? weight - 1 : 0));
}

/**
 * translateX for a sliding indicator. The first time the bar has a width (mount, theme
 * switch) and on resize it snaps; only a change of the active tab animates.
 */
export function useSlidingIndicator({
  active,
  target,
  ready,
  mode,
  max,
}: {
  active: number;
  target: number;
  ready: boolean;
  /** Rightmost position; a bouncy spring is clamped so the indicator never leaves the bar. */
  max: number;
  mode: 'spring' | 'timing';
}) {
  const theme = useAppTheme();
  const reduced = useReducedMotion();
  const x = useSharedValue(target);
  const placed = useRef(false);
  const lastActive = useRef(active);

  useEffect(() => {
    if (!ready) {
      placed.current = false;
      return;
    }
    const changed = lastActive.current !== active;
    lastActive.current = active;
    if (!placed.current || !changed || reduced) {
      placed.current = true;
      x.set(target);
      return;
    }
    x.set(mode === 'spring' ? withSpring(target, springFor(theme)) : withTiming(target, timingFor(theme, 'base')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, target, ready, reduced]);

  return useAnimatedStyle(() => ({
    transform: [{ translateX: Math.min(Math.max(x.get(), 0), max) }],
  }));
}

/**
 * For a tab in an expanding bar: when the active tab changes, the layout jumps; this starts
 * the tab at its old position and slides it to the new one. Keyed on `active`, so every tab
 * (not only the two that changed focus) tracks the previous active index correctly.
 */
export function useTabShift({
  index,
  active,
  unit,
  weight,
}: {
  index: number;
  active: number;
  unit: number;
  weight: number;
}) {
  const theme = useAppTheme();
  const reduced = useReducedMotion();
  const tx = useSharedValue(0);
  const previous = useRef(active);

  useEffect(() => {
    const from = previous.current;
    previous.current = active;
    if (reduced || unit <= 0 || from === active) return;
    tx.set(expandedLeft(index, from, unit, weight) - expandedLeft(index, active, unit, weight));
    tx.set(withTiming(0, timingFor(theme, 'base')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return useAnimatedStyle(() => ({ transform: [{ translateX: tx.get() }] }));
}

/** Opacity that follows `on`; instant with reduced motion. */
export function useFade(on: boolean) {
  const theme = useAppTheme();
  const reduced = useReducedMotion();
  const o = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    o.set(reduced ? (on ? 1 : 0) : withTiming(on ? 1 : 0, timingFor(theme, 'base')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, reduced]);
  return useAnimatedStyle(() => ({ opacity: o.get() }));
}
