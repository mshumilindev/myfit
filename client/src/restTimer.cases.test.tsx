import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./haptics', () => ({ haptic: vi.fn() }));

import { haptic } from './haptics';
import {
  REST_PREFS_DEFAULT,
  REST_PRESETS,
  defaultRestSec,
  fmtCountdown,
  planRest,
  primeRestAudio,
  requestRestNotifications,
  restAlert,
  useWakeLock,
  type RestInputs,
  type RestPrefs,
} from './restTimer';

// Neutral lift: no equipment/muscle/rpe adjustments, so each test varies one factor.
const flat: RestInputs = {
  compound: true,
  equipment: [],
  primary: null,
  lastType: 'working',
  intensity: null,
  reps: 8,
  failure: false,
  rpe: null,
  muscleFatigue: 0,
  illness: false,
  shortSleep: false,
  midRound: false,
};
const sec = (p: Partial<RestInputs>) => planRest({ ...flat, ...p }).sec;
const keys = (p: Partial<RestInputs>) => planRest({ ...flat, ...p }).reasons.map((r) => r.key);

describe('REST_PRESETS / fmtCountdown', () => {
  it('presets are ascending seconds', () => {
    expect(REST_PRESETS).toEqual([...REST_PRESETS].sort((a, b) => a - b));
    expect(REST_PRESETS[0]).toBe(45);
  });
  it('formats m:ss, rounding and clamping negatives', () => {
    expect(fmtCountdown(0)).toBe('0:00');
    expect(fmtCountdown(9)).toBe('0:09');
    expect(fmtCountdown(60)).toBe('1:00');
    expect(fmtCountdown(125)).toBe('2:05');
    expect(fmtCountdown(89.6)).toBe('1:30');
    expect(fmtCountdown(-5)).toBe('0:00');
    expect(fmtCountdown(3600)).toBe('60:00');
  });
});

describe('defaultRestSec', () => {
  it('superset hand-off wins, then warm-up, then compound vs isolation', () => {
    expect(defaultRestSec({ compound: true, lastType: 'warmup', midRound: true })).toBe(0);
    expect(defaultRestSec({ compound: true, lastType: 'warmup', midRound: false })).toBe(60);
    expect(defaultRestSec({ compound: true, lastType: 'working', midRound: false })).toBe(150);
    expect(defaultRestSec({ compound: false, lastType: 'working', midRound: false })).toBe(90);
  });
});

describe('planRest: base from load', () => {
  it('splits at 0.85 / 0.72 and falls back to the lift type when load is unknown', () => {
    expect(sec({ intensity: 0.85 })).toBe(180);
    expect(keys({ intensity: 0.85 })).toEqual(['heavy']);
    expect(sec({ intensity: 0.8499 })).toBe(135);
    expect(sec({ intensity: 0.72 })).toBe(135);
    expect(keys({ intensity: 0.72 })).toEqual(['moderate']);
    expect(sec({ intensity: 0.7199 })).toBe(105);
    expect(keys({ intensity: 0.7199 })).toEqual(['light']);
    expect(sec({ intensity: 0 })).toBe(105);
    expect(sec({ intensity: null })).toBe(135);
    expect(sec({ intensity: null, compound: false })).toBe(60); // 90 - 27 isolation = 63 -> 60
  });
  it('an isolation lift loses 30% of the base and says so', () => {
    const p = planRest({ ...flat, compound: false, intensity: 0.9 });
    expect(p.reasons).toEqual([
      { key: 'heavy', sec: 0 },
      { key: 'isolation', sec: -54 },
    ]);
    expect(p.sec).toBe(120); // 180 - 54 = 126 -> 120
  });
});

describe('planRest: adjustments', () => {
  const mid = { intensity: 0.8 }; // 135 base
  it('free weights add 15 only for compound barbell/EZ lifts', () => {
    expect(sec({ ...mid, equipment: ['barbell'] })).toBe(150);
    expect(keys({ ...mid, equipment: ['ezBar'] })).toContain('freeWeight');
    expect(keys({ ...mid, equipment: ['dumbbell'] })).not.toContain('freeWeight');
    expect(keys({ ...mid, compound: false, equipment: ['barbell'] })).not.toContain('freeWeight');
  });
  it('machines/cables (all of them) take 15 off; a mix or no equipment does not', () => {
    expect(sec({ ...mid, equipment: ['machine', 'cable'] })).toBe(120);
    expect(keys({ ...mid, equipment: ['machine', 'dumbbell'] })).not.toContain('machine');
    expect(keys({ ...mid, equipment: [] })).not.toContain('machine');
  });
  it('big muscles +15, small muscles -15, others unchanged', () => {
    expect(sec({ ...mid, primary: 'quads' })).toBe(150);
    expect(keys({ ...mid, primary: 'lats' })).toContain('bigMuscle');
    expect(sec({ ...mid, primary: 'biceps' })).toBe(120);
    expect(keys({ ...mid, primary: 'biceps' })).toContain('smallMuscle');
    expect(sec({ ...mid, primary: 'shoulders' })).toBe(135);
  });
  it('failure +30 (and outranks RPE), RPE 9+ +20, RPE <=7 -15, 8 neutral', () => {
    expect(sec({ ...mid, failure: true, rpe: 6 })).toBe(165);
    expect(keys({ ...mid, failure: true, rpe: 6 })).toEqual(['moderate', 'failure']);
    expect(sec({ ...mid, rpe: 9 })).toBe(150); // 155 -> 150
    expect(keys({ ...mid, rpe: 9 })).toContain('hard');
    expect(sec({ ...mid, rpe: 7 })).toBe(120);
    expect(keys({ ...mid, rpe: 7 })).toContain('easy');
    expect(keys({ ...mid, rpe: 8 })).toEqual(['moderate']);
    expect(keys({ ...mid, rpe: null })).toEqual(['moderate']);
  });
  it('15+ reps shorten rest by 15', () => {
    expect(sec({ ...mid, reps: 15 })).toBe(120);
    expect(keys({ ...mid, reps: 14 })).not.toContain('highReps');
  });
  it('drop sets +30, static-dynamic +15, plain working sets none', () => {
    expect(sec({ ...mid, lastType: 'drop' })).toBe(165);
    expect(sec({ ...mid, lastType: 'reverse-drop' })).toBe(165);
    expect(sec({ ...mid, lastType: 'static-dynamic' })).toBe(150);
    expect(keys({ ...mid, lastType: 'working' })).not.toContain('technique');
  });
  it('muscle fatigue counts above 0.15, scales to 30 s and is capped at 1', () => {
    const f = (x: number) => planRest({ ...flat, ...mid, muscleFatigue: x });
    expect(f(0.15).reasons.map((r) => r.key)).not.toContain('fatigue');
    expect(f(0.16).reasons.find((r) => r.key === 'fatigue')!.sec).toBe(5);
    expect(f(0.5).reasons.find((r) => r.key === 'fatigue')!.sec).toBe(15);
    expect(f(1).reasons.find((r) => r.key === 'fatigue')!.sec).toBe(30);
    expect(f(3).reasons.find((r) => r.key === 'fatigue')!.sec).toBe(30);
  });
  it('illness +20 and short sleep +15', () => {
    expect(sec({ ...mid, illness: true })).toBe(150); // 155
    expect(sec({ ...mid, shortSleep: true })).toBe(150);
    expect(sec({ ...mid, illness: true, shortSleep: true })).toBe(165); // 170 -> 165
  });
  it('condition scale stretches the running total (capped at x2); nicotine scale does so silently', () => {
    expect(planRest({ ...flat, ...mid, restScale: 1.5 }).reasons).toContainEqual({
      key: 'condition',
      sec: 68,
    });
    expect(sec({ ...mid, restScale: 1.5 })).toBe(210); // 135 + 68 = 203 -> 210
    expect(sec({ ...mid, restScale: 9 })).toBe(270);
    expect(sec({ ...mid, restScale: 0.5 })).toBe(135);
    const n = planRest({ ...flat, ...mid, nicotineRestScale: 1.2 });
    expect(n.sec).toBe(165); // 162 -> 165
    expect(n.reasons.map((r) => r.key)).toEqual(['moderate']);
    expect(sec({ ...mid, nicotineRestScale: 1 })).toBe(135);
    expect(sec({ ...mid, nicotineRestScale: 0.8 })).toBe(135);
  });
  it('is bounded between 30 s and 5 min', () => {
    expect(sec({ compound: false, intensity: 0.5, primary: 'calves', rpe: 6, reps: 20 })).toBe(30);
    expect(
      sec({
        intensity: 0.95,
        equipment: ['barbell'],
        primary: 'quads',
        failure: true,
        restScale: 2,
      }),
    ).toBe(300);
  });
  it('warm-ups are 60 s and supersets 0 s whatever else is asked', () => {
    expect(planRest({ ...flat, lastType: 'warmup', failure: true, restScale: 2 })).toEqual({
      sec: 60,
      reasons: [{ key: 'warmup', sec: 60 }],
    });
    expect(planRest({ ...flat, midRound: true, lastType: 'warmup' })).toEqual({
      sec: 0,
      reasons: [{ key: 'superset', sec: 0 }],
    });
  });
});

// ---- side effects ---------------------------------------------------------

const prefs = (p: Partial<RestPrefs> = {}): RestPrefs => ({
  ...REST_PREFS_DEFAULT,
  vibrate: false,
  sound: false,
  notify: false,
  ...p,
});

class FakeCtx {
  static created = 0;
  static last: FakeCtx;
  state: AudioContextState = 'suspended';
  currentTime = 10;
  destination = {};
  resumed = 0;
  oscillators: Array<{
    type: string;
    frequency: { value: number };
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }> = [];
  constructor() {
    FakeCtx.created++;
    FakeCtx.last = this;
  }
  resume() {
    this.resumed++;
    return Promise.resolve();
  }
  createOscillator() {
    const o = {
      type: '',
      frequency: { value: 0 },
      start: vi.fn(),
      stop: vi.fn(),
      connect: (x: unknown) => x,
    };
    this.oscillators.push(o);
    return o;
  }
  createGain() {
    return {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: (x: unknown) => x,
    };
  }
}
const win = window as unknown as Record<string, unknown>;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.mocked(haptic).mockReset();
});

describe('audio chime (module keeps one AudioContext; tests run in order)', () => {
  it('without any AudioContext priming is a no-op and a chime is silent', () => {
    delete win.AudioContext;
    delete win.webkitAudioContext;
    expect(() => primeRestAudio()).not.toThrow();
    expect(() => restAlert(prefs({ sound: true }))).not.toThrow();
  });

  it('a constructor that throws is swallowed (vibration still works)', () => {
    win.AudioContext = class {
      constructor() {
        throw new Error('blocked');
      }
    };
    expect(() => primeRestAudio()).not.toThrow();
    restAlert(prefs({ vibrate: true, sound: true }));
    expect(haptic).toHaveBeenCalledWith('double');
  });

  it('falls back to webkitAudioContext, resumes a suspended context, creates it only once', () => {
    delete win.AudioContext;
    win.webkitAudioContext = FakeCtx;
    primeRestAudio();
    expect(FakeCtx.created).toBe(1);
    expect(FakeCtx.last.resumed).toBe(1);
    primeRestAudio();
    expect(FakeCtx.created).toBe(1);
    expect(FakeCtx.last.resumed).toBe(2);
    FakeCtx.last.state = 'running';
    primeRestAudio();
    expect(FakeCtx.last.resumed).toBe(2); // running: nothing to resume
  });

  it('does not chime while the context is suspended', () => {
    FakeCtx.last.state = 'suspended';
    restAlert(prefs({ sound: true }));
    expect(FakeCtx.last.oscillators).toHaveLength(0);
  });

  it('plays two rising tones (880 then 1320 Hz, 0.18 s apart) when running, and none when sound is off', () => {
    FakeCtx.last.state = 'running';
    restAlert(prefs({ sound: false }));
    expect(FakeCtx.last.oscillators).toHaveLength(0);
    restAlert(prefs({ sound: true }));
    expect(FakeCtx.last.oscillators.map((o) => o.frequency.value)).toEqual([880, 1320]);
    expect(FakeCtx.last.oscillators.every((o) => o.type === 'sine')).toBe(true);
    expect(FakeCtx.last.oscillators[0].start).toHaveBeenCalledWith(10);
    expect(FakeCtx.last.oscillators[1].start).toHaveBeenCalledWith(10.18);
    expect(FakeCtx.last.oscillators[0].stop).toHaveBeenCalledWith(10.4);
  });
});

describe('restAlert: vibration and notification', () => {
  it('vibrates only when asked, and a throwing haptic is ignored', () => {
    restAlert(prefs({ vibrate: false }));
    expect(haptic).not.toHaveBeenCalled();
    restAlert(prefs({ vibrate: true }));
    expect(haptic).toHaveBeenCalledWith('double');
    vi.mocked(haptic).mockImplementation(() => {
      throw new Error('x');
    });
    expect(() => restAlert(prefs({ vibrate: true }))).not.toThrow();
  });

  describe('background notification', () => {
    const show = vi.fn();
    const setup = (
      o: { hidden?: boolean; permission?: string; sw?: 'ok' | 'reject' | 'none' } = {},
    ) => {
      show.mockReset();
      Object.defineProperty(document, 'visibilityState', {
        value: o.hidden === false ? 'visible' : 'hidden',
        configurable: true,
      });
      vi.stubGlobal('Notification', { permission: o.permission ?? 'granted' });
      const sw = o.sw ?? 'ok';
      Object.defineProperty(navigator, 'serviceWorker', {
        value:
          sw === 'none'
            ? undefined
            : {
                ready:
                  sw === 'reject'
                    ? Promise.reject(new Error('no sw'))
                    : Promise.resolve({ showNotification: show }),
              },
        configurable: true,
      });
    };
    const note = { title: 'Rest over', body: 'Next set' };
    afterEach(() =>
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }),
    );

    it('shows through the service worker when hidden, permitted and enabled', async () => {
      setup();
      restAlert(prefs({ notify: true }), note);
      await vi.waitFor(() =>
        expect(show).toHaveBeenCalledWith('Rest over', { body: 'Next set', tag: 'rest-done' }),
      );
    });

    it.each([
      ['the app is in the foreground', { hidden: false }],
      ['permission is not granted', { permission: 'default' }],
      ['permission was denied', { permission: 'denied' }],
    ])('stays quiet when %s', async (_n, o) => {
      setup(o);
      restAlert(prefs({ notify: true }), note);
      await new Promise((r) => setTimeout(r, 10));
      expect(show).not.toHaveBeenCalled();
    });

    it('stays quiet without the notify pref or without a message', async () => {
      setup();
      restAlert(prefs({ notify: false }), note);
      restAlert(prefs({ notify: true }));
      await new Promise((r) => setTimeout(r, 10));
      expect(show).not.toHaveBeenCalled();
    });

    it('a missing or failing service worker never throws', async () => {
      setup({ sw: 'none' });
      expect(() => restAlert(prefs({ notify: true }), note)).not.toThrow();
      setup({ sw: 'reject' });
      expect(() => restAlert(prefs({ notify: true }), note)).not.toThrow();
      await new Promise((r) => setTimeout(r, 10));
    });

    it('does not touch Notification at all when the platform lacks it', () => {
      setup();
      vi.stubGlobal('Notification', undefined);
      expect(() => restAlert(prefs({ notify: true }), note)).not.toThrow();
      expect(show).not.toHaveBeenCalled();
    });
  });
});

describe('requestRestNotifications', () => {
  it('false when unsupported; true/false straight from an existing decision without asking', async () => {
    vi.stubGlobal('Notification', undefined);
    expect(await requestRestNotifications()).toBe(false);
    const req = vi.fn();
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission: req });
    expect(await requestRestNotifications()).toBe(true);
    vi.stubGlobal('Notification', { permission: 'denied', requestPermission: req });
    expect(await requestRestNotifications()).toBe(false);
    expect(req).not.toHaveBeenCalled();
  });
  it('asks when undecided: granted -> true, denied -> false, throwing prompt -> false', async () => {
    const ask = (r: () => Promise<string>) =>
      vi.stubGlobal('Notification', { permission: 'default', requestPermission: r });
    ask(() => Promise.resolve('granted'));
    expect(await requestRestNotifications()).toBe(true);
    ask(() => Promise.resolve('denied'));
    expect(await requestRestNotifications()).toBe(false);
    ask(() => Promise.reject(new Error('x')));
    expect(await requestRestNotifications()).toBe(false);
  });
});

describe('useWakeLock', () => {
  let release: ReturnType<typeof vi.fn>;
  let request: ReturnType<typeof vi.fn>;
  const vis = (v: 'visible' | 'hidden') =>
    Object.defineProperty(document, 'visibilityState', { value: v, configurable: true });
  const install = (impl?: () => Promise<{ release: () => Promise<void> }>) => {
    release = vi.fn(() => Promise.resolve());
    request = vi.fn(impl ?? (() => Promise.resolve({ release })));
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
  };
  beforeEach(() => vis('visible'));
  afterEach(() => {
    delete (navigator as { wakeLock?: unknown }).wakeLock;
    vis('visible');
  });
  const tick = () => act(() => Promise.resolve());

  it('requests a screen lock only while active and releases it on unmount', async () => {
    install();
    const { rerender, unmount } = renderHook(({ on }) => useWakeLock(on), {
      initialProps: { on: false },
    });
    expect(request).not.toHaveBeenCalled();
    rerender({ on: true });
    await tick();
    expect(request).toHaveBeenCalledWith('screen');
    expect(release).not.toHaveBeenCalled();
    rerender({ on: false });
    expect(release).toHaveBeenCalledTimes(1);
    unmount();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the Wake Lock API is missing', () => {
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
  });

  it('waits for the page to be visible, then acquires on return to the foreground', async () => {
    install();
    vis('hidden');
    renderHook(() => useWakeLock(true));
    await tick();
    expect(request).not.toHaveBeenCalled();
    vis('visible');
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    await tick();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('re-acquires after the browser dropped the lock on hide', async () => {
    install();
    renderHook(() => useWakeLock(true));
    await tick();
    vis('hidden');
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    vis('visible');
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    await tick();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('a lock that resolves after unmount is released immediately', async () => {
    let resolve!: (l: { release: () => Promise<void> }) => void;
    install(() => new Promise((r) => (resolve = r)));
    const { unmount } = renderHook(() => useWakeLock(true));
    unmount();
    const rel = vi.fn(() => Promise.resolve());
    resolve({ release: rel });
    await tick();
    expect(rel).toHaveBeenCalledTimes(1);
  });

  it('a refused request or a failing release is swallowed', async () => {
    install(() => Promise.reject(new Error('denied')));
    const a = renderHook(() => useWakeLock(true));
    await tick();
    expect(() => a.unmount()).not.toThrow();
    install();
    release.mockImplementation(() => Promise.reject(new Error('gone')));
    const b = renderHook(() => useWakeLock(true));
    await tick();
    expect(() => b.unmount()).not.toThrow();
    await tick();
  });
});
