import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/hooks/use-app-theme';
import { timingFor } from '@/theme/motion';
import { shadowStyle } from '@/theme/shape';

import { type TabBarProps, type TabItem, tabItems } from './shared';

const PAD = 7;
/** The active tab is this many "units" wide (icon + label), every other tab is one. */
const ACTIVE_WEIGHT = 2.4;

/** Left edge of tab `i` inside the bar when tab `active` is expanded. */
function leftOf(i: number, active: number, unit: number): number {
  return unit * (i + (i > active ? ACTIVE_WEIGHT - 1 : 0));
}

/**
 * C: soft pill bar. The active tab expands to icon + label. Width changes are layout, so
 * they are not animated; instead every tab starts from its old position and slides to the
 * new one with a transform, and the pill glides to the active tab.
 */
export function WarmTabBar(props: TabBarProps) {
  const theme = useAppTheme();
  const { colors: c } = theme;
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const items = tabItems(props);
  const [width, setWidth] = useState(0);
  const unit = width > 0 ? (width - PAD * 2) / (items.length - 1 + ACTIVE_WEIGHT) : 0;
  const active = Math.max(0, items.findIndex((i) => i.focused));

  const x = useSharedValue(active * unit);
  useEffect(() => {
    x.value = reduced ? active * unit : withTiming(active * unit, timingFor(theme, 'base'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, unit, reduced]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

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
            style={[
              styles.pill,
              { width: unit * ACTIVE_WEIGHT, backgroundColor: c.accent },
              pill,
            ]}
          />
        ) : null}
        {items.map((item, i) => (
          <WarmTab
            key={item.key}
            item={item}
            index={i}
            active={active}
            unit={unit}
            reduced={reduced}
          />
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
  reduced,
}: {
  item: TabItem;
  index: number;
  active: number;
  unit: number;
  reduced: boolean;
}) {
  const theme = useAppTheme();
  const { colors: c, fonts } = theme;
  const tx = useSharedValue(0);
  const labelOpacity = useSharedValue(item.focused ? 1 : 0);

  const previous = useRef(active);

  // Runs on focus changes only; `unit` is deliberately read at that moment.
  useEffect(() => {
    const shift = unit > 0 ? leftOf(index, previous.current, unit) - leftOf(index, active, unit) : 0;
    previous.current = active;
    if (reduced) {
      tx.value = 0;
      labelOpacity.value = item.focused ? 1 : 0;
      return;
    }
    tx.value = shift;
    tx.value = withTiming(0, timingFor(theme, 'base'));
    labelOpacity.value = withTiming(item.focused ? 1 : 0, timingFor(theme, 'base'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.focused]);

  const move = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));
  const fade = useAnimatedStyle(() => ({ opacity: labelOpacity.value }));
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
  pill: {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: 999,
  },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  label: { fontSize: 12.5 },
});
