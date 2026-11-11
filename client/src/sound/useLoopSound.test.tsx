import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLoopSound } from './useLoopSound';

const SOUND = { ogg: '/a.ogg', mp3: '/a.mp3' };
const made: FakeAudio[] = [];
class FakeAudio {
  loop = false;
  paused = true;
  constructor(public src: string) {
    made.push(this);
  }
  play = vi.fn(() => {
    this.paused = false;
    return Promise.resolve();
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  removeAttribute = vi.fn();
  load = vi.fn();
}
function Probe({ on }: { on: boolean }) {
  useLoopSound(SOUND, on);
  return null;
}

beforeEach(() => {
  made.length = 0;
  vi.stubGlobal('Audio', FakeAudio);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useLoopSound', () => {
  it('loops while active and stops when it ends', async () => {
    const { rerender } = render(<Probe on />);
    await act(async () => {});
    expect(made).toHaveLength(1);
    expect(made[0].loop).toBe(true);
    expect(made[0].paused).toBe(false);
    rerender(<Probe on={false} />);
    expect(made[0].paused).toBe(true);
  });

  it('plays nothing while inactive', () => {
    render(<Probe on={false} />);
    expect(made).toHaveLength(0);
  });

  it('retries on the first tap when autoplay is refused', async () => {
    const reject = vi.fn(() => Promise.reject(new Error('NotAllowed')));
    class Blocked extends FakeAudio {
      play = reject;
    }
    vi.stubGlobal('Audio', Blocked);
    render(<Probe on />);
    await act(async () => {});
    expect(reject).toHaveBeenCalledTimes(1);
    await act(async () => {
      document.dispatchEvent(new Event('pointerdown'));
    });
    expect(reject).toHaveBeenCalledTimes(2);
  });
});
