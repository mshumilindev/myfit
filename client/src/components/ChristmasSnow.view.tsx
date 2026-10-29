import { useEffect, useRef } from 'react';
import './ChristmasSnow.css';
import { SNOW_STEP, SnowSim, snowLayout } from './christmasSnow.sim';

const DPR_CAP = 1.5;
/** After the next app is shown the snow keeps blowing across it; it is cut off at this age at the latest. */
const EXIT_MAX_S = 3.4;
const FRAME_BUDGET_MS = 26;

type Sprites = { disc: HTMLCanvasElement; cry: HTMLCanvasElement };

function makeSprites(): Sprites {
  const mk = (n: number, fn: (g: CanvasRenderingContext2D, n: number) => void) => {
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const g = c.getContext('2d');
    if (g) fn(g, n);
    return c;
  };
  const disc = mk(64, (g, n) => {
    const r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.45, 'rgba(250,253,252,.9)');
    r.addColorStop(1, 'rgba(246,251,250,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, n, n);
  });
  const cry = mk(64, (g, n) => {
    g.translate(n / 2, n / 2);
    g.strokeStyle = 'rgba(255,255,255,.95)';
    g.lineWidth = 2.4;
    g.lineCap = 'round';
    for (let a = 0; a < 6; a++) {
      g.save();
      g.rotate((a * Math.PI) / 3);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, -28);
      g.moveTo(0, -16);
      g.lineTo(-7, -22);
      g.moveTo(0, -16);
      g.lineTo(7, -22);
      g.stroke();
      g.restore();
    }
    const r = g.createRadialGradient(0, 0, 0, 0, 0, 12);
    r.addColorStop(0, 'rgba(255,255,255,.7)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(-14, -14, 28, 28);
  });
  return { disc, cry };
}

function draw(ctx: CanvasRenderingContext2D, W: number, H: number, sim: SnowSim, S: Sprites) {
  ctx.clearRect(0, 0, W, H);
  sim.forEachVisible((x, y, r, a, ang, seed) => {
    if (r < 1.6) {
      ctx.globalAlpha = (0.55 + 0.3 * seed) * a;
      ctx.fillStyle = 'rgb(246 251 250)';
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    } else if (r < 4.6) {
      ctx.globalAlpha = 0.9 * a;
      ctx.drawImage(S.disc, x - r * 1.3, y - r * 1.3, r * 2.6, r * 2.6);
    } else {
      ctx.globalAlpha = 0.9 * a;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.drawImage(S.cry, -r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
      ctx.restore();
    }
  });
  ctx.globalAlpha = 1;
}

/** Default export so it can be lazy-loaded. Draws only between the first `out` and the last flake leaving the screen. */
export default function ChristmasSnowView() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const root = document.documentElement;
    let sprites: Sprites | null = null;
    let sim: SnowSim | null = null;
    let raf = 0;
    let last = 0;
    let acc = 0;
    let slow = 0;
    let W = 0;
    let H = 0;

    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      sim = null;
      cv.dataset.live = 'false';
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
    };
    const tick = (now: number) => {
      if (!sim) return;
      const dtMs = last ? now - last : 16;
      last = now;
      acc = Math.min(acc + dtMs / 1000, 0.1);
      while (acc >= SNOW_STEP) {
        sim.step(SNOW_STEP);
        acc -= SNOW_STEP;
      }
      // Frames running long: thin the storm (it only changes how many new flakes appear).
      slow = dtMs > FRAME_BUDGET_MS ? slow + 1 : Math.max(0, slow - 1);
      if (slow > 12 && sim.count > 0.35) {
        sim.count *= 0.85;
        slow = 0;
      }
      draw(ctx, W, H, sim, sprites!);
      if (sim.done || (sim.exiting && sim.exitTime > EXIT_MAX_S)) {
        stop();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    const begin = () => {
      stop();
      W = window.innerWidth;
      H = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sprites ??= makeSprites();
      const lay = snowLayout(W, H);
      const lite = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
        ?.saveData;
      const weak = (navigator.hardwareConcurrency ?? 8) <= 4;
      sim = new SnowSim(W, H, {
        focal: lay.focal,
        size: lay.size,
        count: lay.count * (lite ? 0.35 : weak ? 0.6 : 1),
      });
      last = 0;
      acc = 0;
      slow = 0;
      cv.dataset.live = 'true';
      raf = requestAnimationFrame(tick);
    };
    const onPhase = () => {
      const phase = root.dataset.glitch;
      if (phase === 'out') begin();
      else if (phase === 'in' || phase === undefined) sim?.exit();
    };
    const mo = new MutationObserver(onPhase);
    mo.observe(root, { attributes: true, attributeFilter: ['data-glitch'] });
    return () => {
      mo.disconnect();
      stop();
    };
  }, []);
  return (
    <canvas
      ref={ref}
      className="xs-snow"
      data-live="false"
      data-testid="christmas-snow"
      aria-hidden="true"
    />
  );
}
