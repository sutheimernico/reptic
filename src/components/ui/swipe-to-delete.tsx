import Ionicons from '@expo/vector-icons/Ionicons';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, {
  SwipeDirection,
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface SwipeToDeleteProps {
  children: ReactNode;
  onDelete: () => void;
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

  const renderLeftActions = (
    _progress: unknown,
    _translation: unknown,
    methods: SwipeableMethods,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.action, { backgroundColor: c.danger }]}
      onPress={() => {
        methods.close();
        onDelete();
      }}>
      <View style={styles.iconBox}>
        <Ionicons name="trash" size={22} color="#FFFFFF" />
      </View>
    </Pressable>
  );

  return (
    <ReanimatedSwipeable
      friction={2}
      leftThreshold={64}
      renderLeftActions={renderLeftActions}
      onSwipeableOpen={(direction) => {
        if (direction === SwipeDirection.LEFT) onDelete();
      }}>
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  action: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    borderTopLeftRadius: Radius.md,
    borderBottomLeftRadius: Radius.md,
    marginRight: -Radius.md,
    paddingRight: Radius.md,
  },
  iconBox: { paddingHorizontal: Spacing.four },
});
