import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui/screen';

export default function HistoryScreen() {
  return (
    <Screen title="Verlauf" subtitle="Deine vergangenen Einheiten">
      <ThemedText themeColor="textSecondary">Verlauf folgt.</ThemedText>
    </Screen>
  );
}
