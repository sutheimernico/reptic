import Ionicons from '@expo/vector-icons/Ionicons';
import { useSQLiteContext } from 'expo-sqlite';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';
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
import { useAppTheme } from '@/hooks/use-app-theme';
import { useTheme } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';
import { withAlpha } from '@/theme/color';

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

  // The end signal fires here, not in the banner: the session screen stays
  // mounted underneath the set screen, so two banners would buzz twice.
  useEffect(() => {
    if (!timer) return;
    const endMs = timer.startedAtMs + timer.durationSec * 1000;
    const remainingMs = endMs - Date.now();
    if (remainingMs <= 0) return; // already over (e.g. restored after a long pause)
    const handle = setTimeout(() => {
      // Timers are throttled while the app is backgrounded, so this can fire
      // long after the rest actually ended. A buzz minutes late is noise, not
      // information — only signal when it is still roughly on time.
      if (Date.now() - endMs < 5000) haptic('rest-over');
    }, remainingMs);
    return () => clearTimeout(handle);
  }, [timer]);

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
export function RestTimerBanner() {
  const c = useTheme();
  const { shape, fonts } = useAppTheme();
  const { timer, dismiss } = useRestTimer();
  const [now, setNow] = useState(() => Date.now());

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

  // The fill is one linear tween over the whole rest, not a per-second jump. It is started
  // from the wall-clock position so a banner mounted mid-rest (or after a background) is right.
  // Reduced motion: no tween, the fill just steps with the per-second tick.
  const reduced = useReducedMotion();
  const [barWidth, setBarWidth] = useState(0);
  const fill = useSharedValue(0);
  const startedAtMs = timer?.startedAtMs;
  const durationSec = timer?.durationSec;
  useEffect(() => {
    if (startedAtMs === undefined || durationSec === undefined) return;
    const totalMs = durationSec * 1000;
    const elapsed = Math.min(totalMs, Math.max(0, Date.now() - startedAtMs));
    fill.set(elapsed / totalMs);
    if (!reduced && elapsed < totalMs) {
      fill.set(withTiming(1, { duration: totalMs - elapsed, easing: Easing.linear }));
    }
  }, [startedAtMs, durationSec, reduced, fill]);
  useEffect(() => {
    if (reduced && durationSec) fill.set(1 - remaining / durationSec);
  }, [reduced, remaining, durationSec, fill]);
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (fill.get() - 1) * barWidth }],
  }));

  if (!timer) return null;

  return (
    <View
      onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      accessibilityRole="timer"
      accessibilityLabel={expired ? 'Pause vorbei' : `Pause, noch ${remaining} Sekunden`}
      style={[
        styles.bar,
        {
          backgroundColor: expired ? c.success : c.backgroundElement,
          borderColor: expired ? c.success : c.border,
          borderWidth: shape.borderWidth,
          borderRadius: shape.radius.md,
        },
      ]}>
      {/* Hidden until measured: translateX with barWidth 0 would flash the full-width fill. */}
      {expired || barWidth === 0 ? null : (
        <Animated.View
          testID="rest-fill"
          pointerEvents="none"
          style={[styles.fill, { backgroundColor: withAlpha(c.accent, 0.18) }, fillStyle]}
        />
      )}
      <Ionicons
        name={expired ? 'checkmark-circle' : 'time-outline'}
        size={18}
        color={expired ? c.onAccent : c.textSecondary}
      />
      <Text
        style={[
          styles.label,
          { color: expired ? c.onAccent : c.text, fontFamily: fonts.bodyBold },
        ]}>
        {expired ? 'Pause vorbei' : `Pause ${formatDuration(remaining)}`}
      </Text>
      <Pressable
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel="Pause beenden"
        hitSlop={8}
        style={styles.dismiss}>
        <Text
          style={[
            styles.dismissText,
            { color: expired ? c.onAccent : c.accent, fontFamily: fonts.bodyBold },
          ]}>
          Weiter
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two,
    paddingVertical: 10,
    paddingHorizontal: Spacing.three,
  },
  fill: { ...StyleSheet.absoluteFill },
  label: { flex: 1, fontSize: 15 },
  dismiss: { paddingHorizontal: Spacing.one },
  dismissText: { fontSize: 15 },
});
