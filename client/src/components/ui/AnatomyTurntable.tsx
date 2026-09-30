import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { TURN_FRAMES, TURN_STEP, file, type AnatomyMapProps } from './AnatomyMap';
import './AnatomyTurntable.css';

/**
 * The body on a turntable, drawn on ONE canvas. Every frame (all layers composed, tinted marks
 * included) is built ahead of time as a bitmap, so spinning only blits a finished picture: no
 * layer can ever lag behind another and nothing flickers. While a frame is still being built the
 * nearest finished one stays on screen. The view also pans/zooms (`camera.y`, `camera.zoom`) so a
 * picked area can be brought close; zoom 1 is the whole body.
 */
export interface TurnCamera {
  /** Turntable angle in degrees (0 front, 90 the person's left, 180 back). */
  yaw: number;
  /** Vertical centre of interest as a fraction of the figure's canvas (0 top … 1 bottom). */
  y: number;
  /** 1 = the whole body; larger zooms in. */
  zoom: number;
  /** Bump to re-run the move even when the numbers are unchanged. */
  n: number;
}

type Props = Pick<AnatomyMapProps, 'base' | 'organs' | 'marks' | 'label'> & {
  camera: TurnCamera;
  /** Short "drag to rotate" caption. */
  hint?: string;
  /** What the picture shows, under it (e.g. the selected area). */
  caption?: string;
  /** Organs to emphasise (full colour + glow); the rest step back. None = all equal. */
  activeOrgans?: string[];
  /** Drag / arrow keys spin the figure (default). Off for views that only face front. */
  rotatable?: boolean;
};

// Frames are 320×700 renders of the 640×1400 layer canvas; the whole body is this window of it.
const W = 320;
const H = 700;
const FULL = { x0: 0.08, x1: 0.92, y0: 0.02, y1: 0.99 };
const FULL_H = (FULL.y1 - FULL.y0) * H;

const wrap = (deg: number) => ((deg % 360) + 360) % 360;

/**
 * Square window onto the frame: side = the figure's height / zoom, centred on `y`. At zoom 1 the
 * whole body sits in the square with margins; zoomed in, the window can reach past the frame
 * edge, so it is returned unclamped and `draw` clips it.
 */
function viewRect(y: number, zoom: number): [number, number, number, number] {
  const side = FULL_H / zoom;
  return [W / 2 - side / 2, y * H - side / 2, side, side];
}

/** The same colours turned up for the selected organ: clearly brighter than the resting tone. */
const ORGAN_BRIGHT: Record<string, string> = {
  heart: '#ff3b3b',
  lungs: '#3fb8ff',
  liver: '#ff8a2b',
  kidneys: '#d457ff',
  stomach: '#ff6f4a',
  intestines: '#ffbd45',
  brain: '#ff8fdc',
  spinalcord: '#ffe640',
};

/** Anatomical colour coding for organs (muted to sit on the dark glass). */
const ORGAN_COLOUR: Record<string, string> = {
  heart: '#d9534f',
  lungs: '#6db7e6',
  liver: '#b5653a',
  kidneys: '#9b5675',
  stomach: '#e58a6a',
  intestines: '#e2b27a',
  brain: '#d7a3c7',
  spinalcord: '#e8d27a',
};

interface Spec {
  layer: string;
  alpha: number;
  tint?: string;
  /** Organ colour (drawn over the shaded render). */
  organ?: string;
  /** Soft glow in the organ's own colour (the selected organ). */
  glow?: boolean;
}

const images = new Map<string, Promise<HTMLImageElement>>();
/** Decoded layer pictures are shared between selections, so switching area only recomposes. */
const load = (src: string) => {
  let hit = images.get(src);
  if (!hit) {
    hit = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => {
        images.delete(src);
        reject(new Error(src));
      };
      img.src = src;
    });
    images.set(src, hit);
  }
  return hit;
};

export function AnatomyTurntable({
  base = 'bones',
  organs = [],
  marks = [],
  label,
  hint,
  caption,
  camera,
  activeOrgans = [],
  rotatable = true,
}: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const frames = useRef(new Map<number, ImageBitmap>());
  // Which layer set each frame was built for; a stale frame is shown only until a current one exists.
  const tags = useRef(new Map<number, string>());
  const current = useRef('');
  const angle = useRef(camera.yaw);
  const view = useRef({ y: camera.y, zoom: camera.zoom });
  const raf = useRef(0);
  const anim = useRef(0);
  const drag = useRef<{ x: number; from: number } | null>(null);

  const draw = () => {
    const cv = canvas.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.max(1, Math.round(cv.clientWidth * dpr));
    const ch = Math.max(1, Math.round(cv.clientHeight * dpr));
    if (cv.width !== cw || cv.height !== ch) {
      cv.width = cw;
      cv.height = ch;
    }
    // Nearest finished frame (circular) so a frame still being built never shows as a gap.
    const want = wrap(Math.round(angle.current / TURN_STEP) * TURN_STEP);
    const pick = (fresh: boolean) => {
      for (let k = 0; k <= TURN_FRAMES / 2; k++) {
        for (const d of [wrap(want + k * TURN_STEP), wrap(want - k * TURN_STEP)]) {
          const f = frames.current.get(d);
          if (f && (!fresh || tags.current.get(d) === current.current)) return f;
        }
      }
      return null;
    };
    // Prefer the nearest frame of the CURRENT selection; an old selection's frame only stands in
    // until the first current one is built (so switching never blanks the map, nor shows a wrong area).
    const best = pick(true) ?? pick(false);
    ctx.clearRect(0, 0, cw, ch);
    if (!best) return;
    const [sx, sy, sw, sh] = viewRect(view.current.y, view.current.zoom);
    // Clip the square to the frame; what falls outside stays empty.
    const x0 = Math.max(0, sx);
    const y0 = Math.max(0, sy);
    const x1 = Math.min(W, sx + sw);
    const y1 = Math.min(H, sy + sh);
    if (x1 <= x0 || y1 <= y0) return;
    const k = cw / sw;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      best,
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
  const requestDraw = () => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      draw();
    });
  };

  // Build every frame of this layer set, nearest the current angle first.
  const specs: Spec[] = [
    ...(base === 'muscles' ? [{ layer: 'muscles', alpha: 0.6 }] : []),
    { layer: 'bones', alpha: base === 'muscles' ? 0.22 : 0.42 },
    ...organs.map((o) => ({
      layer: o as string,
      alpha: activeOrgans.length === 0 ? 0.9 : activeOrgans.includes(o) ? 1 : 0.28,
      organ: activeOrgans.includes(o) ? ORGAN_BRIGHT[o] : ORGAN_COLOUR[o],
      glow: activeOrgans.includes(o),
    })),
    ...marks.map((m) => ({ layer: m.layer as string, alpha: 1, tint: m.tone ?? 'chronic' })),
  ];
  const key = JSON.stringify(specs);

  useEffect(() => {
    if (typeof createImageBitmap === 'undefined') return; // no canvas pipeline (tests, very old browsers)
    let alive = true;
    current.current = key;
    const list = JSON.parse(key) as Spec[];
    const css = getComputedStyle(stage.current ?? document.body);
    const colour = (tone: string) =>
      css.getPropertyValue(`--color-${tone}-deep`).trim() ||
      css.getPropertyValue(`--color-${tone}`).trim() ||
      '#3a55b5';
    const bitmaps = frames.current;
    const missing = new Set<number>();
    for (let k = 0; k < TURN_FRAMES; k++) missing.add(k * TURN_STEP);
    // Always build the missing frame nearest to where the figure is NOW (it may be mid-spin).
    const takeNearest = () => {
      let best = -1;
      let dist = Infinity;
      for (const d of missing) {
        const gap = Math.min(wrap(d - angle.current), wrap(angle.current - d));
        if (gap < dist) {
          dist = gap;
          best = d;
        }
      }
      if (best >= 0) missing.delete(best);
      return best;
    };

    const compose = async (deg: number) => {
      const imgs = await Promise.all(
        list.map((s) => load(new URL(file(s.layer, deg), document.baseURI).href)),
      );
      const out = document.createElement('canvas');
      out.width = W;
      out.height = H;
      const ctx = out.getContext('2d');
      if (!ctx) return null;
      const tmp = document.createElement('canvas');
      tmp.width = W;
      tmp.height = H;
      const tctx = tmp.getContext('2d');
      list.forEach((s, i) => {
        if (s.organ && tctx) {
          // Colour-code the organ: tint the shaded render, keeping its shading.
          tctx.globalCompositeOperation = 'source-over';
          tctx.clearRect(0, 0, W, H);
          tctx.drawImage(imgs[i], 0, 0, W, H);
          tctx.globalCompositeOperation = 'source-atop';
          tctx.globalAlpha = s.glow ? 0.95 : 0.72;
          tctx.fillStyle = s.organ;
          tctx.fillRect(0, 0, W, H);
          tctx.globalAlpha = 1;
          ctx.globalAlpha = s.alpha;
          if (s.glow) {
            // Two passes: a wide halo, then the organ itself, for a clearly lit look.
            ctx.shadowColor = s.organ;
            ctx.shadowBlur = 16;
            ctx.drawImage(tmp, 0, 0);
            ctx.shadowBlur = 6;
          }
          ctx.drawImage(tmp, 0, 0);
          ctx.shadowBlur = 0;
          return;
        }
        if (!s.tint || !tctx) {
          ctx.globalAlpha = s.alpha;
          ctx.drawImage(imgs[i], 0, 0, W, H);
          return;
        }
        // Mask layers are white alpha shapes: tint them, with a soft glow.
        tctx.globalCompositeOperation = 'source-over';
        tctx.clearRect(0, 0, W, H);
        tctx.drawImage(imgs[i], 0, 0, W, H);
        tctx.globalCompositeOperation = 'source-in';
        tctx.fillStyle = colour(s.tint);
        tctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = s.alpha;
        ctx.shadowColor = colour(s.tint);
        ctx.shadowBlur = 4;
        ctx.drawImage(tmp, 0, 0);
        ctx.shadowBlur = 0;
      });
      ctx.globalAlpha = 1;
      return createImageBitmap(out);
    };

    const worker = async () => {
      while (alive && missing.size > 0) {
        const deg = takeNearest();
        try {
          const bmp = await compose(deg);
          if (!alive) {
            bmp?.close();
            return;
          }
          if (bmp) {
            bitmaps.get(deg)?.close();
            bitmaps.set(deg, bmp);
            tags.current.set(deg, key);
          }
          requestDraw();
        } catch {
          /* a frame that fails to load is skipped; its neighbour stands in */
        }
      }
    };
    void Promise.all([worker(), worker(), worker()]);
    // Old frames stay on screen until each is replaced, so switching area never blanks the map.
    return () => {
      alive = false;
    };
    // `requestDraw` only touches refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const map = frames.current;
    const tagMap = tags.current;
    return () => {
      for (const b of map.values()) b.close();
      map.clear();
      tagMap.clear();
    };
  }, []);

  // Move the camera (spin the short way round, pan, zoom) whenever a new move is asked for.
  useEffect(() => {
    cancelAnimationFrame(anim.current);
    const from = { a: angle.current, y: view.current.y, z: view.current.zoom };
    const dA = ((((camera.yaw - from.a) % 360) + 540) % 360) - 180;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const dur = reduce ? 0 : 450 + Math.abs(dA) * 2 + Math.abs(camera.zoom - from.z) * 250;
    let t0 = 0;
    const tick = (now: number) => {
      t0 ||= now;
      const k = dur === 0 ? 1 : Math.min(1, (now - t0) / dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; // ease in-out
      angle.current = from.a + dA * e;
      view.current = {
        y: from.y + (camera.y - from.y) * e,
        zoom: from.z + (camera.zoom - from.z) * e,
      };
      draw();
      if (k < 1) anim.current = requestAnimationFrame(tick);
    };
    anim.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(anim.current);
  }, [camera]);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(requestDraw);
    ro.observe(cv);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!rotatable) return;
    cancelAnimationFrame(anim.current);
    drag.current = { x: e.clientX, from: angle.current };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    angle.current = drag.current.from - (e.clientX - drag.current.x) * 1.3;
    requestDraw();
  };
  const onUp = () => {
    drag.current = null;
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!rotatable || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    angle.current += e.key === 'ArrowLeft' ? -TURN_STEP * 3 : TURN_STEP * 3;
    requestDraw();
  };

  return (
    <div className="uiturn">
      <div
        ref={stage}
        className={`uiturn-stage${rotatable ? ' rot' : ''}`}
        tabIndex={rotatable ? 0 : -1}
        role="img"
        aria-label={label}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
      >
        <canvas ref={canvas} className="uiturn-canvas" />
      </div>
      {caption && <span className="uiturn-caption">{caption}</span>}
      {rotatable && hint && <span className="uiturn-hint">{hint}</span>}
    </div>
  );
}
