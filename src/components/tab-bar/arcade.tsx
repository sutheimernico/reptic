import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/motion/pressable-scale';
import { ShadowFrame } from '@/components/ui/shadow-frame';
import { useAppTheme } from '@/hooks/use-app-theme';
import { springFor } from '@/theme/motion';
import { shadowStyle } from '@/theme/shape';

import { type TabBarProps, type TabItem, tabItems } from './shared';

const RAISE_PX = 7;

/** D: chunky outlined bar; the active tab pops up, tilts and fills with the accent on a bouncy spring. */
export function ArcadeTabBar(props: TabBarProps) {
  const theme = useAppTheme();
  const { colors: c } = theme;
  const insets = useSafeAreaInsets();
  const items = tabItems(props);

  return (
    <View
      style={[
        styles.outer,
        { paddingBottom: Math.max(insets.bottom, 10) + 6, backgroundColor: c.background },
      ]}>
      <ShadowFrame radius={20}>
        <View
          accessibilityRole="tablist"
          style={[
            styles.bar,
            shadowStyle(theme),
            { backgroundColor: c.card, borderColor: c.border, borderWidth: theme.shape.borderWidth },
          ]}>
          {items.map((item) => (
            <ArcadeTab key={item.key} item={item} />
          ))}
        </View>
      </ShadowFrame>
    </View>
  );
}

function ArcadeTab({ item }: { item: TabItem }) {
  const theme = useAppTheme();
  const { colors: c, fonts } = theme;
  const reduced = useReducedMotion();
  const lift = useSharedValue(item.focused ? 1 : 0);

  useEffect(() => {
    lift.value = reduced ? (item.focused ? 1 : 0) : withSpring(item.focused ? 1 : 0, springFor(theme));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.focused, reduced]);

  const raised = useAnimatedStyle(() => ({
    transform: reduced
      ? []
      : [{ translateY: -RAISE_PX * lift.value }, { rotate: `${-2 * lift.value}deg` }],
  }));
  // Clamped: the spring overshoots, opacity must not.
  const fill = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, lift.value)) }));
  const color = item.focused ? c.onAccent : c.textSecondary;

  return (
    <PressableScale
      accessibilityRole="tab"
      accessibilityLabel={item.title}
      accessibilityState={{ selected: item.focused }}
      onPress={item.onPress}
      onLongPress={item.onLongPress}
      style={styles.slot}>
      <Animated.View style={[styles.tab, raised]}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.fill,
            { backgroundColor: c.accent, borderColor: c.border },
            fill,
          ]}
        />
        {item.icon(color, 20)}
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={[styles.label, { color, fontFamily: fonts.label }]}>
          {item.title}
        </Text>
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  outer: { paddingHorizontal: 14, paddingTop: 14 },
  bar: { flexDirection: 'row', height: 66, borderRadius: 20, padding: 6, gap: 4 },
  slot: { flex: 1 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 14 },
  fill: {
    ...StyleSheet.absoluteFill,
    borderRadius: 14,
    borderWidth: 2,
    shadowColor: '#161616',
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  label: { fontSize: 8.5 },
});
