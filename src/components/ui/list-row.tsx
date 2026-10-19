import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ShadowFrame } from '@/components/ui/shadow-frame';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { shadowStyle } from '@/theme/shape';

interface ListRowProps {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Hold time (ms) before onLongPress fires. Lower it for a snappier drag start. */
  delayLongPress?: number;
  left?: ReactNode;
  right?: ReactNode;
  selected?: boolean;
  /** Overrides the auto-derived a11y label — e.g. to include info conveyed only by color. */
  accessibilityLabel?: string;
}

/** A tappable card-style row for lists (exercises, plans, history, …). */
export function ListRow({
  title,
  subtitle,
  onPress,
  onLongPress,
  delayLongPress,
  left,
  right,
  selected,
  accessibilityLabel,
}: ListRowProps) {
  const theme = useAppTheme();
  const { colors: c, shape } = theme;
  const interactive = Boolean(onPress || onLongPress);
  return (
    <ShadowFrame radius={shape.radius.md}>
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      disabled={!interactive}
      accessibilityRole={interactive ? 'button' : undefined}
      accessibilityState={selected !== undefined ? { selected } : undefined}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: selected ? c.backgroundSelected : c.card,
          borderColor: selected ? c.accent : c.border,
          borderWidth: shape.borderWidth,
          borderRadius: shape.radius.md,
        },
        shadowStyle(theme),
        pressed && interactive ? styles.pressed : null,
      ]}>
      {left}
      <View style={styles.texts}>
        <ThemedText style={styles.title}>{title}</ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {right}
    </Pressable>
    </ShadowFrame>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  texts: { flex: 1, gap: 1 },
  title: { fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
