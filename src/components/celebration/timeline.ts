import { useEffect } from 'react';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';

/** Total runtime of any celebration: short enough to never be in the way. */
export const CELEBRATION_MS = 1200;

/** A 0 → 1 clock that starts on mount; every piece of a celebration derives from it. */
export function useTimeline() {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: CELEBRATION_MS, easing: Easing.linear });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return t;
}

export type CelebrationKind = 'pr' | 'goal';

export interface SkinProps {
  kind: CelebrationKind;
  label: string;
}
