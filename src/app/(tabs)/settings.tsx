import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui/screen';

export default function SettingsScreen() {
  return (
    <Screen title="Einstellungen">
      <ThemedText themeColor="textSecondary">Theme-Umschalter und Backup folgen.</ThemedText>
    </Screen>
  );
}
