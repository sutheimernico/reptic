import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatElapsed } from '@/domain/format';
import { elapsedSeconds } from '@/domain/session';
import { useTheme } from '@/hooks/use-theme';

/**
 * How long the running session has lasted, for a screen header.
 *
 * Timestamp-based like the rest timer: every tick recomputes now − start, so
 * after the phone was locked for ten minutes the next tick simply shows ten
 * minutes more — nothing to catch up, nothing frozen. The one-second tick is
 * local state, so only this text re-renders, never the screen underneath.
 */
export function SessionClock({ startedAt }: { startedAt: string | null }) {
  const c = useTheme();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const handle = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(handle);
  }, [startedAt]);

  if (!startedAt) return null;
  const seconds = elapsedSeconds(startedAt, now);
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="timer"
      accessibilityLabel={`Trainingsdauer ${Math.floor(seconds / 60)} Minuten`}>
      <Ionicons name="stopwatch-outline" size={16} color={c.textSecondary} />
      <Text style={[styles.time, { color: c.text }]}>{formatElapsed(seconds)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // Fixed-width digits, or the header text jitters every second.
  time: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
