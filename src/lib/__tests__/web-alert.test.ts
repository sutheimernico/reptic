import { chooseAlertButton } from '@/lib/web-alert';

const finish = [
  { text: 'Abbrechen', style: 'cancel' as const },
  { text: 'Beenden' },
];

function asker(answers: boolean[]) {
  const asked: string[] = [];
  return {
    asked,
    alert: (t: string) => void asked.push(t),
    confirm: (t: string) => {
      asked.push(t);
      return answers.shift() ?? false;
    },
  };
}

describe('chooseAlertButton', () => {
  it('runs the action when a cancel/confirm question is confirmed', () => {
    const ask = asker([true]);
    expect(chooseAlertButton('Einheit beenden?', 'Wird gespeichert.', finish, ask)?.text).toBe(
      'Beenden',
    );
    expect(ask.asked).toEqual(['Einheit beenden?\n\nWird gespeichert.']);
  });

  it('falls back to cancel when declined', () => {
    expect(chooseAlertButton('Einheit beenden?', undefined, finish, asker([false]))?.text).toBe(
      'Abbrechen',
    );
  });

  it('only acknowledges a plain notice', () => {
    const ask = asker([]);
    expect(chooseAlertButton('Speichern fehlgeschlagen', 'locked', undefined, ask)).toBeUndefined();
    expect(ask.asked).toEqual(['Speichern fehlgeschlagen\n\nlocked']);
  });

  it('asks per action when there are several, first yes wins', () => {
    const ask = asker([false, true]);
    const chosen = chooseAlertButton(
      'Backup',
      undefined,
      [{ text: 'Abbrechen', style: 'cancel' }, { text: 'Teilen' }, { text: 'Speichern' }],
      ask,
    );
    expect(chosen?.text).toBe('Speichern');
    expect(ask.asked[1]).toContain('OK = „Speichern“');
  });
});
