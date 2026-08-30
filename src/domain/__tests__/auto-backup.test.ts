import {
  autoBackupFileName,
  autoBackupsToPrune,
  formatBackupAge,
  isAutoBackupDue,
  isAutoBackupFile,
} from '@/domain/auto-backup';

describe('autoBackupFileName', () => {
  it('uses one file per day so a same-day rerun overwrites', () => {
    expect(autoBackupFileName('2026-08-30T05:12:00.000Z')).toBe('repz-auto-2026-08-30.json');
    expect(autoBackupFileName('2026-08-30T23:59:00.000Z')).toBe('repz-auto-2026-08-30.json');
  });
});

describe('isAutoBackupFile', () => {
  it('recognizes our files and ignores foreign ones', () => {
    expect(isAutoBackupFile('repz-auto-2026-08-30.json')).toBe(true);
    expect(isAutoBackupFile('reptic-backup-2026-08-30.json')).toBe(false); // manual export
    expect(isAutoBackupFile('repz-auto-2026-08-30.txt')).toBe(false);
    expect(isAutoBackupFile('notes.json')).toBe(false);
  });
});

describe('isAutoBackupDue', () => {
  const now = '2026-08-30T12:00:00.000Z';

  it('is due when there never was a backup', () => {
    expect(isAutoBackupDue(null, now)).toBe(true);
  });

  it('is due when the stored timestamp is unreadable', () => {
    expect(isAutoBackupDue('not-a-date', now)).toBe(true);
  });

  it('is not due within the interval', () => {
    expect(isAutoBackupDue('2026-08-30T00:00:00.000Z', now)).toBe(false); // 12h ago
    expect(isAutoBackupDue('2026-08-29T12:00:00.001Z', now)).toBe(false); // 1ms short of 24h
  });

  it('is due exactly at the interval and beyond', () => {
    expect(isAutoBackupDue('2026-08-29T12:00:00.000Z', now)).toBe(true);
    expect(isAutoBackupDue('2026-07-01T12:00:00.000Z', now)).toBe(true);
  });

  it('is due when the clock jumped backwards (future timestamp must not block forever)', () => {
    expect(isAutoBackupDue('2027-01-01T00:00:00.000Z', now)).toBe(true);
  });

  it('honors a custom interval', () => {
    expect(isAutoBackupDue('2026-08-30T10:00:00.000Z', now, 1)).toBe(true);
    expect(isAutoBackupDue('2026-08-30T11:30:00.000Z', now, 1)).toBe(false);
  });
});

describe('autoBackupsToPrune', () => {
  const names = [
    'repz-auto-2026-08-24.json',
    'repz-auto-2026-08-25.json',
    'repz-auto-2026-08-26.json',
    'repz-auto-2026-08-27.json',
    'repz-auto-2026-08-28.json',
    'repz-auto-2026-08-29.json',
    'repz-auto-2026-08-30.json',
  ];

  it('keeps everything while at or below the limit', () => {
    expect(autoBackupsToPrune(names, 7)).toEqual([]);
    expect(autoBackupsToPrune(names.slice(0, 3), 7)).toEqual([]);
  });

  it('drops the oldest beyond the limit', () => {
    const withExtra = ['repz-auto-2026-08-22.json', 'repz-auto-2026-08-23.json', ...names];
    expect(autoBackupsToPrune(withExtra, 7)).toEqual([
      'repz-auto-2026-08-22.json',
      'repz-auto-2026-08-23.json',
    ]);
  });

  it('sorts before pruning, whatever order the directory listing came in', () => {
    const shuffled = [...names].reverse();
    expect(autoBackupsToPrune(shuffled, 2)).toEqual([
      'repz-auto-2026-08-24.json',
      'repz-auto-2026-08-25.json',
      'repz-auto-2026-08-26.json',
      'repz-auto-2026-08-27.json',
      'repz-auto-2026-08-28.json',
    ]);
  });

  it('never returns a foreign file for deletion', () => {
    const mixed = ['reptic-backup-2020-01-01.json', 'my-notes.json', ...names];
    expect(autoBackupsToPrune(mixed, 1)).toEqual(names.slice(0, 6));
  });
});

describe('formatBackupAge', () => {
  const now = '2026-08-30T12:00:00.000Z';

  it('reports the absence of a backup', () => {
    expect(formatBackupAge(null, now)).toBe('noch nie');
    expect(formatBackupAge('garbage', now)).toBe('noch nie');
  });

  it('reports hours and days in German', () => {
    expect(formatBackupAge('2026-08-30T11:59:00.000Z', now)).toBe('gerade eben');
    expect(formatBackupAge('2026-08-30T11:00:00.000Z', now)).toBe('vor 1 Stunde');
    expect(formatBackupAge('2026-08-30T05:00:00.000Z', now)).toBe('vor 7 Stunden');
    expect(formatBackupAge('2026-08-29T12:00:00.000Z', now)).toBe('gestern');
    expect(formatBackupAge('2026-08-25T12:00:00.000Z', now)).toBe('vor 5 Tagen');
  });

  it('never claims a backup from the future', () => {
    expect(formatBackupAge('2027-01-01T00:00:00.000Z', now)).toBe('gerade eben');
  });
});
