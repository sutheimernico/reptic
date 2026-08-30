/**
 * Pure logic for the rolling on-device auto-backup: file naming, the due
 * check, pruning to the newest N files, and the human age label. The file I/O
 * lives in `@/lib/auto-backup` — this module stays testable in plain Node.
 *
 * Honest scope: these backups sit in the app's own document directory. They
 * protect against accidental deletes and corrupted app data, NOT against
 * losing the device — that stays the manual share export.
 */

/** Sub-directory of the app's document directory holding the rolling backups. */
export const AUTO_BACKUP_DIR = 'backups';

/** How many daily snapshots are kept before the oldest are pruned. */
export const AUTO_BACKUP_KEEP = 7;

/** Minimum age of the last backup before a new one is written on app start. */
export const AUTO_BACKUP_INTERVAL_HOURS = 24;

/** Settings key holding the ISO timestamp of the last successful auto-backup. */
export const AUTO_BACKUP_SETTING = 'last_auto_backup_at';

const PREFIX = 'repz-auto-';
const SUFFIX = '.json';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * `repz-auto-2026-08-30.json` — one file per day, so a second run on the same
 * day overwrites instead of piling up. The date is the UTC slice of the ISO
 * timestamp, matching the manual export's file naming; it labels the file, it
 * is not used for any timing decision (that runs on real elapsed time).
 */
export function autoBackupFileName(iso: string): string {
  return `${PREFIX}${iso.slice(0, 10)}${SUFFIX}`;
}

/** Whether a directory entry is one of our auto-backups (never touch foreign files). */
export function isAutoBackupFile(name: string): boolean {
  return name.startsWith(PREFIX) && name.endsWith(SUFFIX);
}

const timeOf = (iso: string | null): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
};

/**
 * Whether a new auto-backup is due. True when there never was one, when the
 * stored timestamp is unreadable, and when the clock jumped backwards (a
 * future timestamp would otherwise block backups forever).
 */
export function isAutoBackupDue(
  lastIso: string | null,
  nowIso: string,
  intervalHours = AUTO_BACKUP_INTERVAL_HOURS,
): boolean {
  const last = timeOf(lastIso);
  const now = timeOf(nowIso);
  if (last === null || now === null) return true;
  if (now < last) return true;
  return now - last >= intervalHours * HOUR_MS;
}

/**
 * The auto-backup files to delete so that only the newest `keep` remain.
 * Sorting is lexicographic, which is chronological for `YYYY-MM-DD` names.
 * Entries that are not ours are ignored, never returned for deletion.
 */
export function autoBackupsToPrune(names: string[], keep = AUTO_BACKUP_KEEP): string[] {
  const mine = names.filter(isAutoBackupFile).sort();
  const excess = mine.length - keep;
  return excess > 0 ? mine.slice(0, excess) : [];
}

/**
 * The age label shown in Einstellungen: "noch nie", "gerade eben",
 * "vor 3 Stunden", "gestern", "vor 5 Tagen". Elapsed-time based (no calendar
 * arithmetic), so it is timezone-independent.
 */
export function formatBackupAge(lastIso: string | null, nowIso: string): string {
  const last = timeOf(lastIso);
  const now = timeOf(nowIso);
  if (last === null || now === null) return 'noch nie';

  const elapsed = now - last;
  if (elapsed < 0) return 'gerade eben'; // clock moved backwards; don't claim the future
  if (elapsed < HOUR_MS) return 'gerade eben';
  if (elapsed < DAY_MS) {
    const hours = Math.floor(elapsed / HOUR_MS);
    return hours === 1 ? 'vor 1 Stunde' : `vor ${hours} Stunden`;
  }
  const days = Math.floor(elapsed / DAY_MS);
  return days === 1 ? 'gestern' : `vor ${days} Tagen`;
}
