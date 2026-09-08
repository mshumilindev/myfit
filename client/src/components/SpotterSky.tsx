/**
 * Spotter Sky — the night-mode background. A star journal built from every
 * logged workout & activity: size ∝ dose, colour ∝ type (lift = brass,
 * cardio = lazurite, recovery = cyan), brightness/size decay with age so the
 * oldest sink into the Milky Way while the newest shine on top.
 *
 * Performance by design: a procedural galaxy band + dust and all but the newest
 * log-stars render ONCE to an offscreen bitmap (redrawn only on data/size
 * change); only a device-capped set of recent stars animate per frame. Paused
 * when hidden; static under prefers-reduced-motion.
 */
import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { moonInfo } from '../moon';

type Kind = 'lift' | 'cardio' | 'recovery';
interface LogStar {
  at: number;
  dose: number; // 0..1 normalised
  kind: Kind;
  id: string;
}

const COLOR: Record<Kind, [number, number, number]> = {
  lift: [230, 190, 120],
  cardio: [120, 170, 225],
  recovery: [130, 205, 210],
};

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function collectLogs(
  workouts: ReturnType<typeof useStore>['workouts'],
  activities: ReturnType<typeof useStore>['activities'],
): LogStar[] {
  const out: LogStar[] = [];
  let maxVol = 1;
  const vols: number[] = [];
  for (const w of workouts) {
    if (w.finishedAt == null) continue;
    let sets = 0;
    for (const e of w.exercises) sets += e.sets.length;
    vols.push(sets);
    maxVol = Math.max(maxVol, sets);
  }
  let i = 0;
  for (const w of workouts) {
    if (w.finishedAt == null) continue;
    out.push({
      at: w.startedAt,
      dose: Math.min(1, (vols[i++] || 4) / Math.max(8, maxVol)),
      kind: 'lift',
      id: w.id,
    });
  }
  for (const a of activities) {
    if (a.finishedAt == null) continue;
    out.push({
      at: a.startedAt,
      dose: Math.min(1, (a.durationMin || 15) / 90),
      kind: a.category === 'recovery' ? 'recovery' : 'cardio',
      id: a.id,
    });
  }
  return out.sort((x, y) => y.at - x.at); // newest first
}

export function SpotterSky() {
  const store = useStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const workouts = store.workouts;
  const activities = store.activities;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cores = (navigator.hardwareConcurrency as number) || 4;
    const FG_CAP = reduced ? 0 : Math.max(24, Math.min(90, cores * 12));
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    let lat = 50;
    try {
      const p = JSON.parse(localStorage.getItem('spotter.lastPos') || 'null');
      if (p && typeof p.lat === 'number') lat = p.lat;
    } catch {
      /* ignore */
    }
    const moon = moonInfo(new Date(), lat);

    const logs = collectLogs(workouts, activities);
    const now = Date.now();
    const DAY = 86400000;
    // Age → size/brightness. Newest stars ride the foreground; older shrink and
    // bake into the static bitmap; the oldest become dust.
    const fg = logs.slice(0, FG_CAP);
    const bg = logs.slice(FG_CAP);

    let W = 0;
    let H = 0;
    let off: HTMLCanvasElement | null = null;

    function ageScale(at: number): number {
      const days = (now - at) / DAY;
      return Math.max(0.3, 1.35 - days / 130);
    }
    function starRadius(s: LogStar): number {
      return (0.8 + s.dose * 2.4) * ageScale(s.at);
    }

    function buildStatic() {
      off = document.createElement('canvas');
      off.width = Math.max(1, Math.floor(W * dpr));
      off.height = Math.max(1, Math.floor(H * dpr));
      const o = off.getContext('2d');
      if (!o) return;
      o.scale(dpr, dpr);
      // Deep ground gradient.
      const g = o.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#0b0f1e');
      g.addColorStop(0.62, '#0a0d18');
      g.addColorStop(1, '#080a14');
      o.fillStyle = g;
      o.fillRect(0, 0, W, H);
      // Milky Way band — a soft diagonal wash with a brighter core.
      o.save();
      o.translate(W * 0.5, H * 0.42);
      o.rotate(-0.5);
      const band = o.createLinearGradient(0, -H * 0.5, 0, H * 0.5);
      band.addColorStop(0, 'rgba(90,110,180,0)');
      band.addColorStop(0.5, 'rgba(150,170,230,0.10)');
      band.addColorStop(1, 'rgba(90,110,180,0)');
      o.fillStyle = band;
      o.fillRect(-W, -H * 0.5, W * 2, H);
      o.restore();
      // Procedural dust — many tiny static stars, denser along the band.
      const rnd = mulberry32(0x51ee9);
      const dust = Math.floor(Math.min(720, (W * H) / 1600));
      for (let i = 0; i < dust; i++) {
        const x = rnd() * W;
        const bandY = H * 0.42 + (x - W * 0.5) * -0.55;
        const spread = H * (0.1 + rnd() * 0.9);
        const y = bandY + (rnd() - 0.5) * spread;
        if (y < 0 || y > H) continue;
        const near = 1 - Math.min(1, Math.abs(y - bandY) / (H * 0.32));
        const r = 0.3 + rnd() * (0.5 + near * 0.9);
        o.globalAlpha = 0.18 + rnd() * 0.4 * (0.5 + near * 0.7);
        o.fillStyle = rnd() > 0.85 ? '#cfe0ff' : '#aab8e6';
        o.beginPath();
        o.arc(x, y, r, 0, 6.283);
        o.fill();
      }
      o.globalAlpha = 1;
      // Older log-stars, baked in (coloured, sized by dose+age).
      for (const s of bg) {
        const r = mulberry32(hash(s.id));
        const x = r() * W;
        const y = r() * H;
        const [cr, cg, cb] = COLOR[s.kind];
        const rad = starRadius(s);
        o.globalAlpha = Math.max(0.2, 0.75 * ageScale(s.at));
        const grd = o.createRadialGradient(x, y, 0, x, y, rad * 3);
        grd.addColorStop(0, `rgb(${cr},${cg},${cb})`);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        o.fillStyle = grd;
        o.beginPath();
        o.arc(x, y, rad * 3, 0, 6.283);
        o.fill();
      }
      o.globalAlpha = 1;
      drawMoon(o);
    }

    function drawMoon(o: CanvasRenderingContext2D) {
      const R = Math.min(W, H) * 0.09;
      const cx = W * 0.78;
      const cy = H * 0.16;
      o.save();
      // Halo.
      const halo = o.createRadialGradient(cx, cy, R * 0.5, cx, cy, R * 3);
      halo.addColorStop(0, 'rgba(195,206,244,0.22)');
      halo.addColorStop(1, 'rgba(195,206,244,0)');
      o.fillStyle = halo;
      o.beginPath();
      o.arc(cx, cy, R * 3, 0, 6.283);
      o.fill();
      // Disc (dark side).
      o.fillStyle = '#20264a';
      o.beginPath();
      o.arc(cx, cy, R, 0, 6.283);
      o.fill();
      // Lit fraction via a terminator ellipse.
      const illum = moon.illum;
      o.save();
      o.beginPath();
      o.arc(cx, cy, R, 0, 6.283);
      o.clip();
      o.fillStyle = '#c3cef4';
      const k = (illum - 0.5) * 2; // -1..1
      o.beginPath();
      const dir = moon.litOnRight ? 1 : -1;
      // Lit half.
      o.ellipse(cx, cy, R, R, 0, -Math.PI / 2, Math.PI / 2, dir < 0);
      // Terminator.
      o.ellipse(
        cx,
        cy,
        R * Math.abs(k),
        R,
        0,
        Math.PI / 2,
        -Math.PI / 2,
        illum > 0.5 ? dir < 0 : dir > 0,
      );
      o.fill();
      o.restore();
      o.restore();
    }

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas!.width = Math.floor(W * dpr);
      canvas!.height = Math.floor(H * dpr);
      canvas!.style.width = W + 'px';
      canvas!.style.height = H + 'px';
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildStatic();
      if (off) {
        ctx!.clearRect(0, 0, W, H);
        ctx!.drawImage(off, 0, 0, W, H);
      }
    }

    let raf = 0;
    let last = 0;
    const FRAME = 1000 / 30;
    function frame(ts: number) {
      raf = requestAnimationFrame(frame);
      if (ts - last < FRAME) return;
      last = ts;
      if (!off || document.hidden) return;
      ctx!.clearRect(0, 0, W, H);
      ctx!.drawImage(off, 0, 0, W, H);
      const t = ts / 1000;
      for (const s of fg) {
        const r = mulberry32(hash(s.id));
        const x = r() * W;
        const y = r() * H;
        const [cr, cg, cb] = COLOR[s.kind];
        const rad = starRadius(s);
        const tw = 0.7 + 0.3 * Math.sin(t * (0.6 + r() * 1.4) + r() * 6.28);
        ctx!.globalAlpha = tw;
        const grd = ctx!.createRadialGradient(x, y, 0, x, y, rad * 4);
        grd.addColorStop(0, `rgb(${cr},${cg},${cb})`);
        grd.addColorStop(0.4, `rgba(${cr},${cg},${cb},0.6)`);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx!.fillStyle = grd;
        ctx!.beginPath();
        ctx!.arc(x, y, rad * 4, 0, 6.283);
        ctx!.fill();
        ctx!.globalAlpha = Math.min(1, tw + 0.2);
        ctx!.fillStyle = '#ffffff';
        ctx!.beginPath();
        ctx!.arc(x, y, Math.max(0.6, rad * 0.5), 0, 6.283);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
    }

    resize();
    window.addEventListener('resize', resize);
    const onVis = () => {
      if (!document.hidden && off) {
        ctx!.clearRect(0, 0, W, H);
        ctx!.drawImage(off, 0, 0, W, H);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    if (!reduced && fg.length > 0) raf = requestAnimationFrame(frame);
    return () => {
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [workouts, activities]);

  return <canvas ref={canvasRef} className="spotter-sky" aria-hidden />;
}
