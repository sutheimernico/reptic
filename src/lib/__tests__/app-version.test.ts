import { describeRunningBundle } from '@/lib/app-version';

const fmt = (d: Date) => d.toISOString().slice(0, 10);

describe('describeRunningBundle', () => {
  it('names a downloaded update by its date', () => {
    expect(
      describeRunningBundle(
        { isEnabled: true, isEmbeddedLaunch: false, createdAt: new Date('2026-10-20T08:00:00Z') },
        fmt,
      ),
    ).toBe('Update vom 2026-10-20');
  });

  it('falls back to the installed bundle and to the dev build', () => {
    expect(
      describeRunningBundle(
        { isEnabled: true, isEmbeddedLaunch: true, createdAt: new Date('2026-10-20T08:00:00Z') },
        fmt,
      ),
    ).toBe('Stand der installierten App');
    expect(
      describeRunningBundle({ isEnabled: false, isEmbeddedLaunch: true, createdAt: null }, fmt),
    ).toBe('Entwicklungsstand');
  });
});
