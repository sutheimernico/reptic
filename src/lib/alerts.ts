import { Alert } from 'react-native';

/**
 * Surface a failed DB write to the user. The raw message is shown on purpose:
 * silent save failures made the 2026-07-07 gym-save bug undiagnosable on
 * device — "database is locked" vs "no such table" is exactly the information
 * needed. Also logged so Metro captures it in dev.
 */
export function showSaveError(error: unknown): void {
  console.error('[db] write failed', error);
  const detail = error instanceof Error ? error.message : String(error);
  Alert.alert('Speichern fehlgeschlagen', detail);
}
