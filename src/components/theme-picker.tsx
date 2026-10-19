import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useTheme } from '@/hooks/use-theme';
import { PALETTES } from '@/theme/palettes';
import { useThemeMode } from '@/theme/theme-provider';
import { THEME_OPTIONS } from '@/theme/themes';

/** Four selectable design cards with a palette preview; tapping applies immediately. */
export function ThemePicker() {
  const { variant, setVariant } = useThemeMode();
  const c = useTheme();
  const { shape } = useAppTheme();
  return (
    <View style={styles.list} accessibilityRole="radiogroup">
      {THEME_OPTIONS.map((option) => {
        const checked = option.variant === variant;
        const palette = PALETTES[option.variant];
        const swatch = palette.light ?? palette.dark!;
        return (
          <Pressable
            key={option.variant}
            onPress={() => setVariant(option.variant)}
            accessibilityRole="radio"
            accessibilityState={{ checked }}
            accessibilityLabel={option.name}
            style={[
              styles.card,
              {
                backgroundColor: c.card,
                borderColor: checked ? c.accent : c.border,
                borderWidth: checked ? 2 : 1,
                borderRadius: shape.radius.lg,
              },
            ]}>
            <View style={styles.swatches}>
              {[swatch.background, swatch.card, swatch.accent, swatch.accent2].map((color, i) => (
                <View
                  key={i}
                  style={[styles.swatch, { backgroundColor: color, borderColor: c.border }]}
                />
              ))}
            </View>
            <View style={styles.text}>
              <ThemedText type="smallBold">{option.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {option.tagline}
              </ThemedText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  swatches: { flexDirection: 'row' },
  swatch: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, marginRight: -6 },
  text: { flex: 1, gap: Spacing.half },
});
