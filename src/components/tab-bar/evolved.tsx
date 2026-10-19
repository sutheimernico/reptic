import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/hooks/use-app-theme';
import { withAlpha } from '@/theme/color';
import { shadowStyle } from '@/theme/shape';

import { type TabBarProps, type TabItem, tabItems } from './shared';
import { useFade, useSlidingIndicator, useTabShift } from './motion';

const PAD = 6;
/** The active tab is this many "units" wide so "Einstellungen" fits at 11 pt on a 360 dp phone. */
const ACTIVE_WEIGHT = 2.1;

/** A: floating translucent pill; an accent-tinted indicator springs to the active tab, which shows its label. */
export function EvolvedTabBar(props: TabBarProps) {
  const theme = useAppTheme();
  const { colors: c } = theme;
  const insets = useSafeAreaInsets();
  const items = tabItems(props);
  const [width, setWidth] = useState(0);
  const unit = width > 0 ? (width - 2 - PAD * 2) / (items.length - 1 + ACTIVE_WEIGHT) : 0;
  const active = Math.max(0, items.findIndex((i) => i.focused));
  const indicator = useSlidingIndicator({
    active,
    target: active * unit,
    ready: unit > 0,
    max: (items.length - 1) * unit,
    mode: 'spring',
  });

  return (
    <View style={[styles.outer, { paddingBottom: Math.max(insets.bottom, 10) + 6, backgroundColor: c.background }]}>
      <View
        accessibilityRole="tablist"
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={[
          styles.bar,
          shadowStyle(theme),
          {
            backgroundColor: withAlpha(c.card, theme.scheme === 'dark' ? 0.86 : 0.92),
            borderColor: c.border,
            borderRadius: theme.shape.radius.xl,
          },
        ]}>
        {unit > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.indicator,
              {
                width: unit * ACTIVE_WEIGHT,
                borderRadius: theme.shape.radius.lg,
                backgroundColor: withAlpha(c.accent, 0.16),
                borderColor: withAlpha(c.accent, 0.4),
              },
              indicator,
            ]}
          />
        ) : null}
        {items.map((item, i) => (
          <EvolvedTab key={item.key} item={item} index={i} active={active} unit={unit} />
        ))}
      </View>
    </View>
  );
}

function EvolvedTab({
  item,
  index,
  active,
  unit,
}: {
  item: TabItem;
  index: number;
  active: number;
  unit: number;
}) {
  const { colors: c, fonts } = useAppTheme();
  const move = useTabShift({ index, active, unit, weight: ACTIVE_WEIGHT });
  const fade = useFade(item.focused);
  const color = item.focused ? c.accent : c.textSecondary;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={item.title}
      accessibilityState={{ selected: item.focused }}
      onPress={item.onPress}
      onLongPress={item.onLongPress}
      style={{ flex: item.focused ? ACTIVE_WEIGHT : 1 }}>
      <Animated.View style={[styles.tab, move]}>
        {item.icon(color, 22)}
        {item.focused ? (
          <Animated.View style={fade}>
            <Text numberOfLines={1} style={[styles.label, { color, fontFamily: fonts.label }]}>
              {item.title}
            </Text>
          </Animated.View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: { paddingHorizontal: 16, paddingTop: 6 },
  bar: { flexDirection: 'row', height: 66, padding: PAD, borderWidth: 1 },
  indicator: { position: 'absolute', top: PAD, bottom: PAD, left: PAD, borderWidth: 1 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontSize: 11 },
});
