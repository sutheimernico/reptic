import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Spacing } from '@/constants/theme';
import type { ThemeMode } from '@/domain/types';
import { useThemeMode } from '@/theme/theme-provider';

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Hell' },
  { value: 'dark', label: 'Dunkel' },
];

export default function SettingsScreen() {
  const { mode, setMode } = useThemeMode();

  return (
    <Screen title="Einstellungen">
      <View style={styles.block}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
          DARSTELLUNG
        </ThemedText>
        <SegmentedControl options={THEME_OPTIONS} value={mode} onChange={setMode} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: Spacing.two },
  label: { textTransform: 'uppercase', letterSpacing: 0.6, marginLeft: Spacing.half },
});
