import { Platform } from 'react-native';

import { FONTS } from '../fonts';
import { hardShadowNeedsView, shadowStyle } from '../shape';
import { resolveTheme } from '../themes';
import { applyFontFamily, bodyFamily } from '../typography';

const fonts = FONTS.warm;

describe('applyFontFamily', () => {
  it('maps weights to body or bodyBold and strips fontWeight', () => {
    const cases: [object, string][] = [
      [{ fontWeight: 'bold' }, fonts.bodyBold],
      [{}, fonts.body],
      [{ fontWeight: '600' }, fonts.bodyBold],
      [{ fontWeight: 600 }, fonts.bodyBold],
      [{ fontWeight: '500' }, fonts.body],
      [{ fontWeight: '800' }, fonts.bodyBold],
    ];
    for (const [style, family] of cases) {
      const out = applyFontFamily(fonts, { fontSize: 14, ...style });
      expect(out.fontFamily).toBe(family);
      expect(out.fontSize).toBe(14);
      expect('fontWeight' in out).toBe(false);
    }
  });

  it('lets an explicit variant override the weight mapping', () => {
    expect(applyFontFamily(fonts, { fontWeight: '800' }, 'display')).toEqual({
      fontFamily: fonts.display,
    });
    expect(applyFontFamily(fonts, {}, 'label').fontFamily).toBe(fonts.label);
    expect(applyFontFamily(fonts, { fontWeight: '700' }, 'numeric')).toEqual({
      fontFamily: fonts.numeric,
      fontVariant: ['tabular-nums'],
    });
  });

  it('bodyFamily picks by boldness', () => {
    expect(bodyFamily(fonts, true)).toBe(fonts.bodyBold);
    expect(bodyFamily(fonts, false)).toBe(fonts.body);
  });
});

describe('shadowStyle', () => {
  it('glow uses a coloured accent shadow without elevation', () => {
    const t = resolveTheme('evolved', 'dark', null);
    const s = shadowStyle(t);
    expect(s.shadowColor).toBe(t.colors.accent);
    expect(s.shadowOpacity).toBeLessThan(0.5);
    expect(s.elevation).toBe(0);
  });

  it('soft is a neutral drop shadow', () => {
    const s = shadowStyle(resolveTheme('warm', 'light', null));
    expect(s.shadowColor).toBe('#000');
    expect(s.shadowRadius).toBeGreaterThan(0);
    expect(s.elevation).toBe(2);
  });

  it('hard has zero blur, full opacity, an offset, ink colour and no elevation', () => {
    const t = resolveTheme('arcade', 'light', null);
    expect(shadowStyle(t)).toEqual({
      shadowColor: t.colors.border,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 0,
    });
  });

  it('none is empty', () => {
    expect(shadowStyle(resolveTheme('instrument', 'dark', null))).toEqual({});
  });

  it('needs the offset View only for hard shadows on Android', () => {
    const original = Platform.OS;
    try {
      Platform.OS = 'android';
      expect(hardShadowNeedsView(resolveTheme('arcade', 'light', null))).toBe(true);
      expect(hardShadowNeedsView(resolveTheme('warm', 'light', null))).toBe(false);
      Platform.OS = 'ios';
      expect(hardShadowNeedsView(resolveTheme('arcade', 'light', null))).toBe(false);
    } finally {
      Platform.OS = original;
    }
  });
});
