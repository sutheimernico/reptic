import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/hooks/use-app-theme';
import { shadowStyle } from '@/theme/shape';

import { type TabBarProps, type TabItem, tabItems } from './shared';
import { useFade, useSlidingIndicator, useTabShift } from './motion';

const PAD = 7;
/** The active tab is this many "units" wide (icon + label); wide enough for "Einstellungen" on 360 dp. */
const ACTIVE_WEIGHT = 2.7;

/**
 * C: soft pill bar. The active tab expands to icon + label. Width changes are layout, so
 * they are not animated; instead every tab slides from its old position to the new one
 * with a transform, and the pill glides to the active tab.
 */
export function WarmTabBar(props: TabBarProps) {
  const theme = useAppTheme();
  const { colors: c } = theme;
  const insets = useSafeAreaInsets();
  const items = tabItems(props);
  const [width, setWidth] = useState(0);
  const unit = width > 0 ? (width - PAD * 2) / (items.length - 1 + ACTIVE_WEIGHT) : 0;
  const active = Math.max(0, items.findIndex((i) => i.focused));
  const pill = useSlidingIndicator({
    active,
    target: active * unit,
    ready: unit > 0,
    max: (items.length - 1) * unit,
    mode: 'timing',
  });

  return (
    <View style={[styles.outer, { paddingBottom: Math.max(insets.bottom, 10) + 6, backgroundColor: c.background }]}>
      <View
        accessibilityRole="tablist"
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={[
          styles.bar,
          shadowStyle(theme),
          { backgroundColor: c.card, borderRadius: theme.shape.radius.xl + 4 },
        ]}>
        {unit > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.pill, { width: unit * ACTIVE_WEIGHT, backgroundColor: c.accent }, pill]}
          />
        ) : null}
        {items.map((item, i) => (
          <WarmTab key={item.key} item={item} index={i} active={active} unit={unit} />
        ))}
      </View>
    </View>
  );
}

function WarmTab({
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
  const color = item.focused ? c.onAccent : c.textSecondary;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={item.title}
      accessibilityState={{ selected: item.focused }}
      onPress={item.onPress}
      onLongPress={item.onLongPress}
      style={{ flex: item.focused ? ACTIVE_WEIGHT : 1 }}>
      <Animated.View style={[styles.tab, move]}>
        {item.icon(color, 21)}
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
  outer: { paddingHorizontal: 14, paddingTop: 6 },
  bar: { flexDirection: 'row', height: 64, padding: PAD },
  pill: { position: 'absolute', top: PAD, bottom: PAD, left: PAD, borderRadius: 999 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  label: { fontSize: 12.5 },
});
