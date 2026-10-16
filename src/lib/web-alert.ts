import { Alert, Platform, type AlertButton } from 'react-native';

/**
 * Pick the button a browser dialog stands for. `confirm` asks one yes/no
 * question per non-cancel button, in order; the first "yes" wins, and saying
 * no to all of them means cancel. A plain notice (zero or one button) is just
 * acknowledged.
 */
export function chooseAlertButton(
  title: string,
  message: string | undefined,
  buttons: AlertButton[] | undefined,
  ask: { alert: (text: string) => void; confirm: (text: string) => boolean },
): AlertButton | undefined {
  const text = message ? `${title}\n\n${message}` : title;
  const list = buttons ?? [];
  const actions = list.filter((b) => b.style !== 'cancel');
  const cancel = list.find((b) => b.style === 'cancel');
  if (actions.length === 0 || (actions.length === 1 && !cancel)) {
    ask.alert(text);
    return actions[0] ?? cancel;
  }
  for (const button of actions) {
    const question = actions.length === 1 ? text : `${text}\n\nOK = „${button.text}“`;
    if (ask.confirm(question)) return button;
  }
  return cancel;
}

/**
 * react-native-web ships `Alert.alert` as a no-op, so in the browser preview
 * every confirmation ("Einheit beenden?", "Satz löschen?") silently did
 * nothing. Route it to the browser's own dialogs there; native is untouched.
 */
export function installWebAlert(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  Alert.alert = (title, message, buttons) => {
    const chosen = chooseAlertButton(title, message, buttons, {
      alert: (t) => window.alert(t),
      confirm: (t) => window.confirm(t),
    });
    chosen?.onPress?.();
  };
}
