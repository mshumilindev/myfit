import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { FOREGROUND_CHECK_MS, startAutoUpdate, type PwaUpdateDeps } from './pwaUpdate';

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
