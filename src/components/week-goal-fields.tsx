import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { deleteSetting, getSetting, setSetting } from '@/db';
import { formatWeight } from '@/domain/format';
import {
  normalizeGoalInput,
  WEEK_GOAL_KG_SETTING,
  WEEK_GOAL_KM_SETTING,
} from '@/domain/week-stats';
import { showSaveError } from '@/lib/alerts';

function GoalField({ label, settingKey }: { label: string; settingKey: string }) {
  const db = useSQLiteContext();
  const [text, setText] = useState('');
  /** What is stored, shown back after a bad entry or a cleared field. */
  const [stored, setStored] = useState('');

  useEffect(() => {
    getSetting(db, settingKey).then((v) => {
      const shown = v === null ? '' : formatWeight(Number(v));
      setStored(shown);
      setText(shown);
    });
  }, [db, settingKey]);

  const commit = async () => {
    const input = normalizeGoalInput(text);
    try {
      if (input.action === 'invalid') {
        setText(stored);
        return;
      }
      if (input.action === 'clear') {
        await deleteSetting(db, settingKey);
        setStored('');
        setText('');
        return;
      }
      await setSetting(db, settingKey, input.value);
      const shown = formatWeight(Number(input.value));
      setStored(shown);
      setText(shown);
    } catch (error) {
      showSaveError(error);
    }
  };

  return (
    <TextField
      label={label}
      value={text}
      onChangeText={setText}
      onBlur={commit}
      onSubmitEditing={commit}
      keyboardType="decimal-pad"
      placeholder="Vorschlag"
      returnKeyType="done"
    />
  );
}

/** Weekly goals for the Heute hero. Empty means "use the suggestion". */
export function WeekGoalFields() {
  return (
    <View style={styles.wrap}>
      <GoalField label="Wochenziel (kg)" settingKey={WEEK_GOAL_KG_SETTING} />
      <GoalField label="Wochenziel Cardio (km)" settingKey={WEEK_GOAL_KM_SETTING} />
      <ThemedText type="small" themeColor="textSecondary">
        Leer lassen, dann schlägt die App ein Ziel aus deinen letzten Wochen vor.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
});
