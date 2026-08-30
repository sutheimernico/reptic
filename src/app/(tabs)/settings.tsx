import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { APP_NAME } from '@/constants/app';
import { Spacing } from '@/constants/theme';
import { getGyms } from '@/db';
import { AUTO_BACKUP_KEEP, formatBackupAge } from '@/domain/auto-backup';
import type { BackupData } from '@/domain/backup';
import { plural } from '@/domain/format';
import type { Gym, ThemeMode } from '@/domain/types';
import {
  type AutoBackupFile,
  getLastAutoBackupAt,
  listAutoBackups,
  readAutoBackup,
  runAutoBackup,
} from '@/lib/auto-backup';
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
  const router = useRouter();
  const { mode, setMode } = useThemeMode();
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [lastAutoBackup, setLastAutoBackup] = useState<string | null>(null);
  const [autoBackups, setAutoBackups] = useState<AutoBackupFile[]>([]);
  const [busy, setBusy] = useState(false);

  const loadBackupState = useCallback(async () => {
    setLastAutoBackup(await getLastAutoBackupAt(db));
    try {
      setAutoBackups(listAutoBackups());
    } catch {
      setAutoBackups([]); // a missing directory is not an error worth an alert
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      getGyms(db, { includeArchived: true }).then(setGyms);
      void loadBackupState();
    }, [db, loadBackupState]),
  );

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

  /** Shared confirm + replace step for both restore paths (file picker and auto-backup). */
  const confirmRestore = (data: BackupData, source: string) => {
    Alert.alert(
      'Backup einspielen?',
      `Ersetzt alle aktuellen Daten durch ${source}:\n${plural(data.exercises.length, 'Übung', 'Übungen')} · ${plural(data.plans.length, 'Plan', 'Pläne')} · ${plural(data.workouts.length, 'Einheit', 'Einheiten')}.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Einspielen',
          style: 'destructive',
          onPress: async () => {
            try {
              await restoreBackup(db, data);
              await loadBackupState();
              Alert.alert('Import abgeschlossen', 'Deine Daten wurden ersetzt.');
            } catch (e) {
              Alert.alert('Import fehlgeschlagen', errorMessage(e));
            }
          },
        },
      ],
    );
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
    confirmRestore(data, 'die gewählte Datei');
  };

  const onBackupNow = async () => {
    setBusy(true);
    try {
      await runAutoBackup(db, new Date().toISOString());
      await loadBackupState();
    } catch (e) {
      Alert.alert('Backup fehlgeschlagen', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onRestoreAuto = async (file: AutoBackupFile) => {
    try {
      confirmRestore(await readAutoBackup(file.name), `das Backup vom ${file.date}`);
    } catch (e) {
      Alert.alert('Backup nicht lesbar', errorMessage(e));
    }
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
          GYMS
        </ThemedText>
        {gyms.map((gym) => (
          <ListRow
            key={gym.id}
            title={gym.name}
            subtitle={gym.archived ? 'Archiviert' : undefined}
            onPress={() => router.push({ pathname: '/gym/edit', params: { id: String(gym.id) } })}
          />
        ))}
        <Button
          label="Neues Gym"
          icon="add"
          variant="secondary"
          onPress={() => router.push('/gym/edit')}
        />
      </View>

      <View style={styles.block}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
          AUTOMATISCHES BACKUP
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {`Beim Start sichert sich ${APP_NAME} einmal täglich selbst; die letzten ${AUTO_BACKUP_KEEP} Sicherungen bleiben erhalten. Sie liegen auf diesem Gerät — sie schützen vor versehentlichem Löschen, nicht vor Geräteverlust. Dafür ist der Export unten da.`}
        </ThemedText>
        <ListRow
          title="Letztes Auto-Backup"
          subtitle={formatBackupAge(lastAutoBackup, new Date().toISOString())}
        />
        <Button
          label="Jetzt sichern"
          icon="save-outline"
          variant="secondary"
          loading={busy}
          onPress={onBackupNow}
        />
        {autoBackups.map((file) => (
          <ListRow
            key={file.name}
            title={file.date}
            subtitle={`${Math.max(1, Math.round((file.size ?? 0) / 1024))} KB · tippen zum Einspielen`}
            onPress={() => onRestoreAuto(file)}
          />
        ))}
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
