import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/hooks/use-app-theme';
import { withAlpha } from '@/theme/color';
import { springFor } from '@/theme/motion';
import { shadowStyle } from '@/theme/shape';

import { type TabBarProps, tabItems } from './shared';

const PAD = 6;

/** A: floating translucent pill; an accent-tinted indicator springs to the active tab. */
export function EvolvedTabBar(props: TabBarProps) {
  const theme = useAppTheme();
  const { colors: c, fonts } = theme;
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const items = tabItems(props);
  const [width, setWidth] = useState(0);
  const slot = width > 0 ? (width - PAD * 2) / items.length : 0;
  const active = Math.max(0, items.findIndex((i) => i.focused));

  const x = useSharedValue(active * slot);
  useEffect(() => {
    x.value = reduced ? active * slot : withSpring(active * slot, springFor(theme));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, slot, reduced]);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

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
        {slot > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.indicator,
              {
                width: slot,
                borderRadius: theme.shape.radius.lg,
                backgroundColor: withAlpha(c.accent, 0.16),
                borderColor: withAlpha(c.accent, 0.4),
              },
              indicator,
            ]}
          />
        ) : null}
        {items.map((item) => {
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
              {item.icon(color, 22)}
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                style={[styles.label, { color, fontFamily: fonts.label }]}>
                {item.title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { paddingHorizontal: 16, paddingTop: 6 },
  bar: { flexDirection: 'row', height: 66, padding: PAD, borderWidth: 1 },
  indicator: { position: 'absolute', top: PAD, bottom: PAD, left: PAD, borderWidth: 1 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontSize: 10 },
});
