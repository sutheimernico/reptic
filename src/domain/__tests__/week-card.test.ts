import {
  checksumOf,
  decodeBase64Url,
  duelStatus,
  encodeBase64Url,
  encodeWeekCard,
  extractAndDecode,
  shareMessage,
  type WeekCard,
} from '@/domain/week-card';

const me: WeekCard = { v: 1, n: 'Nico', w: '2026-W43', kg: 18400, km: 12.4, s: 4 };
const jonas: WeekCard = { v: 1, n: 'Jonas', w: '2026-W43', kg: 21050, km: 8.1, s: 5 };

/** Sign an arbitrary JSON payload the way encodeWeekCard does, to test field validation. */
function codeFor(json: string): string {
  const payload = encodeBase64Url(json);
  return `REPZ1.${payload}.${checksumOf(payload)}`;
}

describe('base64url', () => {
  it.each(['', 'a', 'ab', 'abc', 'Jörg', 'Zoë 💪', 'Ünïcödé-Ñame'])('round-trips %j', (text) => {
    const encoded = encodeBase64Url(text);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]*$/);
    expect(decodeBase64Url(encoded)).toBe(text);
  });

  it('rejects characters outside the alphabet', () => {
    expect(decodeBase64Url('a*b')).toBeNull();
  });
});

describe('encodeWeekCard / extractAndDecode', () => {
  it('round-trips a card, umlauts included', () => {
    for (const card of [me, { ...me, n: 'Jörg' }, { ...me, kg: 0, km: 0, s: 0 }]) {
      expect(extractAndDecode(encodeWeekCard(card))).toEqual({ ok: true, card });
    }
  });

  it('has the REPZ1.<payload>.<4 base36> shape', () => {
    expect(encodeWeekCard(me)).toMatch(/^REPZ1\.[A-Za-z0-9_-]+\.[0-9a-z]{4}$/);
  });

  it('is deterministic', () => {
    expect(encodeWeekCard(me)).toBe(encodeWeekCard({ ...me }));
  });

  it('decodes a whole WhatsApp message with prefix text, a newline and a trailing period', () => {
    const code = encodeWeekCard({ ...me, n: 'Jörg' });
    const pasted = `[19.10., 21:03] Jörg: Meine Repz-Woche KW 43: 18.400 kg bewegt, 12,4 km Cardio, 4 Einheiten. Code: ${code}.\n`;
    expect(extractAndDecode(pasted)).toEqual({ ok: true, card: { ...me, n: 'Jörg' } });
    expect(extractAndDecode(`Code:\n${code}\nViel Spaß!`).ok).toBe(true);
    expect(extractAndDecode(`  ${code} `).ok).toBe(true);
  });

  it('decodes the message shareMessage produces', () => {
    expect(extractAndDecode(shareMessage(me))).toEqual({ ok: true, card: me });
  });

  it('rejects one changed payload character as corrupt', () => {
    const [head, payload, sum] = encodeWeekCard(me).split('.');
    const index = 5;
    const swapped = payload[index] === 'A' ? 'B' : 'A';
    const changed = `${head}.${payload.slice(0, index)}${swapped}${payload.slice(index + 1)}.${sum}`;
    expect(extractAndDecode(changed)).toEqual({ ok: false, reason: 'corrupt' });
  });

  it('rejects a changed checksum as corrupt', () => {
    const [head, payload, sum] = encodeWeekCard(me).split('.');
    const other = sum[0] === 'a' ? 'b' : 'a';
    expect(extractAndDecode(`${head}.${payload}.${other}${sum.slice(1)}`)).toEqual({
      ok: false,
      reason: 'corrupt',
    });
  });

  it('reports a newer format as version', () => {
    const code = encodeWeekCard(me).replace('REPZ1.', 'REPZ2.');
    expect(extractAndDecode(code)).toEqual({ ok: false, reason: 'version' });
  });

  it('reports plain text as no-code', () => {
    expect(extractAndDecode('hallo, wie war dein Training?')).toEqual({ ok: false, reason: 'no-code' });
    expect(extractAndDecode('')).toEqual({ ok: false, reason: 'no-code' });
  });

  it.each([
    ['negative kg', '{"v":1,"n":"A","w":"2026-W43","kg":-5,"km":1,"s":1}'],
    ['null kg (NaN in JSON)', '{"v":1,"n":"A","w":"2026-W43","kg":null,"km":1,"s":1}'],
    ['string km', '{"v":1,"n":"A","w":"2026-W43","kg":5,"km":"1","s":1}'],
    ['fractional sessions', '{"v":1,"n":"A","w":"2026-W43","kg":5,"km":1,"s":1.5}'],
    ['bad week', '{"v":1,"n":"A","w":"2026-43","kg":5,"km":1,"s":1}'],
    ['week 54', '{"v":1,"n":"A","w":"2026-W54","kg":5,"km":1,"s":1}'],
    ['empty name', '{"v":1,"n":" ","w":"2026-W43","kg":5,"km":1,"s":1}'],
    ['kg above the cap', '{"v":1,"n":"A","w":"2026-W43","kg":10000001,"km":1,"s":1}'],
    ['km above the cap', '{"v":1,"n":"A","w":"2026-W43","kg":5,"km":100001,"s":1}'],
    ['sessions above the cap', '{"v":1,"n":"A","w":"2026-W43","kg":5,"km":1,"s":1001}'],
    ['wrong v', '{"v":2,"n":"A","w":"2026-W43","kg":5,"km":1,"s":1}'],
    ['not json', 'nope'],
    ['an array', '[1,2,3]'],
  ])('rejects %s as corrupt (valid checksum)', (_label, json) => {
    expect(extractAndDecode(codeFor(json))).toEqual({ ok: false, reason: 'corrupt' });
  });

  it('accepts values exactly at the caps', () => {
    const json = '{"v":1,"n":"A","w":"2026-W43","kg":10000000,"km":100000,"s":1000}';
    expect(extractAndDecode(codeFor(json)).ok).toBe(true);
  });

  it('accepts a well-formed hand-signed payload', () => {
    const json = '{"v":1,"n":"A","w":"2026-W43","kg":5,"km":1.5,"s":1}';
    expect(extractAndDecode(codeFor(json)).ok).toBe(true);
  });
});

describe('shareMessage', () => {
  it('uses German number formats', () => {
    const message = shareMessage(me);
    expect(message).toBe(
      `Meine Repz-Woche KW 43: 18.400 kg bewegt, 12,4 km Cardio, 4 Einheiten. Code: ${encodeWeekCard(me)}`,
    );
  });

  it('says "1 Einheit" for a single session', () => {
    expect(shareMessage({ ...me, s: 1 })).toContain('1 Einheit. Code:');
  });
});

describe('duelStatus', () => {
  it('friend leads kg, you lead cardio', () => {
    expect(duelStatus(me, jonas)).toBe(
      'Jonas führt bei den kg, dir fehlen 2.650 kg. Beim Cardio liegst du vorn.',
    );
  });

  it('you lead kg, friend leads cardio', () => {
    expect(duelStatus(jonas, me)).toBe(
      'Du führst bei den kg, Nico fehlen 2.650 kg. Beim Cardio liegt Nico vorn.',
    );
  });

  it('friend leads both', () => {
    expect(duelStatus(me, { ...jonas, km: 20 })).toBe(
      'Jonas führt bei kg und Cardio — dir fehlen 2.650 kg.',
    );
  });

  it('you lead both', () => {
    expect(duelStatus({ ...jonas, n: 'Nico', km: 20 }, { ...me, n: 'Jonas' })).toBe('Du führst bei kg und Cardio.');
  });

  it('tie in both', () => {
    expect(duelStatus(me, { ...me, n: 'Jonas' })).toBe('Gleichstand bei kg und Cardio.');
  });

  it('kg tie with a cardio lead keeps the split wording', () => {
    expect(duelStatus(me, { ...jonas, kg: me.kg })).toBe(
      'Bei den kg steht es unentschieden. Beim Cardio liegst du vorn.',
    );
    expect(duelStatus(me, { ...jonas, km: me.km })).toBe(
      'Jonas führt bei den kg, dir fehlen 2.650 kg. Beim Cardio steht es unentschieden.',
    );
  });

  it('friend card from an older week', () => {
    expect(duelStatus(me, { ...jonas, w: '2026-W42' })).toBe(
      "Jonas' Karte ist von KW 42 — schick deine aktuelle Wochenkarte.",
    );
    expect(duelStatus(me, { ...jonas, n: 'Mia', w: '2026-W42' })).toBe(
      'Mias Karte ist von KW 42 — schick deine aktuelle Wochenkarte.',
    );
  });

  it('friend card from a newer week', () => {
    expect(duelStatus(me, { ...jonas, n: 'Mia', w: '2026-W44' })).toBe(
      'Mias Karte ist schon von KW 44.',
    );
  });
});
