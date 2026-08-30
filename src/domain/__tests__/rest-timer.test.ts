import {
  clampRestSeconds,
  DEFAULT_REST_SECONDS,
  isExpired,
  MAX_REST_SECONDS,
  parseRestSeconds,
  REST_OFF,
  remainingSeconds,
  stepRestSeconds,
} from '@/domain/rest-timer';

const START = 1_800_000_000_000; // arbitrary fixed wall clock

describe('remainingSeconds', () => {
  const timer = { startedAtMs: START, durationSec: 120 };

  it('shows the full duration at the moment it starts', () => {
    expect(remainingSeconds(timer, START)).toBe(120);
  });

  it('rounds up so the first second still reads as the full duration', () => {
    expect(remainingSeconds(timer, START + 1)).toBe(120);
    expect(remainingSeconds(timer, START + 1000)).toBe(119);
    expect(remainingSeconds(timer, START + 1500)).toBe(119);
  });

  it('bottoms out at zero instead of going negative', () => {
    expect(remainingSeconds(timer, START + 120_000)).toBe(0);
    expect(remainingSeconds(timer, START + 600_000)).toBe(0);
  });

  it('is computed from the wall clock, so backgrounding cannot freeze it', () => {
    // Two minutes in the background with no ticks in between.
    expect(isExpired(timer, START + 130_000)).toBe(true);
    expect(isExpired(timer, START + 60_000)).toBe(false);
  });
});

describe('clampRestSeconds', () => {
  it('snaps to 15s steps', () => {
    expect(clampRestSeconds(100)).toBe(105);
    expect(clampRestSeconds(112)).toBe(105);
    expect(clampRestSeconds(113)).toBe(120);
  });

  it('treats zero and below as off', () => {
    expect(clampRestSeconds(0)).toBe(REST_OFF);
    expect(clampRestSeconds(-30)).toBe(REST_OFF);
    expect(clampRestSeconds(Number.NaN)).toBe(REST_OFF);
  });

  it('keeps the result inside the offered range', () => {
    expect(clampRestSeconds(5)).toBe(15);
    expect(clampRestSeconds(9999)).toBe(MAX_REST_SECONDS);
  });
});

describe('parseRestSeconds', () => {
  it('falls back to the default when unset or unreadable', () => {
    expect(parseRestSeconds(null)).toBe(DEFAULT_REST_SECONDS);
    expect(parseRestSeconds('nonsense')).toBe(DEFAULT_REST_SECONDS);
  });

  it('reads a stored value and honors an explicit off', () => {
    expect(parseRestSeconds('90')).toBe(90);
    expect(parseRestSeconds('0')).toBe(REST_OFF);
  });

  it('repairs a stored value that is off-step or out of range', () => {
    expect(parseRestSeconds('100')).toBe(105);
    expect(parseRestSeconds('99999')).toBe(MAX_REST_SECONDS);
  });
});

describe('stepRestSeconds', () => {
  it('moves in 15s steps', () => {
    expect(stepRestSeconds(120, 1)).toBe(135);
    expect(stepRestSeconds(120, -1)).toBe(105);
  });

  it('reaches off by stepping down past the minimum', () => {
    expect(stepRestSeconds(15, -1)).toBe(REST_OFF);
    expect(stepRestSeconds(REST_OFF, -1)).toBe(REST_OFF);
  });

  it('turns back on from off and stops at the maximum', () => {
    expect(stepRestSeconds(REST_OFF, 1)).toBe(15);
    expect(stepRestSeconds(MAX_REST_SECONDS, 1)).toBe(MAX_REST_SECONDS);
  });
});
