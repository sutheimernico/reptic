import { StyleSheet, View, type ViewProps } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Themed surface: card background, hairline border, rounded corners, padding. */
export function Card({ style, children, ...rest }: ViewProps) {
  const c = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
  },
});
