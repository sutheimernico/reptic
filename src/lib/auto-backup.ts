/**
 * Rolling on-device backups: writes the full export to a JSON file in the app's
 * document directory at most once a day and keeps the newest few. Impure by
 * nature (file system + SQLite), so it stays out of the domain layer — the
 * naming, due and prune rules live in `@/domain/auto-backup`.
 *
 * Honest limit (also stated in the UI): the document directory belongs to the
 * app, so these files die with the app or the device. They cover accidental
 * deletes and corrupted data, not device loss — that stays the manual export.
 *
 * Restore runs in-app (`listAutoBackups` + `readAutoBackup`): Android's document
 * picker browses SAF providers and cannot reach an app's own private files, so
 * the Import button alone would never see these backups.
 */

import { Directory, File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { exportAllData, getSetting, setSetting } from '@/db';
import {
  AUTO_BACKUP_DIR,
  AUTO_BACKUP_KEEP,
  AUTO_BACKUP_SETTING,
  autoBackupFileName,
  autoBackupsToPrune,
  isAutoBackupDue,
  isAutoBackupFile,
} from '@/domain/auto-backup';
import { type BackupData, parseBackup, serializeBackup } from '@/domain/backup';

/** The backups directory, created on demand. */
function backupDirectory(): Directory {
  const dir = new Directory(Paths.document, AUTO_BACKUP_DIR);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export interface AutoBackupFile {
  /** File name, e.g. `repz-auto-2026-08-30.json`. */
  name: string;
  /** The date part of the name (`2026-08-30`), for display. */
  date: string;
  uri: string;
  /** Size in bytes (0 when the file cannot be read). */
  size: number;
}

/** The stored auto-backups, newest first. */
export function listAutoBackups(): AutoBackupFile[] {
  const dir = backupDirectory();
  return dir
    .list()
    .filter((entry): entry is File => entry instanceof File && isAutoBackupFile(entry.name))
    .map((file) => ({
      name: file.name,
      date: file.name.slice('repz-auto-'.length, -'.json'.length),
      uri: file.uri,
      size: file.size,
    }))
    .sort((a, b) => b.name.localeCompare(a.name));
}

/** Read and validate one auto-backup. Throws (German message) when it is unreadable. */
export async function readAutoBackup(name: string): Promise<BackupData> {
  const file = new File(backupDirectory(), name);
  if (!file.exists) throw new Error(`Datei ${name} existiert nicht mehr.`);
  return parseBackup(await file.text());
}

/**
 * Write a snapshot now and prune the old ones. Returns the timestamp written.
 * Throws on failure — callers decide whether that is loud (button) or quiet
 * (app start).
 */
export async function runAutoBackup(db: SQLiteDatabase, nowIso: string): Promise<string> {
  const json = serializeBackup(await exportAllData(db, nowIso));

  const dir = backupDirectory();
  const file = new File(dir, autoBackupFileName(nowIso));
  file.create({ overwrite: true });
  file.write(json);

  const names = dir
    .list()
    .filter((entry): entry is File => entry instanceof File)
    .map((entry) => entry.name);
  for (const stale of autoBackupsToPrune(names, AUTO_BACKUP_KEEP)) {
    new File(dir, stale).delete();
  }

  await setSetting(db, AUTO_BACKUP_SETTING, nowIso);
  return nowIso;
}

export async function getLastAutoBackupAt(db: SQLiteDatabase): Promise<string | null> {
  return getSetting(db, AUTO_BACKUP_SETTING);
}

/**
 * Run a backup if one is due. Returns the new timestamp, or null when nothing
 * was due. Never throws for a timing read — only `runAutoBackup` itself can.
 */
export async function maybeRunAutoBackup(
  db: SQLiteDatabase,
  nowIso: string,
): Promise<string | null> {
  const last = await getLastAutoBackupAt(db);
  if (!isAutoBackupDue(last, nowIso)) return null;
  return runAutoBackup(db, nowIso);
}
