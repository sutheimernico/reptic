/**
 * Backup file I/O: bridges the pure (de)serialization in `@/domain/backup` and
 * the SQLite export/import in `@/db` to the device file system, share sheet, and
 * document picker. Impure by nature (native modules), so it stays out of the
 * domain layer. Uses the SDK 57 class-based `File`/`Paths` API.
 */

import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';

import { exportAllData, importAllData } from '@/db';
import { type BackupData, parseBackup, serializeBackup } from '@/domain/backup';

/**
 * Write all data to a JSON file in the cache and open the share sheet so the
 * user can save it (Drive, Files, email, …). Returns false if the platform
 * cannot share.
 */
export async function exportBackup(db: SQLiteDatabase): Promise<boolean> {
  const now = new Date().toISOString();
  const json = serializeBackup(await exportAllData(db, now));

  const file = new File(Paths.cache, `reptic-backup-${now.slice(0, 10)}.json`);
  file.create({ overwrite: true });
  file.write(json);

  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Reptic-Backup teilen',
    UTI: 'public.json',
  });
  return true;
}

/**
 * Let the user pick a backup file and return its validated contents, or null if
 * they cancel. Throws (with a German message) when the file is not a valid backup.
 */
export async function pickBackup(): Promise<BackupData | null> {
  const result = await DocumentPicker.getDocumentAsync({
    // Providers (Google Drive, Files) often report a .json backup as text/plain
    // or application/octet-stream, which would grey it out under a strict filter.
    // `parseBackup` validates the contents, so accepting these is safe.
    type: ['application/json', 'text/plain', 'application/octet-stream'],
    multiple: false,
    copyToCacheDirectory: true,
  });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  return parseBackup(await new File(asset.uri).text());
}

/** Replace all current data with a validated backup. */
export async function restoreBackup(db: SQLiteDatabase, data: BackupData): Promise<void> {
  await importAllData(db, data);
}
