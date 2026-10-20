/**
 * Which code the app is running: the bundle inside the APK or an EAS update
 * downloaded later. Shown in Einstellungen so a pushed update can be confirmed
 * on the phone without guessing.
 */

import * as Updates from 'expo-updates';

export function describeRunningBundle(
  info: { isEnabled: boolean; isEmbeddedLaunch: boolean; createdAt: Date | null },
  format: (d: Date) => string,
): string {
  if (!info.isEnabled) return 'Entwicklungsstand';
  if (info.isEmbeddedLaunch || info.createdAt === null) return 'Stand der installierten App';
  return `Update vom ${format(info.createdAt)}`;
}

export function runningBundleLabel(): string {
  return describeRunningBundle(Updates, (d) =>
    d.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }),
  );
}
