import { StyleSheet, View, type ViewProps } from 'react-native';

import { ShadowFrame } from '@/components/ui/shadow-frame';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { shadowStyle } from '@/theme/shape';

/** Themed surface: card background, themed border, radius and shadow, padding. */
export function Card({ style, children, ...rest }: ViewProps) {
  const theme = useAppTheme();
  const { colors: c, shape } = theme;
  return (
    <ShadowFrame radius={shape.radius.lg}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: c.card,
            borderColor: c.border,
            borderWidth: shape.borderWidth,
            borderRadius: shape.radius.lg,
          },
          shadowStyle(theme),
          style,
        ]}
        {...rest}>
        {children}
      </View>
    </ShadowFrame>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
  },
});
