import { beforeEach, describe, expect, it, vi } from 'vitest';

const osc = vi.fn();
const ctx = {
  currentTime: 0,
  destination: {},
  createOscillator: () => {
    osc();
    return {
      type: '',
      frequency: { value: 0 },
      connect: (n: unknown) => n,
      start: vi.fn(),
      stop: vi.fn(),
    };
  },
  createGain: () => ({
    gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: (n: unknown) => n,
  }),
};
let live: unknown = ctx;
const buzz = vi.fn();
vi.mock('../restTimer', () => ({ restAudioCtx: () => live, primeRestAudio: vi.fn() }));
vi.mock('../haptics', () => ({ haptic: (k: string) => buzz(k) }));
import { playCue } from './blockAudio';

beforeEach(() => {
  osc.mockClear();
  buzz.mockClear();
  live = ctx;
});

describe('playCue', () => {
  it('plays the tones of the cue and vibrates', () => {
    playCue('tick', { sound: true, vibrate: true });
    expect(osc).toHaveBeenCalledTimes(1);
    expect(buzz).toHaveBeenCalledWith('tick');
    osc.mockClear();
    playCue('heads-up', { sound: true, vibrate: true }); // two beeps
    expect(osc).toHaveBeenCalledTimes(2);
  });
  it('plays no audio when sound is off, but still vibrates', () => {
    playCue('go', { sound: false, vibrate: true });
    expect(osc).not.toHaveBeenCalled();
    expect(buzz).toHaveBeenCalledWith('success');
  });
  it('stays silent and does not throw before audio is unlocked', () => {
    live = null;
    expect(() => playCue('end', { sound: true, vibrate: false })).not.toThrow();
    expect(osc).not.toHaveBeenCalled();
    expect(buzz).not.toHaveBeenCalled();
  });
});
