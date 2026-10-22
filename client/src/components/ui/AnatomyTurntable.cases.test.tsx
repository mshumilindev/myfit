import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AnatomyTurntable as Turntable, TurnCamera } from './AnatomyTurntable';

// Same approach as the pipeline test: a faked canvas pipeline, but contexts are per canvas and every
// finished bitmap remembers which turntable angle it was built from, so what the visible canvas paints can
// be asserted (the nearest finished frame to the current angle).
const load = async () => {
  vi.resetModules();
  return (await import('./AnatomyTurntable')).AnatomyTurntable as typeof Turntable;
};

interface Ctx {
  drawImage: ReturnType<typeof vi.fn>;
  lastSrc: string;
  fills: string[];
  blurs: number[];
  alphas: number[];
  [k: string]: unknown;
}
const ctxs = new Map<HTMLCanvasElement, Ctx>();
const closed = vi.fn();
let rafQueue: Array<(t: number) => void> = [];
let clock = 0;

class FakeImage {
  decoding = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';
  constructor() {
    Object.defineProperty(this, 'src', {
      set: (v: string) => {
        this._src = v;
        queueMicrotask(() => this.onload?.());
      },
      get: () => this._src,
    });
  }
  _src = '';
}

function makeCtx(cv: HTMLCanvasElement): Ctx {
  const c = {
    lastSrc: '',
    fills: [] as string[],
    blurs: [] as number[],
    alphas: [] as number[],
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    imageSmoothingQuality: 'low',
    globalCompositeOperation: 'source-over',
    shadowColor: '',
  } as unknown as Ctx;
  c.drawImage = vi.fn((img: unknown) => {
    const im = img as { _src?: string };
    if (im && typeof im._src === 'string') c.lastSrc = im._src;
  });
  let fill = '';
  let blur = 0;
  let alpha = 1;
  Object.defineProperty(c, 'fillStyle', {
    get: () => fill,
    set: (v: string) => c.fills.push((fill = v)),
  });
  Object.defineProperty(c, 'shadowBlur', {
    get: () => blur,
    set: (v: number) => c.blurs.push((blur = v)),
  });
  Object.defineProperty(c, 'globalAlpha', {
    get: () => alpha,
    set: (v: number) => c.alphas.push((alpha = v)),
  });
  ctxs.set(cv, c);
  return c;
}
const visible = () =>
  ctxs.get(document.querySelector('canvas.uiturn-canvas') as HTMLCanvasElement)!;
const degOf = (b: unknown) => (b as { deg: number }).deg;
const lastPaintedDeg = () => {
  const calls = visible().drawImage.mock.calls;
  return degOf(calls[calls.length - 1][0]);
};
const flushRaf = (steps = 1) => {
  for (let i = 0; i < steps; i++) {
    const q = rafQueue;
    rafQueue = [];
    clock += 1000;
    act(() => q.forEach((f) => f(clock)));
  }
};

const cam = (over: Partial<TurnCamera> = {}): TurnCamera => ({
  yaw: 0,
  y: 0.5,
  zoom: 1,
  n: 0,
  ...over,
});

beforeEach(() => {
  ctxs.clear();
  rafQueue = [];
  clock = 0;
  closed.mockClear();
  vi.stubGlobal('Image', FakeImage);
  vi.stubGlobal('requestAnimationFrame', (f: (t: number) => void) => rafQueue.push(f));
  vi.stubGlobal('cancelAnimationFrame', () => {
    rafQueue = [];
  });
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async (cv: HTMLCanvasElement) => {
      const m = /turn\/[^/]+\/(\d+)\.webp/.exec(ctxs.get(cv)?.lastSrc ?? '');
      return { deg: m ? Number(m[1]) : -1, close: closed } as unknown as ImageBitmap;
    }),
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    return (ctxs.get(this) ?? makeCtx(this)) as unknown as CanvasRenderingContext2D;
  } as never);
  Element.prototype.setPointerCapture = vi.fn();
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function ready(ui: React.ReactElement) {
  const r = render(ui);
  await waitFor(() =>
    expect((createImageBitmap as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(
      72,
    ),
  );
  await act(async () => void (await new Promise((res) => setTimeout(res, 0))));
  flushRaf(3);
  return r;
}
const stage = () => screen.getByRole('img');

describe('AnatomyTurntable · camera & painting', () => {
  it('paints the frame at the camera yaw once built (reduced motion: no tween)', async () => {
    const T = await load();
    await ready(<T label="x" camera={cam({ yaw: 90 })} />);
    expect(lastPaintedDeg()).toBe(90);
  });

  it('spins the short way round to a new yaw', async () => {
    const T = await load();
    const { rerender } = await ready(<T label="x" camera={cam({ yaw: 350 })} />);
    expect(lastPaintedDeg()).toBe(350);
    rerender(<T label="x" camera={cam({ yaw: 10, n: 1 })} />);
    flushRaf(3);
    expect(lastPaintedDeg()).toBe(10);
  });

  it('tweens over time when motion is allowed, ending exactly on the target', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const T = await load();
    await ready(<T label="x" camera={cam({ yaw: 0 })} />);
    cleanup();
    ctxs.clear();
    const T2 = await load();
    const { rerender } = await ready(<T2 label="x" camera={cam({ yaw: 0 })} />);
    rerender(<T2 label="x" camera={cam({ yaw: 180, n: 1, zoom: 2, y: 0.3 })} />);
    // first tick starts the clock, later ticks progress; a tween takes more than one frame
    flushRaf(1);
    expect(lastPaintedDeg()).not.toBe(180);
    flushRaf(6);
    expect(lastPaintedDeg()).toBe(180);
  });

  it('works when matchMedia is unavailable', async () => {
    vi.stubGlobal('matchMedia', undefined);
    const T = await load();
    await ready(<T label="x" camera={cam({ yaw: 45 })} />);
    flushRaf(6);
    expect(lastPaintedDeg()).toBe(45);
  });

  it('skips painting (no throw) when the zoomed window lies outside the frame', async () => {
    const T = await load();
    await ready(<T label="x" camera={cam({ y: 9, zoom: 50 })} />);
    const before = visible().drawImage.mock.calls.length;
    flushRaf(3);
    expect(visible().drawImage.mock.calls.length).toBe(before);
  });
});

describe('AnatomyTurntable · interaction', () => {
  it('dragging spins the figure proportionally (1.3 deg per px, opposite to the drag)', async () => {
    const T = await load();
    await ready(<T label="x" camera={cam()} />);
    fireEvent.pointerDown(stage(), { clientX: 200, pointerId: 1 });
    expect(Element.prototype.setPointerCapture).toHaveBeenCalledWith(1);
    fireEvent.pointerMove(stage(), { clientX: 100, pointerId: 1 }); // 100px left
    flushRaf(2);
    expect(lastPaintedDeg()).toBe(130); // 0 - (100-200)*1.3
    fireEvent.pointerMove(stage(), { clientX: 300, pointerId: 1 });
    flushRaf(2);
    expect(lastPaintedDeg()).toBe(230); // 0 - 100*1.3 = -130, wrapped into 0..360
  });

  it('stops following the pointer after release or cancel', async () => {
    const T = await load();
    await ready(<T label="x" camera={cam()} />);
    fireEvent.pointerDown(stage(), { clientX: 200, pointerId: 1 });
    fireEvent.pointerUp(stage(), { pointerId: 1 });
    const n = rafQueue.length;
    fireEvent.pointerMove(stage(), { clientX: 0, pointerId: 1 });
    expect(rafQueue.length).toBe(n);
    fireEvent.pointerDown(stage(), { clientX: 200, pointerId: 1 });
    fireEvent.pointerCancel(stage(), { pointerId: 1 });
    fireEvent.pointerMove(stage(), { clientX: 0, pointerId: 1 });
    expect(rafQueue.length).toBe(n);
  });

  it('a pointer move without a press does nothing', async () => {
    const T = await load();
    await ready(<T label="x" camera={cam()} />);
    fireEvent.pointerMove(stage(), { clientX: 10 });
    expect(rafQueue).toHaveLength(0);
  });

  it('arrow keys step the figure by 15 degrees', async () => {
    const T = await load();
    await ready(<T label="x" camera={cam()} />);
    fireEvent.keyDown(stage(), { key: 'ArrowRight' });
    flushRaf(2);
    expect(lastPaintedDeg()).toBe(15);
    fireEvent.keyDown(stage(), { key: 'ArrowLeft' });
    fireEvent.keyDown(stage(), { key: 'ArrowLeft' });
    flushRaf(2);
    expect(lastPaintedDeg()).toBe(345);
  });

  it('is inert when not rotatable', async () => {
    const T = await load();
    await ready(<T label="x" camera={cam()} rotatable={false} />);
    fireEvent.pointerDown(stage(), { clientX: 200, pointerId: 1 });
    fireEvent.pointerMove(stage(), { clientX: 100, pointerId: 1 });
    fireEvent.keyDown(stage(), { key: 'ArrowRight' });
    expect(rafQueue).toHaveLength(0);
    expect(lastPaintedDeg()).toBe(0);
  });
});

describe('AnatomyTurntable · layers', () => {
  const composed = () =>
    [...ctxs.entries()].filter(([cv]) => !cv.classList.contains('uiturn-canvas')).map(([, c]) => c);

  it('tints organs with their resting colour, and brightens + glows the active ones', async () => {
    const T = await load();
    await ready(
      <T label="x" camera={cam()} organs={['heart', 'lungs']} activeOrgans={['heart']} />,
    );
    const fills = composed().flatMap((c) => c.fills);
    expect(fills).toContain('#ff3b3b'); // heart, bright
    expect(fills).toContain('#6db7e6'); // lungs, resting
    expect(fills).not.toContain('#d9534f');
    const blurs = composed().flatMap((c) => c.blurs);
    expect(blurs).toContain(16);
    expect(blurs).toContain(6);
  });

  it('draws all organs at full strength when none is active', async () => {
    const T = await load();
    await ready(<T label="x" camera={cam()} organs={['liver']} />);
    const fills = composed().flatMap((c) => c.fills);
    expect(fills).toContain('#b5653a');
    expect(composed().flatMap((c) => c.alphas)).toContain(0.9);
  });

  it('dims inactive organs when another is selected', async () => {
    const T = await load();
    await ready(
      <T label="x" camera={cam()} organs={['liver', 'heart']} activeOrgans={['heart']} />,
    );
    expect(composed().flatMap((c) => c.alphas)).toContain(0.28);
  });

  it('tints marks with the tone colour (fallback blue when the token is unset) and a soft glow', async () => {
    const T = await load();
    await ready(
      <T
        label="x"
        camera={cam()}
        marks={[{ layer: 'm_core', tone: 'danger' }, { layer: 'm_back' }]}
      />,
    );
    const fills = composed().flatMap((c) => c.fills);
    expect(fills).toContain('#3a55b5');
    expect(composed().flatMap((c) => c.blurs)).toContain(4);
  });

  it('uses the base alphas: bones alone stronger than under muscles', async () => {
    const T = await load();
    await ready(<T label="x" camera={cam()} />);
    expect(composed().flatMap((c) => c.alphas)).toContain(0.42);
    cleanup();
    ctxs.clear();
    const T2 = await load();
    await ready(<T2 label="x" camera={cam()} base="muscles" />);
    const alphas = composed().flatMap((c) => c.alphas);
    expect(alphas).toContain(0.6);
    expect(alphas).toContain(0.22);
  });

  it('rebuilds frames when the layer set changes, keeping the old ones until replaced', async () => {
    const T = await load();
    const { rerender } = await ready(<T label="x" camera={cam()} />);
    const before = (createImageBitmap as unknown as { mock: { calls: unknown[] } }).mock.calls
      .length;
    rerender(<T label="x" camera={cam()} organs={['heart']} />);
    await waitFor(() =>
      expect(
        (createImageBitmap as unknown as { mock: { calls: unknown[] } }).mock.calls.length,
      ).toBeGreaterThan(before),
    );
    // replaced bitmaps are released
    await waitFor(() => expect(closed).toHaveBeenCalled());
  });

  it('does not build anything without createImageBitmap, but still renders', () => {
    vi.stubGlobal('createImageBitmap', undefined);
    const spy = vi.fn();
    vi.stubGlobal(
      'Image',
      class {
        constructor() {
          spy();
        }
      },
    );
    return load().then((T) => {
      render(<T label="plain" camera={cam()} />);
      expect(screen.getByRole('img', { name: 'plain' })).toBeTruthy();
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
