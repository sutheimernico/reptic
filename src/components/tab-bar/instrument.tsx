import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/hooks/use-app-theme';

import { type TabBarProps, type TabItem, tabItems } from './shared';
import { useFade, useSlidingIndicator, useTabShift } from './motion';

/** The active tab is this many "units" wide so `05 EINSTELLUNGEN` fits at 11 pt on 360 dp. */
const ACTIVE_WEIGHT = 2.3;

/**
 * E: flat bar. Inactive tabs show only their number, the active one `NN LABEL`; a glowing
 * scan line slides (linearly) along the top edge over the active tab.
 */
export function InstrumentTabBar(props: TabBarProps) {
  const theme = useAppTheme();
  const { colors: c } = theme;
  const insets = useSafeAreaInsets();
  const items = tabItems(props);
  const [width, setWidth] = useState(0);
  const unit = width > 0 ? width / (items.length - 1 + ACTIVE_WEIGHT) : 0;
  const active = Math.max(0, items.findIndex((i) => i.focused));
  const scan = useSlidingIndicator({
    active,
    target: active * unit,
    ready: unit > 0,
    max: (items.length - 1) * unit,
    mode: 'timing',
  });

  return (
    <View
      accessibilityRole="tablist"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[
        styles.bar,
        {
          paddingBottom: Math.max(insets.bottom, 8) + 4,
          backgroundColor: c.backgroundElement,
          borderTopColor: c.border,
        },
      ]}>
      {unit > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.scan,
            { width: unit * ACTIVE_WEIGHT, backgroundColor: c.accent, shadowColor: c.accent },
            scan,
          ]}
        />
      ) : null}
      {items.map((item, i) => (
        <InstrumentTab key={item.key} item={item} index={i} active={active} unit={unit} />
      ))}
    </View>
  );
}

function InstrumentTab({
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
  const number = String(index + 1).padStart(2, '0');
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={item.title}
      accessibilityState={{ selected: item.focused }}
      onPress={item.onPress}
      onLongPress={item.onLongPress}
      style={{ flex: item.focused ? ACTIVE_WEIGHT : 1 }}>
      <Animated.View style={[styles.tab, move]}>
        <Text style={[styles.text, { color, fontFamily: fonts.label }]}>{number}</Text>
        {item.focused ? (
          <Animated.View style={fade}>
            <Text numberOfLines={1} style={[styles.text, { color, fontFamily: fonts.label }]}>
              {item.title.toUpperCase()}
            </Text>
          </Animated.View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', paddingTop: 12, borderTopWidth: 1 },
  scan: {
    position: 'absolute',
    top: -1,
    left: 0,
    height: 2,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  text: { fontSize: 11, letterSpacing: 0.2 },
});
