import { FONT_MAP, FONTS } from '../fonts';

describe('fonts', () => {
  it('maps every family referenced by a theme to a FONT_MAP entry', () => {
    for (const set of Object.values(FONTS)) {
      for (const family of Object.values(set)) {
        expect(family).toBeDefined();
        expect(Object.keys(FONT_MAP)).toContain(family);
      }
    }
  });

  it('has no undefined font sources', () => {
    for (const source of Object.values(FONT_MAP)) expect(source).toBeDefined();
  });
});
