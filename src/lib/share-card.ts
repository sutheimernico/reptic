import { Alert, Platform, Share } from 'react-native';

/**
 * Hand the week card's text to the system share sheet. The browser preview has no share sheet
 * (and no clipboard without a dependency), so there the message is shown in the web alert, where
 * it can be copied by hand and read by the e2e run.
 */
export async function shareWeekCard(message: string): Promise<void> {
  if (Platform.OS === 'web') {
    Alert.alert('Wochenkarte teilen', message);
    return;
  }
  try {
    await Share.share({ message });
  } catch (error) {
    Alert.alert('Teilen fehlgeschlagen', error instanceof Error ? error.message : String(error));
  }
}
