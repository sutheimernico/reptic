import { useEffect, useState } from 'react';
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

import { type TabBarProps, tabItems } from './shared';

/** E: flat bar, numbered mono labels, a glowing scan line that slides (linearly) over the active tab. */
export function InstrumentTabBar(props: TabBarProps) {
  const theme = useAppTheme();
  const { colors: c, fonts } = theme;
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const items = tabItems(props);
  const [width, setWidth] = useState(0);
  const slot = width / items.length;
  const active = Math.max(0, items.findIndex((i) => i.focused));

  const x = useSharedValue(active * slot);
  useEffect(() => {
    x.value = reduced ? active * slot : withTiming(active * slot, timingFor(theme, 'base'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, slot, reduced]);
  const scan = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

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
      {slot > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.scan,
            { width: slot, backgroundColor: c.accent, shadowColor: c.accent },
            scan,
          ]}
        />
      ) : null}
      {items.map((item, i) => {
        const color = item.focused ? c.accent : c.textSecondary;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityLabel={item.title}
            accessibilityState={{ selected: item.focused }}
            onPress={item.onPress}
            onLongPress={item.onLongPress}
            style={styles.tab}>
            <Text style={[styles.index, { color, fontFamily: fonts.label }]}>
              {String(i + 1).padStart(2, '0')}
            </Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={[styles.label, { color, fontFamily: fonts.label }]}>
              {item.title.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', paddingTop: 10, borderTopWidth: 1 },
  scan: {
    position: 'absolute',
    top: -1,
    left: 0,
    height: 2,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 2 },
  index: { fontSize: 9, opacity: 0.6 },
  label: { fontSize: 8.5, letterSpacing: 0.2 },
});
