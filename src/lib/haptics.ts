/**
 * Haptic feedback for the three moments that deserve one: a set ticked done, a
 * personal record, and the end of a rest.
 *
 * Uses `performAndroidHapticsAsync` rather than `impactAsync`: on Android the
 * latter is simulated through the raw `Vibrator` API, while this one goes
 * through the platform's own haptic constants — the same feedback the system
 * UI uses.
 *
 * The on/off flag is module state, not React state: haptics never influence
 * rendering, so putting it in a context would only add a provider. It is
 * hydrated once at app start (`AppBootstrap`) and updated by the settings
 * switch.
 *
 * Every call is fire-and-forget and swallows its errors — a device without a
 * vibrator must never break a save.
 */

import { AndroidHaptics, performAndroidHapticsAsync } from 'expo-haptics';
import { Platform } from 'react-native';

/** Settings key holding `'1'` / `'0'`. */
export const HAPTICS_SETTING = 'haptics_enabled';

export type HapticEvent = 'set-done' | 'record' | 'rest-over';

let enabled = true;

export function isHapticsEnabled(): boolean {
  return enabled;
}

export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

/** Read the stored flag; anything unset means on. */
export function parseHapticsSetting(stored: string | null): boolean {
  return stored !== '0';
}

function pulse(type: AndroidHaptics): void {
  if (Platform.OS !== 'android') return;
  void performAndroidHapticsAsync(type).catch(() => {
    // No vibrator, or the OS refused — silently fine.
  });
}

export function haptic(event: HapticEvent): void {
  if (!enabled) return;
  switch (event) {
    case 'set-done':
      pulse(AndroidHaptics.Confirm);
      return;
    case 'record':
      pulse(AndroidHaptics.Long_Press);
      return;
    case 'rest-over':
      // Two beats so it reads as "time is up", not as another set being logged.
      pulse(AndroidHaptics.Confirm);
      setTimeout(() => pulse(AndroidHaptics.Confirm), 180);
      return;
  }
}
