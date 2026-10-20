import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import { ThemedText, type ThemedTextProps } from '@/components/themed-text';
import { useAppTheme } from '@/hooks/use-app-theme';
import { revealMs } from '@/theme/motion';

/** Counted in JS, not on the UI thread: Text content cannot be animated by transform/opacity. */
function useCountedValue(target: number, durationMs: number, enabled: boolean): number {
  const [shown, setShown] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const from = fromRef.current;
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / durationMs);
      const value = from + (target - from) * (1 - Math.pow(1 - t, 3));
      fromRef.current = value;
      setShown(value);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, enabled]);

  return enabled ? shown : target;
}

/**
 * A number that counts up to `value` (from 0 on first render, from the previous
 * value afterwards). With reduced motion it is plain text.
 */
export function CountUp({
  value,
  format = (n) => String(Math.round(n)),
  ...rest
}: { value: number; format?: (n: number) => string } & Omit<ThemedTextProps, 'children'>) {
  const theme = useAppTheme();
  const reduced = useReducedMotion();
  const shown = useCountedValue(value, revealMs(theme, 2), !reduced);
  return (
    <ThemedText {...rest} accessibilityLabel={format(value)}>
      {format(shown)}
    </ThemedText>
  );
}
