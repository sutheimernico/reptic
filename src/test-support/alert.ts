/**
 * Driving the confirm dialogs: destructive flows (archive, delete, restore)
 * all go through `Alert.alert`, so a test has to answer them.
 */
import { Alert, type AlertButton } from 'react-native';

export function spyOnAlert(): jest.SpyInstance {
  return jest.spyOn(Alert, 'alert').mockImplementation(() => {});
}

/**
 * Press the button labelled `text` on the most recent alert. Throws with the
 * buttons that were actually offered, which is what you need when a flow took
 * the other branch (e.g. offered "Löschen" where "Archivieren" was expected).
 */
export async function pressAlertButton(spy: jest.SpyInstance, text: string): Promise<void> {
  const call = spy.mock.calls.at(-1);
  if (!call) throw new Error('No alert was shown');
  const buttons = (call[2] ?? []) as AlertButton[];
  const button = buttons.find((b) => b.text === text);
  if (!button) {
    throw new Error(
      `Alert "${String(call[0])}" has no button "${text}" — offered: ${buttons
        .map((b) => b.text)
        .join(', ')}`,
    );
  }
  await button.onPress?.();
}
