/**
 * Re-run work when the app comes back to the foreground. A tab stays mounted and focused while the
 * app sleeps, so `useFocusEffect` alone never fires for "I opened the app the next morning".
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

export function useOnResume(callback: () => void): void {
  const latest = useRef(callback);
  useEffect(() => {
    latest.current = callback;
  }, [callback]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') latest.current();
    });
    return () => subscription.remove();
  }, []);
}

/**
 * The current time as state, refreshed on resume. Reading `new Date()` during render is not enough:
 * the React Compiler caches such a value for as long as the component stays mounted.
 * Screens that also want it on focus refresh it from their own focus effect via the setter.
 */
export function useNow(): [Date, () => void] {
  const [now, setNow] = useState(() => new Date());
  const refresh = useCallback(() => setNow(new Date()), []);
  useOnResume(refresh);
  return [now, refresh];
}
