import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

import { maybeRunAutoBackup } from '@/lib/auto-backup';

/**
 * Renders nothing; runs the rolling local backup once per app start (the lib
 * debounces it to one per day). Lives inside `SQLiteProvider` so the database
 * context exists.
 *
 * A failure never blocks the app: it is caught, logged, and surfaced once as an
 * alert — silence is the actual danger here, since the whole point is that Nico
 * can rely on the backup being there.
 */
export function AutoBackupOnStart() {
  const db = useSQLiteContext();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return; // one attempt per app start, not per remount
    ranRef.current = true;
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
