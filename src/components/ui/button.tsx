import Ionicons from '@expo/vector-icons/Ionicons';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type StyleProp,
  Text,
  type ViewStyle,
} from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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
  const c = useTheme();
  const background = variant === 'primary' ? c.accent : variant === 'danger' ? c.danger : 'transparent';
  const foreground = variant === 'secondary' ? c.text : c.onAccent;
  const borderColor = variant === 'secondary' ? c.border : 'transparent';
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, borderColor },
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={foreground} /> : null}
          <Text style={[styles.label, { color: foreground }]}>{label}</Text>
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
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: Spacing.four,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});
