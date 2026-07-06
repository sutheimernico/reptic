import { useSQLiteContext } from 'expo-sqlite';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { APP_NAME } from '@/constants/app';
import { Spacing } from '@/constants/theme';
import type { BackupData } from '@/domain/backup';
import type { ThemeMode } from '@/domain/types';
import { exportBackup, pickBackup, restoreBackup } from '@/lib/backup';
import { useThemeMode } from '@/theme/theme-provider';

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Hell' },
  { value: 'dark', label: 'Dunkel' },
];

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const { mode, setMode } = useThemeMode();

  const onExport = async () => {
    try {
      const shared = await exportBackup(db);
      if (!shared) {
        Alert.alert('Teilen nicht verfügbar', 'Auf diesem Gerät kann keine Datei geteilt werden.');
      }
    } catch (e) {
      Alert.alert('Export fehlgeschlagen', errorMessage(e));
    }
  };

  const onImport = async () => {
    let data: BackupData | null;
    try {
      data = await pickBackup();
    } catch (e) {
      Alert.alert('Import fehlgeschlagen', errorMessage(e));
      return;
    }
    if (!data) return; // canceled

    const picked = data;
    Alert.alert(
      'Backup importieren?',
      `Ersetzt alle aktuellen Daten durch:\n${picked.exercises.length} Übungen · ${picked.plans.length} Pläne · ${picked.workouts.length} Einheiten.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Importieren',
          style: 'destructive',
          onPress: async () => {
            try {
              await restoreBackup(db, picked);
              Alert.alert('Import abgeschlossen', 'Deine Daten wurden ersetzt.');
            } catch (e) {
              Alert.alert('Import fehlgeschlagen', errorMessage(e));
            }
          },
        },
      ],
    );
  };

  return (
    <Screen title="Einstellungen">
      <View style={styles.block}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
          DARSTELLUNG
        </ThemedText>
        <SegmentedControl options={THEME_OPTIONS} value={mode} onChange={setMode} />
      </View>

      <View style={styles.block}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
          DATEN
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Sichere deine Einheiten als JSON-Datei (z. B. in Google Drive oder Dateien) und stelle
          sie auf einem neuen Gerät wieder her.
        </ThemedText>
        <Button label="Backup exportieren" icon="share-outline" variant="secondary" onPress={onExport} />
        <Button label="Backup importieren" icon="download-outline" variant="secondary" onPress={onImport} />
      </View>

      <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
        {APP_NAME} — alle Daten bleiben lokal auf deinem Gerät.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: Spacing.two },
  label: { textTransform: 'uppercase', letterSpacing: 0.6, marginLeft: Spacing.half },
  footer: { marginTop: Spacing.three, textAlign: 'center' },
});
