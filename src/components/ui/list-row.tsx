import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface ListRowProps {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  onLongPress?: () => void;
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
  left,
  right,
  selected,
  accessibilityLabel,
}: ListRowProps) {
  const c = useTheme();
  const interactive = Boolean(onPress || onLongPress);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!interactive}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: selected ? c.backgroundSelected : c.card,
          borderColor: selected ? c.accent : c.border,
        },
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
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  texts: { flex: 1, gap: 1 },
  title: { fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
