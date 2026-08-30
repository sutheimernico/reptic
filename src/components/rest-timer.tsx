import Ionicons from '@expo/vector-icons/Ionicons';
import { useSQLiteContext } from 'expo-sqlite';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { getSetting, setSetting } from '@/db';
import { formatDuration } from '@/domain/format';
import {
  DEFAULT_REST_SECONDS,
  parseRestSeconds,
  REST_OFF,
  REST_TIMER_SETTING,
  type RestTimer,
  remainingSeconds,
} from '@/domain/rest-timer';
import { useTheme } from '@/hooks/use-theme';

interface RestTimerContextValue {
  /** The running timer, or null when none was started (or it was dismissed). */
  timer: RestTimer | null;
  /** Configured duration in seconds; `REST_OFF` disables the feature. */
  durationSec: number;
  /** Start (or restart) the rest timer — called when a set is ticked done. */
  start: () => void;
  dismiss: () => void;
  setDurationSec: (seconds: number) => void;
}

const RestTimerContext = createContext<RestTimerContextValue | null>(null);

/**
 * Holds the rest timer for the whole session flow, so it survives navigating
 * from the set screen back to the session list and into the next exercise.
 *
 * Deliberately stores only the start timestamp and duration — never a
 * counting-down number. The per-second tick lives in the banner below, not
 * here: a `now` state in this provider would re-render the entire app once a
 * second.
 */
export function RestTimerProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [timer, setTimer] = useState<RestTimer | null>(null);
  const [durationSec, setDurationState] = useState(DEFAULT_REST_SECONDS);

  useEffect(() => {
    let active = true;
    getSetting(db, REST_TIMER_SETTING).then((value) => {
      if (active) setDurationState(parseRestSeconds(value));
    });
    return () => {
      active = false;
    };
  }, [db]);

  const start = useCallback(() => {
    if (durationSec === REST_OFF) return;
    setTimer({ startedAtMs: Date.now(), durationSec });
  }, [durationSec]);

  const dismiss = useCallback(() => setTimer(null), []);

  const setDurationSec = useCallback(
    (seconds: number) => {
      setDurationState(seconds);
      void setSetting(db, REST_TIMER_SETTING, String(seconds));
      if (seconds === REST_OFF) setTimer(null);
    },
    [db],
  );

  // Stable identity: consumers put `start` / `dismiss` in effect dependencies.
  const value = useMemo(
    () => ({ timer, durationSec, start, dismiss, setDurationSec }),
    [timer, durationSec, start, dismiss, setDurationSec],
  );

  return <RestTimerContext.Provider value={value}>{children}</RestTimerContext.Provider>;
}

export function useRestTimer(): RestTimerContextValue {
  const ctx = useContext(RestTimerContext);
  if (!ctx) throw new Error('useRestTimer must be used within a RestTimerProvider');
  return ctx;
}

/**
 * The slim bar above the session footer. Renders nothing while no timer runs.
 *
 * The seconds tick is local state here so only this bar re-renders; the
 * remaining time is recomputed from the wall clock on every tick, which is why
 * coming back from two minutes in the background shows "Pause vorbei" instead
 * of a stale countdown.
 */
export function RestTimerBanner({ onExpire }: { onExpire?: () => void }) {
  const c = useTheme();
  const { timer, dismiss } = useRestTimer();
  const [now, setNow] = useState(() => Date.now());
  const firedFor = useRef<number | null>(null);

  // `now` is a snapshot from the last tick, so right after a timer starts it
  // can still be seconds old and make the countdown read higher than the
  // configured rest. Capping at the duration removes that first-frame blip;
  // one tick later the value is exact.
  const remaining = timer
    ? Math.min(timer.durationSec, remainingSeconds(timer, now))
    : 0;
  const expired = timer !== null && remaining === 0;

  // Stops ticking once the rest is over — nothing changes after that until the
  // user dismisses the bar or the next set restarts it.
  useEffect(() => {
    if (!timer || expired) return;
    const handle = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(handle);
  }, [timer, expired]);

  // Fire the end signal once per timer, keyed by its start timestamp.
  useEffect(() => {
    if (!timer || !expired) return;
    if (firedFor.current === timer.startedAtMs) return;
    firedFor.current = timer.startedAtMs;
    onExpire?.();
  }, [timer, expired, onExpire]);

  if (!timer) return null;

  return (
    <View
      accessibilityRole="timer"
      accessibilityLabel={expired ? 'Pause vorbei' : `Pause, noch ${remaining} Sekunden`}
      style={[
        styles.bar,
        {
          backgroundColor: expired ? c.success : c.backgroundElement,
          borderColor: expired ? c.success : c.border,
        },
      ]}>
      <Ionicons
        name={expired ? 'checkmark-circle' : 'time-outline'}
        size={18}
        color={expired ? c.onAccent : c.textSecondary}
      />
      <Text style={[styles.label, { color: expired ? c.onAccent : c.text }]}>
        {expired ? 'Pause vorbei' : `Pause ${formatDuration(remaining)}`}
      </Text>
      <Pressable
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel="Pause beenden"
        hitSlop={8}
        style={styles.dismiss}>
        <Text style={[styles.dismissText, { color: expired ? c.onAccent : c.accent }]}>Weiter</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two,
    paddingVertical: 10,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  label: { flex: 1, fontSize: 15, fontWeight: '700' },
  dismiss: { paddingHorizontal: Spacing.one },
  dismissText: { fontSize: 15, fontWeight: '700' },
});
