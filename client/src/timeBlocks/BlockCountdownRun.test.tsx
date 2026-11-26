import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const played: string[] = [];
vi.mock('./blockAudio', () => ({ playCue: (k: string) => played.push(k) }));
import { BlockCountdownRun } from './BlockCountdownRun';

beforeEach(() => {
  vi.useFakeTimers();
  played.length = 0;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const spec = { fmt: 'amrap' as const, capSec: 720 };
const mountRun = (over: Partial<Parameters<typeof BlockCountdownRun>[0]> = {}) => {
  const h = { onStart: vi.fn(), onClose: vi.fn(), onCancel: vi.fn() };
  render(<BlockCountdownRun spec={spec} prefs={{ sound: true, vibrate: true }} {...h} {...over} />);
  return h;
};

describe('BlockCountdownRun', () => {
  it('shows the format, the length and 5, counts down, starts the block at GO and closes after the beat', () => {
    const h = mountRun();
    const d = screen.getByRole('dialog', { name: 'Get ready' });
    expect(d.textContent).toContain('AMRAP');
    expect(d.textContent).toContain('12:00');
    expect(d.textContent).toContain('Get in position');
    expect(d.textContent).toContain('5');
    act(() => void vi.advanceTimersByTime(5000));
    expect(h.onStart).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog').textContent).toContain('GO');
    expect(screen.getByRole('dialog').textContent).toContain('Clock running');
    expect(h.onClose).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(900));
    expect(h.onClose).toHaveBeenCalledTimes(1);
    expect(played).toEqual(['tick', 'tick', 'warn', 'warn', 'warn', 'go']);
  });

  it('tap skips straight to GO; Cancel before GO starts nothing', async () => {
    vi.useRealTimers();
    const h = mountRun();
    await userEvent.click(screen.getByRole('progressbar'));
    expect(h.onStart).toHaveBeenCalledTimes(1);
    cleanup();
    const c = mountRun();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(c.onCancel).toHaveBeenCalledTimes(1);
    expect(c.onStart).not.toHaveBeenCalled();
  });
});
