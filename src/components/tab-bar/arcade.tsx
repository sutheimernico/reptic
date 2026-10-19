import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/motion/pressable-scale';
import { ShadowFrame } from '@/components/ui/shadow-frame';
import { useAppTheme } from '@/hooks/use-app-theme';
import { springFor, timingFor } from '@/theme/motion';
import { shadowStyle } from '@/theme/shape';

import { useTabShift } from './motion';
import { type TabBarProps, type TabItem, tabItems } from './shared';

const RAISE_PX = 7;
const PAD = 6;
const GAP = 4;
/** The active tab is this many "units" wide so "Einstellungen" fits at 11 pt on a 360 dp phone. */
const ACTIVE_WEIGHT = 2.2;

/** D: chunky outlined bar; the active tab pops up, tilts and fills with the accent. */
export function ArcadeTabBar(props: TabBarProps) {
  const theme = useAppTheme();
  const { colors: c } = theme;
  const insets = useSafeAreaInsets();
  const items = tabItems(props);
  const [width, setWidth] = useState(0);
  const inner = width - theme.shape.borderWidth * 2 - PAD * 2 - GAP * (items.length - 1);
  const unit = width > 0 ? inner / (items.length - 1 + ACTIVE_WEIGHT) : 0;
  const active = Math.max(0, items.findIndex((i) => i.focused));

  return (
    <View
      style={[
        styles.outer,
        { paddingBottom: Math.max(insets.bottom, 10) + 6, backgroundColor: c.background },
      ]}>
      <ShadowFrame radius={20}>
        <View
          accessibilityRole="tablist"
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          style={[
            styles.bar,
            shadowStyle(theme),
            { backgroundColor: c.card, borderColor: c.border, borderWidth: theme.shape.borderWidth },
          ]}>
          {items.map((item, i) => (
            <ArcadeTab key={item.key} item={item} index={i} active={active} unit={unit} />
          ))}
        </View>
      </ShadowFrame>
    </View>
  );
}

function ArcadeTab({
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
  const theme = useAppTheme();
  const { colors: c, fonts } = theme;
  const reduced = useReducedMotion();
  const lift = useSharedValue(item.focused ? 1 : 0);
  const fillOpacity = useSharedValue(item.focused ? 1 : 0);
  const labelOpacity = useSharedValue(item.focused ? 1 : 0);
  // Gaps are constant between layouts, so only the unit-based widths matter for the slide.
  const move = useTabShift({ index, active, unit, weight: ACTIVE_WEIGHT });

  useEffect(() => {
    const on = item.focused ? 1 : 0;
    if (reduced) {
      lift.set(on);
      fillOpacity.set(on);
      labelOpacity.set(on);
      return;
    }
    // The bouncy spring only drives movement; the colour fill uses a plain timing so it is done in 200 ms.
    lift.set(withSpring(on, springFor(theme)));
    fillOpacity.set(withTiming(on, timingFor(theme, 'base')));
    // The label mounts with the focus, so it fades in instead of popping on top of the sliding fill.
    labelOpacity.set(withTiming(on, timingFor(theme, 'fast')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.focused, reduced]);

  const raised = useAnimatedStyle(() => ({
    transform: reduced
      ? []
      : [{ translateY: -RAISE_PX * lift.get() }, { rotate: `${-2 * lift.get()}deg` }],
  }));
  const fill = useAnimatedStyle(() => ({ opacity: fillOpacity.get() }));
  const labelFade = useAnimatedStyle(() => ({ opacity: labelOpacity.get() }));
  const color = item.focused ? c.onAccent : c.textSecondary;

  return (
    <PressableScale
      accessibilityRole="tab"
      accessibilityLabel={item.title}
      accessibilityState={{ selected: item.focused }}
      onPress={item.onPress}
      onLongPress={item.onLongPress}
      style={{ flex: item.focused ? ACTIVE_WEIGHT : 1 }}>
      <Animated.View style={[styles.slotInner, move]}>
        <Animated.View style={[styles.tab, raised]}>
          <Animated.View
            pointerEvents="none"
            style={[styles.fill, { backgroundColor: c.accent, borderColor: c.border }, fill]}
          />
          {item.icon(color, 20)}
          {item.focused ? (
            <Animated.Text
              numberOfLines={1}
              style={[styles.label, { color, fontFamily: fonts.label }, labelFade]}>
              {item.title}
            </Animated.Text>
          ) : null}
        </Animated.View>
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  outer: { paddingHorizontal: 14, paddingTop: 14 },
  bar: { flexDirection: 'row', height: 66, borderRadius: 20, padding: PAD, gap: GAP },
  slotInner: { flex: 1 },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 14,
    paddingHorizontal: 2,
  },
  fill: {
    ...StyleSheet.absoluteFill,
    borderRadius: 14,
    borderWidth: 2,
    shadowColor: '#161616',
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  label: { fontSize: 11 },
});
