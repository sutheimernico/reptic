import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui/screen';

export default function HeuteScreen() {
  return (
    <Screen title="Heute" subtitle="Wähle, was du heute trainierst">
      <ThemedText themeColor="textSecondary">Plan-Auswahl folgt.</ThemedText>
    </Screen>
  );
}
