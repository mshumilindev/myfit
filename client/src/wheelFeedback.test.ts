import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const haptic = vi.fn();
vi.mock('./haptics', () => ({ haptic: (k: string) => haptic(k) }));

class FakeCtx {
  static made = 0;
  state = 'suspended';
  currentTime = 0;
  destination = {};
  resume = vi.fn(() => {
    this.state = 'running';
    return Promise.resolve();
  });
  constructor() {
    FakeCtx.made++;
  }
  createOscillator() {
    const o = {
      frequency: { value: 0 },
      connect: (n: unknown) => n,
      start: vi.fn(),
      stop: vi.fn(),
    };
    return o;
  }
  createGain() {
    return {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: (n: unknown) => n,
    };
  }
}

beforeEach(() => {
  vi.resetModules();
  haptic.mockClear();
  FakeCtx.made = 0;
  vi.stubGlobal('AudioContext', FakeCtx);
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeCtx;
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('wheelFeedback (SPO-318)', () => {
  it('a detent gives a haptic tick and a sound; fast repeats are thinned out', async () => {
    const m = await import('./wheelFeedback');
    const snd = vi.fn();
    m.setWheelSound(snd);
    const now = vi.spyOn(performance, 'now');
    now.mockReturnValue(1000);
    m.wheelDetent();
    now.mockReturnValue(1005);
    m.wheelDetent(); // inside the minimum gap
    now.mockReturnValue(1100);
    m.wheelDetent();
    expect(haptic).toHaveBeenCalledTimes(2);
    expect(haptic).toHaveBeenCalledWith('tick');
    expect(snd).toHaveBeenCalledTimes(2);
    now.mockRestore();
  });

  it('muting the sound keeps the haptic', async () => {
    const m = await import('./wheelFeedback');
    m.setWheelSound(null);
    m.wheelDetent();
    expect(haptic).toHaveBeenCalledTimes(1);
  });

  it('the default sound builds a short tick on one shared audio context', async () => {
    const m = await import('./wheelFeedback');
    m.tickSound();
    m.tickSound();
    expect(FakeCtx.made).toBe(1);
  });

  it('touching the drum unlocks audio (resumes a suspended context)', async () => {
    const m = await import('./wheelFeedback');
    m.wheelGrab();
    expect(FakeCtx.made).toBe(1);
  });

  it('no Web Audio → nothing throws', async () => {
    (window as unknown as { AudioContext: unknown }).AudioContext = undefined;
    const m = await import('./wheelFeedback');
    expect(() => {
      m.tickSound();
      m.wheelGrab();
    }).not.toThrow();
  });
});
