import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui/screen';

export default function ExercisesScreen() {
  return (
    <Screen title="Übungen" subtitle="Deine Übungs-Bibliothek">
      <ThemedText themeColor="textSecondary">Übungs-Bibliothek folgt.</ThemedText>
    </Screen>
  );
}
