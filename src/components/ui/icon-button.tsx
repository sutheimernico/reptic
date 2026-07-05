import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

interface IconButtonProps {
  name: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  size?: number;
  color?: string;
  accessibilityLabel?: string;
}

export function IconButton({ name, onPress, size = 22, color, accessibilityLabel }: IconButtonProps) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
      <Ionicons name={name} size={size} color={color ?? c.text} />
    </Pressable>
  );
}
