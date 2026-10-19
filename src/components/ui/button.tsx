import Ionicons from '@expo/vector-icons/Ionicons';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type StyleProp,
  Text,
  type ViewStyle,
} from 'react-native';

import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { shadowStyle } from '@/theme/shape';

type Variant = 'primary' | 'secondary' | 'danger';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  style,
}: ButtonProps) {
  const theme = useAppTheme();
  const { colors: c, shape, fonts } = theme;
  const background = variant === 'primary' ? c.accent : variant === 'danger' ? c.danger : 'transparent';
  const foreground = variant === 'secondary' ? c.text : c.onAccent;
  // Arcade outlines every button in ink; other themes only outline the secondary one.
  const borderColor =
    variant === 'secondary' || shape.shadow === 'hard' ? c.border : 'transparent';
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: background,
          borderColor,
          borderWidth: Math.max(shape.borderWidth, variant === 'secondary' ? 1 : 0),
          borderRadius: shape.radius.md,
        },
        variant !== 'secondary' && !isDisabled ? shadowStyle(theme) : null,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={foreground} /> : null}
          <Text style={[styles.label, { color: foreground, fontFamily: fonts.bodyBold }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    // width:100% + alignSelf make the whole coloured surface the touch target.
    // Without it, on the Android new architecture the Pressable's hit area can
    // collapse to its centred content, so only a tap on the label registered.
    width: '100%',
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: 14,
    paddingHorizontal: Spacing.four,
  },
  label: {
    fontSize: 16,
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});
