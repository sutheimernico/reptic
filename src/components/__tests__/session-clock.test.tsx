import { act, render } from '@testing-library/react-native';

import { SessionClock } from '@/components/session-clock';

const START = '2026-09-27T10:00:00.000Z';

afterEach(() => {
  jest.useRealTimers();
});

describe('SessionClock', () => {
  it('ticks from the session start', async () => {
    jest.useFakeTimers({ now: Date.parse('2026-09-27T10:42:00.000Z') });
    const view = await render(<SessionClock startedAt={START} />);
    expect(view.getByText('42:00')).toBeTruthy();

    await act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(view.getByText('42:01')).toBeTruthy();
  });

  it('recomputes from the wall clock after time passed without ticks', async () => {
    jest.useFakeTimers({ now: Date.parse('2026-09-27T10:59:30.000Z') });
    const view = await render(<SessionClock startedAt={START} />);
    expect(view.getByText('59:30')).toBeTruthy();

    // A locked phone throttles timers: the clock moved on, the interval did not.
    jest.setSystemTime(Date.parse('2026-09-27T11:10:00.000Z'));
    await act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(view.getByText('1:10:01')).toBeTruthy();
  });

  it('renders nothing until the session start is known', async () => {
    const view = await render(<SessionClock startedAt={null} />);
    expect(view.toJSON()).toBeNull();
  });
});
