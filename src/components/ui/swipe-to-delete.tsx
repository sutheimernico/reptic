import Ionicons from '@expo/vector-icons/Ionicons';
import { type ReactNode, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useTheme } from '@/hooks/use-theme';

interface SwipeToDeleteProps {
  children: ReactNode;
  /** `close` springs the row back — for a delete the caller decided against. */
  onDelete: (close: () => void) => void;
  /** Spoken by screen readers on the revealed delete button. */
  accessibilityLabel?: string;
}

/**
 * Wraps a row so a left-to-right swipe reveals a red trash panel; releasing
 * past the threshold opens it and deletes. The revealed panel is also a plain
 * button, so tapping it (or activating it with a screen reader) deletes too.
 */
export function SwipeToDelete({ children, onDelete, accessibilityLabel }: SwipeToDeleteProps) {
  const c = useTheme();
  const { shape } = useAppTheme();
  const r = shape.radius.md;
  const swipeable = useRef<SwipeableMethods>(null);
  const close = () => swipeable.current?.close();

  const renderLeftActions = (
    _progress: unknown,
    _translation: unknown,
    methods: SwipeableMethods,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.action,
        {
          backgroundColor: c.danger,
          borderTopLeftRadius: r,
          borderBottomLeftRadius: r,
          marginRight: -r,
          paddingRight: r,
        },
      ]}
      onPress={() => {
        methods.close();
        onDelete(close);
      }}>
      <View style={styles.iconBox}>
        <Ionicons name="trash" size={22} color="#FFFFFF" />
      </View>
    </Pressable>
  );

  return (
    // Only left actions are rendered, so any "open" is a delete — no direction
    // check needed. Low friction + a modest threshold make a normal swipe
    // settle open (and thus delete) instead of springing back.
    <ReanimatedSwipeable
      ref={swipeable}
      friction={1}
      leftThreshold={40}
      renderLeftActions={renderLeftActions}
      onSwipeableOpen={() => onDelete(close)}>
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  action: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  iconBox: { paddingHorizontal: Spacing.four },
});
