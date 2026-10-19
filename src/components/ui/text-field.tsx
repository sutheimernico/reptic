import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

interface TextFieldProps extends TextInputProps {
  label?: string;
}

export function TextField({ label, style, ...rest }: TextFieldProps) {
  const { colors: c, shape, fonts } = useAppTheme();
  return (
    <View style={styles.wrap}>
      {label ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
          {label}
        </ThemedText>
      ) : null}
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.placeholder}
        style={[
          styles.input,
          {
            backgroundColor: c.backgroundElement,
            borderColor: c.border,
            color: c.text,
            borderWidth: Math.max(shape.borderWidth, 1),
            borderRadius: shape.radius.md,
            fontFamily: fonts.bodyBold,
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one },
  label: { marginLeft: Spacing.half },
  input: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    fontSize: 16,
  },
});
