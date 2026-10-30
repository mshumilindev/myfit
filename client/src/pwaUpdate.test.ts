import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  FOREGROUND_CHECK_MS,
  checkBuild,
  loadedAssetUrls,
  warmLoadedAssets,
  reloadToLatest,
  settledBuildCheck,
  startAutoUpdate,
  type PwaUpdateDeps,
} from './pwaUpdate';

interface Harness {
  deps: PwaUpdateDeps;
  onUpdateReady: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  register: ReturnType<typeof vi.fn>;
  fireControllerChange: () => void;
  fireVisibility: () => void;
  setVisible: (visible: boolean) => void;
  advance: (ms: number) => void;
}

function harness(opts: { controlled?: boolean; registerFails?: boolean } = {}): Harness {
  const controllerListeners: Array<() => void> = [];
  const docListeners: Array<() => void> = [];
  const update = vi.fn(() => Promise.resolve());
  const register = vi.fn(() =>
    opts.registerFails
      ? Promise.reject(new Error('nope'))
      : Promise.resolve({ update } as unknown as ServiceWorkerRegistration),
  );
  let visible = true;
  let clock = 1_000;

  const container = {
    controller: opts.controlled ? ({} as ServiceWorker) : null,
    register,
    addEventListener: (_type: string, cb: () => void) => controllerListeners.push(cb),
  } as unknown as ServiceWorkerContainer;

  const doc = {
    addEventListener: (_type: string, cb: () => void) => docListeners.push(cb),
    get visibilityState() {
      return visible ? 'visible' : 'hidden';
    },
  } as unknown as PwaUpdateDeps['doc'];

  const onUpdateReady = vi.fn();
  return {
    deps: { container, doc, onUpdateReady, now: () => clock },
    onUpdateReady,
    update,
    register,
    fireControllerChange: () => controllerListeners.forEach((cb) => cb()),
    fireVisibility: () => docListeners.forEach((cb) => cb()),
    setVisible: (v: boolean) => {
      visible = v;
    },
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe('startAutoUpdate', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('signals update-ready when a replacement worker takes control', async () => {
    const h = harness({ controlled: true });
    await startAutoUpdate(h.deps);
    h.fireControllerChange();
    expect(h.onUpdateReady).toHaveBeenCalledTimes(1);
  });

  it('does not signal when the first worker ever claims the page', async () => {
    const h = harness({ controlled: false });
    await startAutoUpdate(h.deps);
    h.fireControllerChange();
    expect(h.onUpdateReady).not.toHaveBeenCalled();
    // The worker that replaces it must still raise the signal.
    h.fireControllerChange();
    expect(h.onUpdateReady).toHaveBeenCalledTimes(1);
  });

  it('runs the first-claim warm-up once, and only for the first worker ever', async () => {
    const first = harness({ controlled: false });
    const onFirstClaim = vi.fn();
    await startAutoUpdate({ ...first.deps, onFirstClaim });
    first.fireControllerChange();
    first.fireControllerChange();
    expect(onFirstClaim).toHaveBeenCalledTimes(1);

    const replaced = harness({ controlled: true });
    const none = vi.fn();
    await startAutoUpdate({ ...replaced.deps, onFirstClaim: none });
    replaced.fireControllerChange();
    expect(none).not.toHaveBeenCalled();
  });

  it('signals once even if control changes repeatedly', async () => {
    const h = harness({ controlled: true });
    await startAutoUpdate(h.deps);
    h.fireControllerChange();
    h.fireControllerChange();
    expect(h.onUpdateReady).toHaveBeenCalledTimes(1);
  });

  it('checks for a new build when the app returns to the foreground', async () => {
    const h = harness({ controlled: true });
    await startAutoUpdate(h.deps);
    h.advance(FOREGROUND_CHECK_MS);
    h.fireVisibility();
    expect(h.update).toHaveBeenCalledTimes(1);
  });

  it('skips the check while hidden and throttles bursts', async () => {
    const h = harness({ controlled: true });
    await startAutoUpdate(h.deps);

    h.setVisible(false);
    h.advance(FOREGROUND_CHECK_MS);
    h.fireVisibility();
    expect(h.update).not.toHaveBeenCalled();

    h.setVisible(true);
    h.fireVisibility();
    expect(h.update).toHaveBeenCalledTimes(1);

    h.advance(FOREGROUND_CHECK_MS - 1);
    h.fireVisibility();
    expect(h.update).toHaveBeenCalledTimes(1);

    h.advance(1);
    h.fireVisibility();
    expect(h.update).toHaveBeenCalledTimes(2);
  });

  it('survives a failed registration without wiring update checks', async () => {
    const h = harness({ controlled: true, registerFails: true });
    await startAutoUpdate(h.deps);
    h.advance(FOREGROUND_CHECK_MS);
    h.fireVisibility();
    expect(h.update).not.toHaveBeenCalled();
    // Control changes still signal — the old worker may hand over at any time.
    h.fireControllerChange();
    expect(h.onUpdateReady).toHaveBeenCalledTimes(1);
  });
});

describe('checkBuild', () => {
  const reply = (body: unknown, ok = true) =>
    vi.fn(() => Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response));

  it('raises the update signal when the live build differs from the running one', async () => {
    const onNewer = vi.fn();
    expect(await checkBuild(reply({ build: 'b2' }), 'b1', onNewer)).toBe(true);
    expect(onNewer).toHaveBeenCalledOnce();
  });

  it('stays quiet on the same build, a failed request, offline or a dev build', async () => {
    const onNewer = vi.fn();
    expect(await checkBuild(reply({ build: 'b1' }), 'b1', onNewer)).toBe(false);
    expect(await checkBuild(reply({}, false), 'b1', onNewer)).toBe(false);
    expect(
      await checkBuild(
        vi.fn(() => Promise.reject(new Error('offline'))),
        'b1',
        onNewer,
      ),
    ).toBe(false);
    expect(await checkBuild(reply({ build: 'b2' }), null, onNewer)).toBe(false);
    expect(onNewer).not.toHaveBeenCalled();
  });
});

describe('checkBuild offline', () => {
  it('sends no request while the browser is offline (a failed fetch would be logged to the console)', async () => {
    const spy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      const fetchFn = vi.fn();
      const onNewer = vi.fn();
      expect(await checkBuild(fetchFn as unknown as typeof fetch, 'b1', onNewer)).toBe(false);
      expect(fetchFn).not.toHaveBeenCalled();
      expect(onNewer).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('reloadToLatest', () => {
  it('pulls the newest build first, then reloads exactly once', async () => {
    const order: string[] = [];
    const update = vi.fn(async () => {
      order.push('update');
      return 'updated' as const;
    });
    const reload = vi.fn(() => order.push('reload'));
    await reloadToLatest(update, reload, 10);
    expect(order).toEqual(['update', 'reload']);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('still reloads when the update check throws (offline)', async () => {
    const reload = vi.fn();
    await reloadToLatest(() => Promise.reject(new Error('offline')), reload, 10);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('settledBuildCheck', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('turns the triggers of one page load into a single check, after the settle time', () => {
    const check = vi.fn();
    const run = settledBuildCheck(check, 1500);
    run(); // start
    run(); // pageshow
    run(); // visible
    vi.advanceTimersByTime(1499);
    expect(check).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('accepts a new trigger once the previous check has run', () => {
    const check = vi.fn();
    const run = settledBuildCheck(check, 100);
    run();
    vi.advanceTimersByTime(100);
    run();
    vi.advanceTimersByTime(100);
    expect(check).toHaveBeenCalledTimes(2);
  });
});

describe('warmLoadedAssets (SPO-380)', () => {
  const origin = 'https://example.test';
  const entries = [
    { name: 'https://example.test/assets/TodayScreen-abc.js' },
    { name: 'https://example.test/assets/TodayScreen-abc.js' },
    { name: 'https://example.test/assets/coach-def.css?x=1' },
    { name: 'https://example.test/assets/inter-1.woff2' },
    { name: 'https://example.test/assets/pic.webp' },
    { name: 'https://other.test/assets/evil.js' },
    { name: 'https://example.test/api/thing.js' },
    { name: 'not a url' },
  ];

  it('lists each hashed js/css/font of this origin once', () => {
    expect(loadedAssetUrls(entries, origin)).toEqual([
      '/assets/TodayScreen-abc.js',
      '/assets/coach-def.css',
      '/assets/inter-1.woff2',
    ]);
  });

  it('asks for every one of them again and survives a failing request', async () => {
    const fetchFn = vi.fn((url: RequestInfo | URL) =>
      String(url).endsWith('.css')
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(new Response('')),
    );
    await expect(
      warmLoadedAssets(entries, origin, fetchFn as unknown as typeof fetch),
    ).resolves.toBeUndefined();
    expect(fetchFn.mock.calls.map((c) => c[0])).toEqual([
      '/assets/TodayScreen-abc.js',
      '/assets/coach-def.css',
      '/assets/inter-1.woff2',
    ]);
  });

  it('does nothing without an origin', async () => {
    const fetchFn = vi.fn();
    await warmLoadedAssets(entries, '', fetchFn as unknown as typeof fetch);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
