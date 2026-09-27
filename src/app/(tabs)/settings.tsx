import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { useRestTimer } from '@/components/rest-timer';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { APP_NAME } from '@/constants/app';
import { Radius, Spacing } from '@/constants/theme';
import { getGyms, getSetting, setSetting } from '@/db';
import { AUTO_BACKUP_KEEP, formatBackupAge } from '@/domain/auto-backup';
import type { BackupData } from '@/domain/backup';
import { formatDuration, formatWeight, plural } from '@/domain/format';
import {
  DEFAULT_PLATE_SETUP,
  parsePlateSetup,
  PLATE_SETUP_SETTING,
  type PlateSetup,
  serializePlateSetup,
} from '@/domain/plates';
import {
  DEFAULT_INCREMENT_KG,
  DEFAULT_REP_TARGET,
  INCREMENT_SETTING,
  parseIncrement,
  parseRepTarget,
  REP_TARGET_SETTING,
  stepIncrement,
  stepRepTarget,
} from '@/domain/progression';
import { REST_OFF, stepRestSeconds } from '@/domain/rest-timer';
import type { Gym, ThemeMode } from '@/domain/types';
import {
  type AutoBackupFile,
  getLastAutoBackupAt,
  listAutoBackups,
  readAutoBackup,
  runAutoBackup,
} from '@/lib/auto-backup';
import { exportBackup, pickBackup, restoreBackup } from '@/lib/backup';
import {
  HAPTICS_SETTING,
  haptic,
  parseHapticsSetting,
  setHapticsEnabled,
} from '@/lib/haptics';
import { useTheme } from '@/hooks/use-theme';
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
  const { durationSec: restSeconds, setDurationSec: setRestSeconds } = useRestTimer();
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [lastAutoBackup, setLastAutoBackup] = useState<string | null>(null);
  const [autoBackups, setAutoBackups] = useState<AutoBackupFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [haptics, setHaptics] = useState(true);
  const [plates, setPlates] = useState<PlateSetup>(DEFAULT_PLATE_SETUP);
  const [repTarget, setRepTarget] = useState(DEFAULT_REP_TARGET);
  const [increment, setIncrement] = useState(DEFAULT_INCREMENT_KG);
  const c = useTheme();

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
      getSetting(db, HAPTICS_SETTING).then((v) => setHaptics(parseHapticsSetting(v)));
      getSetting(db, PLATE_SETUP_SETTING).then((v) => setPlates(parsePlateSetup(v)));
      getSetting(db, REP_TARGET_SETTING).then((v) => setRepTarget(parseRepTarget(v)));
      getSetting(db, INCREMENT_SETTING).then((v) => setIncrement(parseIncrement(v)));
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

  const onToggleHaptics = (next: boolean) => {
    setHaptics(next);
    setHapticsEnabled(next);
    void setSetting(db, HAPTICS_SETTING, next ? '1' : '0');
    if (next) haptic('set-done'); // let the user feel what they just switched on
  };

  const saveRepTarget = (next: number) => {
    setRepTarget(next);
    void setSetting(db, REP_TARGET_SETTING, String(next));
  };

  const saveIncrement = (next: number) => {
    setIncrement(next);
    void setSetting(db, INCREMENT_SETTING, String(next));
  };

  const savePlates = (next: PlateSetup) => {
    setPlates(next);
    void setSetting(db, PLATE_SETUP_SETTING, serializePlateSetup(next));
  };

  /** Toggle one plate size in or out of the rack. */
  const togglePlate = (kg: number) => {
    const owned = plates.stock.some((p) => p.kg === kg);
    const stock = owned
      ? plates.stock.filter((p) => p.kg !== kg)
      : [...plates.stock, { kg, pairs: 2 }].sort((a, b) => b.kg - a.kg);
    savePlates({ ...plates, stock });
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
          TRAINING
        </ThemedText>
        <ListRow
          title="Pause zwischen Sätzen"
          subtitle={
            restSeconds === REST_OFF
              ? 'Aus — kein Timer nach einem Satz'
              : `${formatDuration(restSeconds)} min, startet beim Abhaken`
          }
          right={
            <View style={styles.stepper}>
              <IconButton
                name="remove-circle-outline"
                accessibilityLabel="Pause verkürzen"
                onPress={() => setRestSeconds(stepRestSeconds(restSeconds, -1))}
              />
              <IconButton
                name="add-circle-outline"
                accessibilityLabel="Pause verlängern"
                onPress={() => setRestSeconds(stepRestSeconds(restSeconds, 1))}
              />
            </View>
          }
        />
        <ListRow
          title="Wdh.-Ziel für Steigerung"
          subtitle={`${repTarget} Wdh. in jedem Satz → nächstes Mal schwerer`}
          right={
            <View style={styles.stepper}>
              <IconButton
                name="remove-circle-outline"
                accessibilityLabel="Wiederholungsziel senken"
                onPress={() => saveRepTarget(stepRepTarget(repTarget, -1))}
              />
              <IconButton
                name="add-circle-outline"
                accessibilityLabel="Wiederholungsziel erhöhen"
                onPress={() => saveRepTarget(stepRepTarget(repTarget, 1))}
              />
            </View>
          }
        />
        <ListRow
          title="Steigerung"
          subtitle={`+${formatWeight(increment)} kg pro Schritt, auf ladbare Scheiben gerundet`}
          right={
            <View style={styles.stepper}>
              <IconButton
                name="remove-circle-outline"
                accessibilityLabel="Steigerung verkleinern"
                onPress={() => saveIncrement(stepIncrement(increment, -1))}
              />
              <IconButton
                name="add-circle-outline"
                accessibilityLabel="Steigerung vergrößern"
                onPress={() => saveIncrement(stepIncrement(increment, 1))}
              />
            </View>
          }
        />
        <ListRow
          title="Hantelstange"
          subtitle={`${formatWeight(plates.barKg)} kg — Basis für den Scheibenrechner`}
          right={
            <View style={styles.stepper}>
              <IconButton
                name="remove-circle-outline"
                accessibilityLabel="Stange leichter"
                onPress={() => savePlates({ ...plates, barKg: Math.max(0, plates.barKg - 2.5) })}
              />
              <IconButton
                name="add-circle-outline"
                accessibilityLabel="Stange schwerer"
                onPress={() => savePlates({ ...plates, barKg: plates.barKg + 2.5 })}
              />
            </View>
          }
        />
        <View style={styles.plateBlock}>
          <ThemedText type="small" themeColor="textSecondary">
            Vorhandene Scheiben (je 2 Paar). Antippen zum An- und Abwählen.
          </ThemedText>
          <View style={styles.chips}>
            {DEFAULT_PLATE_SETUP.stock.map(({ kg }) => {
              const owned = plates.stock.some((p) => p.kg === kg);
              return (
                <Pressable
                  key={kg}
                  onPress={() => togglePlate(kg)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: owned }}
                  accessibilityLabel={`${formatWeight(kg)} Kilo Scheiben`}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: owned ? c.accent : 'transparent',
                      borderColor: owned ? c.accent : c.border,
                    },
                  ]}>
                  <Text style={[styles.chipText, { color: owned ? c.onAccent : c.textSecondary }]}>
                    {formatWeight(kg)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <ListRow
          title="Vibration"
          subtitle="Beim Abhaken, bei Rekorden und am Ende der Pause"
          right={
            <Switch
              value={haptics}
              onValueChange={onToggleHaptics}
              accessibilityLabel="Vibration"
              trackColor={{ false: c.border, true: c.accent }}
            />
          }
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
  stepper: { flexDirection: 'row', gap: Spacing.three },
  plateBlock: { gap: Spacing.two, marginLeft: Spacing.half },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  chipText: { fontSize: 14, fontWeight: '700' },
});
