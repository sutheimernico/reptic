import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

import { getSetting } from '@/db';
import { maybeRunAutoBackup } from '@/lib/auto-backup';
import { HAPTICS_SETTING, parseHapticsSetting, setHapticsEnabled } from '@/lib/haptics';

/**
 * Renders nothing; does the two things that have to happen once per app start,
 * inside `SQLiteProvider` so the database context exists.
 *
 * 1. Hydrate device-local settings that live outside React state (haptics).
 * 2. Run the rolling local backup — the lib debounces it to one per day.
 *
 * A failed backup never blocks the app: it is caught, logged, and surfaced once
 * as an alert. Silence is the actual danger here, since the whole point is that
 * the backup can be relied on.
 */
export function AppBootstrap() {
  const db = useSQLiteContext();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return; // one attempt per app start, not per remount
    ranRef.current = true;

    void getSetting(db, HAPTICS_SETTING).then((value) =>
      setHapticsEnabled(parseHapticsSetting(value)),
    );

    void maybeRunAutoBackup(db, new Date().toISOString()).catch((error: unknown) => {
      console.error('[backup] auto-backup failed', error);
      Alert.alert(
        'Automatisches Backup fehlgeschlagen',
        `${error instanceof Error ? error.message : String(error)}\n\nDeine Daten sind unverändert. Du kannst in den Einstellungen manuell sichern.`,
      );
    });
  }, [db]);

  return null;
}
