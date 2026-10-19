import { stackHeaderOptions } from '../header';
import { resolveTheme, type ThemeVariant } from '../themes';

const VARIANTS: ThemeVariant[] = ['evolved', 'warm', 'arcade', 'instrument'];

describe('stackHeaderOptions', () => {
  it.each(VARIANTS)('%s uses the theme font and text colour for the title', (variant) => {
    const theme = resolveTheme(variant, 'light', 'light');
    const options = stackHeaderOptions(theme);
    const title = options.headerTitleStyle as {
      fontFamily: string;
      color: string;
    };
    expect(Object.values(theme.fonts)).toContain(title.fontFamily);
    expect(title.color).toBe(theme.colors.text);
  });

  it('puts instrument on the panel colour with a mono title', () => {
    const theme = resolveTheme('instrument', 'dark', 'dark');
    const options = stackHeaderOptions(theme);
    expect((options.headerStyle as { backgroundColor: string }).backgroundColor).toBe(
      theme.colors.card,
    );
    expect((options.headerTitleStyle as { fontFamily: string }).fontFamily).toBe(
      'JetBrainsMono_500Medium',
    );
  });

  it('puts warm on the sand page colour and arcade behind an ink rule', () => {
    const warm = resolveTheme('warm', 'light', 'light');
    expect(
      (stackHeaderOptions(warm).headerStyle as { backgroundColor: string }).backgroundColor,
    ).toBe(warm.colors.background);
    const arcade = resolveTheme('arcade', 'light', 'light');
    const style = stackHeaderOptions(arcade).headerStyle as {
      borderBottomWidth: number;
      borderBottomColor: string;
    };
    expect(style.borderBottomWidth).toBe(2.5);
    expect(style.borderBottomColor).toBe('#161616');
  });

  it('draws no rule for warm (borderless theme)', () => {
    const warm = resolveTheme('warm', 'light', 'light');
    expect(stackHeaderOptions(warm).headerStyle).not.toHaveProperty('borderBottomWidth');
  });
});
