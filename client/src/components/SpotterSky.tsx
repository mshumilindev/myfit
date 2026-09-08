/**
 * Spotter Sky — the night-mode background: a living Milky Way.
 *
 * Rendering follows the Sleep design board: the galaxy is a DENSE field of tiny,
 * faint stars concentrated on a tilted band (brightness comes from density, not
 * a gradient), a soft off-centre core bulge, dark dust lanes, a sparse field of
 * stars over the rest of the sky, then a capped set of brighter twinkling stars
 * and the occasional shooting star on top. Stars are sub-pixel to ~1.6px — never
 * large blobs. Colours are the design's cool/warm whites, never saturated.
 *
 * Our one adaptation "under the design": the galaxy's richness grows gently with
 * how much you've logged (workouts + activities + nights) — a new sky is a touch
 * sparser and fills in over time — but the look never changes.
 *
 * Performance: the whole static galaxy is painted ONCE to an offscreen bitmap
 * (redrawn only on resize or a richness change); each frame just blits it and
 * draws the small animated layer. rAF is frame-capped, paused when the tab is
 * hidden, DPR is capped at 2, and prefers-reduced-motion renders static only.
 */
import { useEffect, useRef } from 'react';
import { useStore } from '../store';

const BAND_HUES = ['#ffffff', '#f2f6ff', '#fff4e6', '#dbe6ff', '#ffe6cc', '#cdd8ff'];
const BRIGHT_HUES = ['#ffffff', '#eaf0ff', '#fff3e2', '#d6e2ff'];

/** Deterministic LCG (matches the design board's generator). */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

interface Bright {
  x: number;
  y: number;
  r: number;
  base: number;
  ph: number;
  sp: number;
  hue: string;
  big: boolean;
}
interface Shoot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
}

export function SpotterSky() {
  const store = useStore();
  const richness = (() => {
    const total =
      (store.workouts?.length ?? 0) +
      (store.activities?.length ?? 0) +
      (store.sleeps?.filter((n) => n.wake !== null).length ?? 0);
    return Math.max(0.55, Math.min(1, 0.55 + Math.log10(1 + total) * 0.22));
  })();
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    let W = 0;
    let H = 0;
    let off: HTMLCanvasElement | null = null;
    let bright: Bright[] = [];
    let shoot: Shoot | null = null;
    let nextShoot = 1400 + Math.random() * 4200;
    let raf = 0;
    let last = 0;

    const gauss = (r: () => number, n = 4) => {
      let g = 0;
      for (let i = 0; i < n; i++) g += r();
      return (g / n - 0.5) * 2;
    };

    function paintStatic(octx: CanvasRenderingContext2D) {
      const r = rng(1000);
      octx.clearRect(0, 0, W, H);
      // Deep sky wash.
      const g = octx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0b1024');
      g.addColorStop(0.5, '#080b18');
      g.addColorStop(1, '#05070e');
      octx.fillStyle = g;
      octx.fillRect(0, 0, W, H);

      const cx = W * 0.5;
      const cy = H * 0.32;
      const ang = -0.42;
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      const len = Math.hypot(W, H) * 1.25;
      const spread = H * 0.12;
      const px = (t: number, perp: number) => ({
        x: cx + cos * t - sin * perp,
        y: cy + sin * t + cos * perp,
      });
      const star = (x: number, y: number, rr: number, a: number, hue: string) => {
        if (x < -4 || x > W + 4 || y < -4 || y > H + 4) return;
        octx.globalAlpha = a < 0 ? 0 : a > 1 ? 1 : a;
        octx.fillStyle = hue;
        octx.beginPath();
        octx.arc(x, y, rr, 0, 7);
        octx.fill();
      };

      // Soft galactic-core bulge, offset along the band (never a full stripe).
      const coreT = -len * 0.1;
      const cp = px(coreT, 0);
      const cg = octx.createRadialGradient(cp.x, cp.y, 0, cp.x, cp.y, 150);
      cg.addColorStop(0, 'rgba(242,236,222,0.10)');
      cg.addColorStop(0.5, 'rgba(210,208,226,0.045)');
      cg.addColorStop(1, 'rgba(200,208,235,0)');
      octx.fillStyle = cg;
      octx.beginPath();
      octx.arc(cp.x, cp.y, 150, 0, 7);
      octx.fill();

      // The Milky Way: a dense field of faint stars on the band.
      const nBand = Math.round(((W * H) / 95) * richness);
      for (let k = 0; k < nBand; k++) {
        const t = (r() - 0.5) * len;
        const perp = gauss(r) * spread * (r() < 0.14 ? 2.3 : 1);
        const p = px(t, perp);
        const near = 1 - Math.min(1, Math.abs(perp) / spread);
        const coreBoost = Math.max(0, 1 - Math.abs(t - coreT) / (len * 0.28));
        const rr = r() * 0.55 + 0.13 + (r() < 0.028 ? 0.8 : 0);
        star(
          p.x,
          p.y,
          rr,
          (0.07 + r() * 0.4) * (0.38 + near * 0.62) + coreBoost * 0.14 * r(),
          BAND_HUES[(r() * BAND_HUES.length) | 0],
        );
      }
      // Extra stars packed into the bright core bulge.
      const nCore = Math.round((W * H) / 300);
      for (let k = 0; k < nCore; k++) {
        const p = px(coreT + gauss(r) * len * 0.12, gauss(r) * spread * 0.55);
        star(
          p.x,
          p.y,
          r() * 0.55 + 0.18,
          0.13 + r() * 0.5,
          BAND_HUES[(r() * BAND_HUES.length) | 0],
        );
      }
      // Sparse field stars over the rest of the sky.
      const nField = Math.round(((W * H) / 1000) * richness);
      for (let k = 0; k < nField; k++)
        star(
          r() * W,
          r() * H,
          r() * 0.7 + 0.14,
          0.06 + r() * 0.32,
          BAND_HUES[(r() * BAND_HUES.length) | 0],
        );

      // Dark dust lanes carving structure through the band.
      octx.save();
      octx.translate(cx, cy);
      octx.rotate(ang);
      for (let k = 0; k < 8; k++) {
        const gx = coreT + (r() - 0.5) * len * 0.55;
        const o = (r() - 0.5) * spread * 1.2;
        const rr = 66;
        const rg = octx.createRadialGradient(gx, o, 0, gx, o, rr);
        rg.addColorStop(0, 'rgba(5,7,13,' + (0.2 + r() * 0.16).toFixed(3) + ')');
        rg.addColorStop(1, 'rgba(5,7,13,0)');
        octx.fillStyle = rg;
        octx.beginPath();
        octx.ellipse(gx, o, rr, rr * 0.32, 0, 0, 7);
        octx.fill();
      }
      octx.restore();
      octx.globalAlpha = 1;
    }

    function makeBright() {
      const n = Math.min(240, Math.round(((W * H) / 2600) * richness));
      const r = rng(2000);
      const cx = W * 0.5;
      const cy = H * 0.32;
      const ang = -0.4;
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      const len = Math.hypot(W, H) * 1.2;
      const spread = H * 0.13;
      const a: Bright[] = [];
      for (let i = 0; i < n; i++) {
        let x: number;
        let y: number;
        if (r() < 0.6) {
          const t = (r() - 0.5) * len;
          const perp = gauss(r, 3) * spread;
          x = cx + cos * t - sin * perp;
          y = cy + sin * t + cos * perp;
        } else {
          x = r() * W;
          y = r() * H;
        }
        a.push({
          x,
          y,
          r: r() * 1.1 + 0.55,
          base: 0.5 + r() * 0.5,
          ph: r() * 6.28,
          sp: 0.001 + r() * 0.0024,
          hue: BRIGHT_HUES[(r() * BRIGHT_HUES.length) | 0],
          big: r() > 0.9,
        });
      }
      return a;
    }

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas!.width = Math.floor(W * dpr);
      canvas!.height = Math.floor(H * dpr);
      canvas!.style.width = W + 'px';
      canvas!.style.height = H + 'px';
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      off = document.createElement('canvas');
      off.width = canvas!.width;
      off.height = canvas!.height;
      const octx = off.getContext('2d')!;
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintStatic(octx);
      bright = makeBright();
      paintFrame(performance.now()); // paint immediately (rAF is paused when hidden)
    }

    function paintFrame(now: number) {
      if (!off) return;
      ctx!.clearRect(0, 0, W, H);
      ctx!.drawImage(off, 0, 0, W, H);
      if (reduced) return;
      // Twinkle.
      for (const st of bright) {
        const a = st.base * (0.42 + 0.58 * (0.5 + 0.5 * Math.sin(now * st.sp + st.ph)));
        ctx!.globalAlpha = Math.max(0, Math.min(1, a));
        ctx!.fillStyle = st.hue;
        ctx!.beginPath();
        ctx!.arc(st.x, st.y, st.r, 0, 7);
        ctx!.fill();
        if (st.big) {
          const gg = ctx!.createRadialGradient(st.x, st.y, 0, st.x, st.y, st.r * 4);
          gg.addColorStop(0, st.hue);
          gg.addColorStop(1, 'rgba(255,255,255,0)');
          ctx!.globalAlpha = 0.25 * a;
          ctx!.fillStyle = gg;
          ctx!.beginPath();
          ctx!.arc(st.x, st.y, st.r * 4, 0, 7);
          ctx!.fill();
        }
      }
      ctx!.globalAlpha = 1;
      // Shooting star.
      if (!shoot && now > nextShoot) {
        const fromLeft = Math.random() > 0.5;
        shoot = {
          x: fromLeft ? -20 : W + 20,
          y: H * (0.08 + Math.random() * 0.38),
          vx: (fromLeft ? 1 : -1) * (3 + Math.random() * 2),
          vy: 1.1 + Math.random() * 0.8,
          life: 0,
          max: 60 + Math.random() * 30,
        };
      }
      if (shoot) {
        shoot.life++;
        shoot.x += shoot.vx * 2.2;
        shoot.y += shoot.vy * 2.2;
        const tx = shoot.x - shoot.vx * 9;
        const ty = shoot.y - shoot.vy * 9;
        const grad = ctx!.createLinearGradient(shoot.x, shoot.y, tx, ty);
        grad.addColorStop(0, 'rgba(255,255,255,0.9)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx!.strokeStyle = grad;
        ctx!.lineWidth = 1.6;
        ctx!.lineCap = 'round';
        ctx!.beginPath();
        ctx!.moveTo(shoot.x, shoot.y);
        ctx!.lineTo(tx, ty);
        ctx!.stroke();
        if (shoot.life > shoot.max || shoot.x < -40 || shoot.x > W + 40 || shoot.y > H + 40) {
          shoot = null;
          nextShoot = now + 2600 + Math.random() * 5200;
        }
      }
    }

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      if (now - last < 33) return; // ~30fps
      last = now;
      paintFrame(now);
    }

    resize();
    let rz: number | undefined;
    const onResize = () => {
      window.clearTimeout(rz);
      rz = window.setTimeout(resize, 150);
    };
    window.addEventListener('resize', onResize);
    const onVis = () => {
      if (!document.hidden) paintFrame(performance.now());
    };
    document.addEventListener('visibilitychange', onVis);
    if (!reduced) raf = requestAnimationFrame(frame);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVis);
      window.clearTimeout(rz);
    };
  }, [richness]);

  return <canvas ref={ref} className="spotter-sky" aria-hidden="true" />;
}
