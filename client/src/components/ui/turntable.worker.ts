/// <reference lib="webworker" />
/**
 * Draws a self-spinning AnatomyTurntable on an OffscreenCanvas, off the main thread: whatever the page is busy with
 * (layout, SVG backgrounds, scrolling) cannot make the turn stutter. Frames arrive as transferred ImageBitmaps; the
 * angle advances by elapsed time and the two frames either side of it are cross-faded, so a 5-degree step is invisible.
 */
type Msg =
  | {
      t: 'init';
      canvas: OffscreenCanvas;
      step: number;
      spin: number;
      angle: number;
      rect: [number, number, number, number];
      w: number;
      h: number;
    }
  | { t: 'size'; w: number; h: number }
  | { t: 'f'; deg: number; bmp: ImageBitmap }
  | { t: 'ready' }
  | { t: 'vis'; v: boolean };

let cv: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
const frames = new Map<number, ImageBitmap>();
let step = 5;
let spin = 45;
let angle = 0;
let rect: [number, number, number, number] = [0, 0, 1, 1];
let W = 320;
let H = 700;
let vis = false;
let ready = false;
let last = 0;
let id = 0;

const wrap = (d: number) => ((d % 360) + 360) % 360;
const raf: (cb: (t: number) => void) => number =
  typeof requestAnimationFrame === 'function'
    ? (cb) => requestAnimationFrame(cb)
    : (cb) => setTimeout(() => cb(performance.now()), 16) as unknown as number;

const nearest = (deg: number) => {
  const want = wrap(Math.round(deg / step) * step);
  for (let k = 0; k <= 180 / step; k++) {
    for (const d of [wrap(want + k * step), wrap(want - k * step)]) {
      const f = frames.get(d);
      if (f) return f;
    }
  }
  return null;
};

const draw = () => {
  if (!cv || !ctx) return;
  const cw = cv.width;
  const ch = cv.height;
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, cw, ch);
  const [sx, sy, sw, sh] = rect;
  const x0 = Math.max(0, sx);
  const y0 = Math.max(0, sy);
  const x1 = Math.min(W, sx + sw);
  const y1 = Math.min(H, sy + sh);
  if (x1 <= x0 || y1 <= y0) return;
  const k = cw / sw;
  const blit = (img: ImageBitmap, a: number) => {
    ctx!.globalAlpha = a;
    ctx!.drawImage(
      img,
      x0,
      y0,
      x1 - x0,
      y1 - y0,
      (x0 - sx) * k,
      (y0 - sy) * k,
      (x1 - x0) * k,
      (y1 - y0) * k,
    );
  };
  const pos = angle / step;
  const fl = Math.floor(pos);
  const fa = frames.get(wrap(fl * step));
  const fb = frames.get(wrap((fl + 1) * step));
  if (ready && fa && fb) {
    const t = pos - fl;
    ctx.globalCompositeOperation = 'lighter';
    blit(fa, 1 - t);
    blit(fb, t);
    ctx.globalCompositeOperation = 'source-over';
  } else {
    const n = nearest(angle);
    if (n) blit(n, 1);
  }
  ctx.globalAlpha = 1;
};

const loop = (now: number) => {
  id = 0;
  if (!vis || !ready) {
    last = 0;
    return;
  }
  if (last) angle = wrap(angle + (spin * (now - last)) / 1000);
  last = now;
  draw();
  id = raf(loop);
};
const kick = () => {
  if (!id && vis && ready) {
    last = 0;
    id = raf(loop);
  }
};

self.onmessage = (e: MessageEvent<Msg>) => {
  const m = e.data;
  switch (m.t) {
    case 'init':
      cv = m.canvas;
      ctx = cv.getContext('2d');
      step = m.step;
      spin = m.spin;
      angle = m.angle;
      rect = m.rect;
      W = m.w;
      H = m.h;
      break;
    case 'size':
      if (cv && (cv.width !== m.w || cv.height !== m.h)) {
        cv.width = m.w;
        cv.height = m.h;
        draw();
      }
      break;
    case 'f':
      frames.get(m.deg)?.close();
      frames.set(m.deg, m.bmp);
      if (!ready) draw();
      break;
    case 'ready':
      ready = true;
      kick();
      break;
    case 'vis':
      vis = m.v;
      if (vis) kick();
      break;
  }
};

// Makes this file a module, so its top-level names (e.g. "frames") do not clash with the DOM globals.
export {};
