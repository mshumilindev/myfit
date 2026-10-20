/* eslint-disable */
// Landing design v36 (SPO-168 / SPO-169). The markup and landing-design.css are generated from the
// approved design template; only the state logic above the return is hand-written.
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactElement,
} from 'react';
import { AtlasFace } from '../../components/AtlasFace';
import { AnatomyMap, type AnatomyMark } from '../../components/ui/AnatomyMap';
import { AnatomyTurntable } from '../../components/ui/AnatomyTurntable';
import { LOCALE_IDS, fmtDayMonth, setLocale, useT, type LocaleId } from '../../i18n';
import { AuthView } from '../AuthView';
import { isAppShell } from './landingGate';
import { downloadUrl } from '../../downloads';
import './landing-design.css';

const FLAGS: Record<LocaleId, string> = { en: '🇬🇧', uk: '🇺🇦', pl: '🇵🇱', lt: '🇱🇹', et: '🇪🇪' };
const NAMES: Record<LocaleId, string> = {
  en: 'English',
  uk: 'Українська',
  pl: 'Polski',
  lt: 'Lietuvių',
  et: 'Eesti',
};

/** "--a:1;--b:2" → style object (custom properties included). */
function sv(s: unknown): CSSProperties {
  const o: Record<string, string> = {};
  String(s ?? '')
    .split(';')
    .forEach((d) => {
      const i = d.indexOf(':');
      if (i > 0) {
        const k = d.slice(0, i).trim();
        o[k.startsWith('--') ? k : k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = d
          .slice(i + 1)
          .trim();
      }
    });
  return o as CSSProperties;
}

function detectOS(): 'win' | 'mac' | 'and' | 'ios' {
  let u = '';
  let touch = 0;
  try {
    u = `${navigator.userAgent || ''} ${navigator.platform || ''}`;
    touch = navigator.maxTouchPoints || 0;
  } catch {
    /* ignore */
  }
  if (/Android/i.test(u)) return 'and';
  if (/iPhone|iPad|iPod/i.test(u)) return 'ios';
  if (/Mac/i.test(u)) return touch > 1 ? 'ios' : 'mac'; // iPadOS reports itself as a Mac
  return 'win';
}

/** Recovery colour-coding shown on the body maps: red = still recovering, amber = nearly, green = fresh. */
const RECOVERY_MARKS: AnatomyMark[] = [
  { layer: 'm_quads', tone: 'injury' },
  { layer: 'm_hams', tone: 'injury' },
  { layer: 'm_glutes', tone: 'illness' },
  { layer: 'm_core', tone: 'illness' },
  { layer: 'm_back', tone: 'illness' },
  { layer: 'm_chest', tone: 'ok' },
  { layer: 'm_shoulder', tone: 'ok' },
  { layer: 'm_arm', tone: 'ok' },
  { layer: 'm_calves', tone: 'ok' },
];

/** The spinning body's frames are composed ahead of time (scripts/bake-landing-turn.py): nothing is built in the browser. */
const BAKED_TURN = {
  url: (deg: number) => `${import.meta.env.BASE_URL ?? '/'}landing/turn/${deg}.webp`,
  step: 10,
};

/** Muscle map with a skeleton scan sweeping over it (the design's "x-ray"). */
function AnatomyXray({ label }: { label: string }) {
  return (
    <div
      className="l-xr-box"
      style={{ position: 'relative', width: 'min(420px,100%)', aspectRatio: '537.6 / 1358' }}
    >
      <div className="l-xr-glow" aria-hidden />
      {/* Luminance -> icy blue, like a radiograph film: bright bone, cold cyan cast. */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden focusable="false">
        <filter id="ld-xray" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="0.26 0.78 0.08 0 0.10  0.32 0.96 0.10 0 0.18  0.36 1.08 0.12 0 0.28  0 0 0 1 0"
          />
        </filter>
      </svg>
      <div className="l-xr-mu" style={{ position: 'absolute', inset: 0 }}>
        <AnatomyMap base="muscles" view="front" marks={RECOVERY_MARKS} label={label} />
      </div>
      <div className="l-xr-bn" style={{ position: 'absolute', inset: 0 }} aria-hidden>
        <div className="l-xr-bf" style={{ position: 'absolute', inset: 0 }}>
          <AnatomyMap base="bones" view="front" label={label} />
        </div>
      </div>
      <div
        className="l-xr-ln"
        style={{
          position: 'absolute',
          left: -30,
          right: -30,
          height: 2,
          background: '#e4bb76',
          boxShadow: '0 0 22px 6px rgba(228,187,118,.5)',
        }}
      />
    </div>
  );
}

/**
 * The Atlas screen's background: a constellation of nodes whose links carry signals. Every couple of seconds a
 * "question" lights a node near the chat card and the activation spreads hop by hop along the links - nodes flare,
 * pulses run on, a soft ring leaves the card - like a network thinking. One small canvas, paused off screen.
 */
function AtlasNet() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const reduce = false;
    const mouse = { x: -1e4, y: -1e4, on: false };
    const mv = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      mouse.x = ((e.clientX - r.left) * cv.width) / Math.max(1, r.width);
      mouse.y = ((e.clientY - r.top) * cv.height) / Math.max(1, r.height);
      mouse.on =
        e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    };
    window.addEventListener('pointermove', mv, { passive: true });
    type Node = {
      bx: number;
      by: number;
      ax: number;
      ay: number;
      ph: number;
      sp: number;
      x: number;
      y: number;
      r: number;
      glow: number;
      blue: number;
      nb: number[];
    };
    type Pulse = { a: number; b: number; t: number; len: number; hop: number };
    const nodes: Node[] = [];
    const COLS = 7;
    const ROWS = 5;
    for (let j = 0; j < ROWS; j++) {
      for (let i = 0; i < COLS; i++) {
        nodes.push({
          bx: 0.05 + (0.9 * (i + 0.5 + (Math.random() - 0.5) * 0.7)) / COLS,
          by: 0.06 + (0.88 * (j + 0.5 + (Math.random() - 0.5) * 0.7)) / ROWS,
          ax: 0.01 + Math.random() * 0.02,
          ay: 0.01 + Math.random() * 0.02,
          ph: Math.random() * 6.28,
          sp: 0.08 + Math.random() * 0.12,
          x: 0,
          y: 0,
          r: 2.2 + Math.random() * 2.6,
          glow: 0,
          blue: 0,
          nb: [],
        });
      }
    }
    let W = 0;
    let H = 0;
    let dpr = 1;
    const links: [number, number][] = [];
    const place = (time: number) => {
      for (const n of nodes) {
        n.x = (n.bx + Math.sin(time * n.sp + n.ph) * n.ax) * W;
        n.y = (n.by + Math.cos(time * n.sp * 0.9 + n.ph) * n.ay) * H;
      }
    };
    const relink = () => {
      links.length = 0;
      nodes.forEach((n) => (n.nb = []));
      place(0);
      nodes.forEach((n, i) => {
        const near = nodes
          .map((m, k) => ({ k, d: k === i ? Infinity : (m.x - n.x) ** 2 + (m.y - n.y) ** 2 }))
          .sort((p, q) => p.d - q.d)
          .slice(0, 3);
        near.forEach(({ k }) => {
          if (!n.nb.includes(k)) n.nb.push(k);
          if (!nodes[k].nb.includes(i)) nodes[k].nb.push(i);
          if (!links.some(([a, b]) => (a === i && b === k) || (a === k && b === i)))
            links.push([i, k]);
        });
      });
    };
    const size = () => {
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      W = Math.max(1, Math.round(cv.clientWidth * dpr));
      H = Math.max(1, Math.round(cv.clientHeight * dpr));
      cv.width = W;
      cv.height = H;
      relink();
    };
    size();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(size);
    ro?.observe(cv);

    const pulses: Pulse[] = [];
    const focus = { x: 0.7, y: 0.5 };
    let wave = -1;
    const near = () => {
      const c = nodes
        .map((n, i) => ({ i, d: (n.bx - focus.x) ** 2 + (n.by - focus.y) ** 2 }))
        .sort((p, q) => p.d - q.d)
        .slice(0, 5);
      return c[Math.floor(Math.random() * c.length)].i;
    };
    const fire = (i: number, from: number, hop: number) => {
      nodes[i].glow = 1;
      if (hop > 4) return;
      for (const k of nodes[i].nb) {
        if (k === from || pulses.length > 70 || Math.random() > Math.pow(0.86, hop)) continue;
        const len = Math.hypot(nodes[k].x - nodes[i].x, nodes[k].y - nodes[i].y) || 1;
        pulses.push({ a: i, b: k, t: 0, len, hop });
      }
    };
    let next = 0.6;
    let time = 0;
    let last = 0;
    let raf = 0;
    let vis = true;
    let lastCheck = 0;
    let timer = 0;
    const sec = cv.closest('section') ?? cv;
    const inView = () => {
      const b = sec.getBoundingClientRect();
      return b.bottom > 0 && b.top < window.innerHeight;
    };
    const frame = (now: number) => {
      raf = 0;
      if (now - lastCheck > 250) {
        lastCheck = now;
        vis = inView();
      }
      if (!vis) {
        last = 0;
        timer = window.setTimeout(poll, 300);
        return;
      }
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
      last = now;
      time += dt;
      place(time);
      if (time > next) {
        next = time + 1.6 + Math.random() * 1.6;
        fire(near(), -1, 0);
        wave = 0;
      }
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = dpr;
      ctx.strokeStyle = 'rgba(217,162,79,.11)';
      ctx.beginPath();
      for (const [a, b] of links) {
        ctx.moveTo(nodes[a].x, nodes[a].y);
        ctx.lineTo(nodes[b].x, nodes[b].y);
      }
      ctx.stroke();
      if (wave >= 0) {
        wave += dt / 2.6;
        if (wave > 1) wave = -1;
        else {
          ctx.strokeStyle = `rgba(241,207,146,${(0.16 * (1 - wave)).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(focus.x * W, focus.y * H, wave * Math.max(W, H) * 0.6, 0, 6.2832);
          ctx.stroke();
        }
      }
      for (let p = pulses.length - 1; p >= 0; p--) {
        const u = pulses[p];
        u.t += (dt * 420 * dpr) / u.len;
        const A = nodes[u.a];
        const B = nodes[u.b];
        if (u.t >= 1) {
          pulses.splice(p, 1);
          if (B.glow < 0.5) fire(u.b, u.a, u.hop + 1);
          continue;
        }
        const x = A.x + (B.x - A.x) * u.t;
        const y = A.y + (B.y - A.y) * u.t;
        const tail = Math.max(0, u.t - (36 * dpr) / u.len);
        const g = ctx.createLinearGradient(
          A.x + (B.x - A.x) * tail,
          A.y + (B.y - A.y) * tail,
          x,
          y,
        );
        g.addColorStop(0, 'rgba(241,207,146,0)');
        g.addColorStop(1, 'rgba(241,207,146,.85)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.6 * dpr;
        ctx.beginPath();
        ctx.moveTo(A.x + (B.x - A.x) * tail, A.y + (B.y - A.y) * tail);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.fillStyle = 'rgba(241,207,146,.22)';
        ctx.beginPath();
        ctx.arc(x, y, 6 * dpr, 0, 6.2832);
        ctx.fill();
        ctx.fillStyle = '#fbe3b2';
        ctx.beginPath();
        ctx.arc(x, y, 2.2 * dpr, 0, 6.2832);
        ctx.fill();
      }
      let hot = -1;
      if (mouse.on) {
        let bd = Infinity;
        nodes.forEach((n, i) => {
          const d = (n.x - mouse.x) ** 2 + (n.y - mouse.y) ** 2;
          if (d < bd) {
            bd = d;
            hot = i;
          }
        });
        if (Math.sqrt(bd) > 260 * dpr) hot = -1;
      }
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.blue += ((i === hot ? 1 : 0) - n.blue) * Math.min(1, dt * (i === hot ? 9 : 4));
        if (n.blue > 0.03) {
          const r0 = n.r * dpr;
          ctx.fillStyle = `rgba(90,185,255,${(n.blue * 0.2).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r0 * 4.5, 0, 6.2832);
          ctx.fill();
          ctx.strokeStyle = `rgba(120,200,255,${(n.blue * 0.55).toFixed(3)})`;
          ctx.lineWidth = dpr;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r0 + 7 * dpr + (1 - n.blue) * 10 * dpr, 0, 6.2832);
          ctx.stroke();
          for (const k of n.nb) {
            ctx.strokeStyle = `rgba(110,195,255,${(n.blue * 0.35).toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(nodes[k].x, nodes[k].y);
            ctx.stroke();
          }
        }
      }
      for (const n of nodes) {
        n.glow *= Math.pow(0.18, dt);
        const r = n.r * dpr;
        if (n.glow > 0.03) {
          ctx.strokeStyle = `rgba(241,207,146,${(n.glow * 0.5).toFixed(3)})`;
          ctx.lineWidth = dpr;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + (1 - n.glow) * 22 * dpr, 0, 6.2832);
          ctx.stroke();
          ctx.fillStyle = `rgba(241,207,146,${(n.glow * 0.18).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r * 3.2, 0, 6.2832);
          ctx.fill();
        }
        const bl = n.blue;
        ctx.fillStyle = `rgba(${Math.round((217 + 24 * n.glow) * (1 - bl) + 120 * bl)},${Math.round((162 + 45 * n.glow) * (1 - bl) + 205 * bl)},${Math.round((79 + 67 * n.glow) * (1 - bl) + 255 * bl)},${(0.5 + Math.max(n.glow, bl) * 0.5).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * (1 + Math.max(n.glow, n.blue) * 0.45), 0, 6.2832);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    const poll = () => {
      timer = 0;
      vis = inView();
      if (vis) raf = requestAnimationFrame(frame);
      else timer = window.setTimeout(poll, 300);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      window.removeEventListener('pointermove', mv);
      ro?.disconnect();
    };
  }, []);
  return <canvas ref={ref} className="l-net" aria-hidden />;
}

/**
 * The pulse behind "The rest timer", drawn like a bedside monitor: a fixed sweep, a trail that fades behind the bright head.
 * At rest it is the plain 60-bpm trace. Pointer movement acts as exertion: the heart rate climbs (the RR interval shortens - only the
 * flat parts shrink, P/QRS/T keep their width), the R wave drops a little, the ST segment sags and muscle noise creeps in at the top.
 * Rate comes up fast and settles back slowly, and is re-read for every beat while the line is being drawn.
 */
function EcgBg() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const ctx0 = cv?.getContext('2d');
    if (!cv || !ctx0) return;
    const ctx: CanvasRenderingContext2D = ctx0;
    let W = 1;
    let H = 1;
    let dpr = 1;
    let ys = new Float32Array(1);
    const size = () => {
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      W = Math.max(1, Math.round(cv.clientWidth * dpr));
      H = Math.max(1, Math.round(cv.clientHeight * dpr));
      cv.width = W;
      cv.height = H;
      ys = new Float32Array(W + 2).fill(80);
      filled = 0;
      pts = [];
      beatX = 0;
      beatEnd = 0;
    };
    let filled = 0;
    let pts: [number, number][] = [];
    let beatX = 0;
    let beatEnd = 0;
    let act = 0;
    let dist = 0;
    let lx = -1;
    let ly = -1;
    const mv = (e: PointerEvent) => {
      if (lx >= 0) dist += Math.hypot(e.clientX - lx, e.clientY - ly);
      lx = e.clientX;
      ly = e.clientY;
    };
    window.addEventListener('pointermove', mv, { passive: true });
    const unit = () => W / 1200;
    // One beat, 200 units long at rest (the original template); `a` is the exertion 0..1.
    const buildBeat = (x0: number) => {
      const total = 200 * (1 - 0.62 * a0());
      const r = Math.max(0.1, (total - 61) / 139);
      if (act > 0.8 && Math.random() < 0.16) {
        // A premature ventricular beat at peak exertion: no P wave, a wide tall complex, a discordant T.
        pts = [
          [0, 80],
          [4, 80],
          [20, 80 - 62],
          [38, 80 + 44],
          [52, 92],
          [70, 98],
          [84, 80],
          [100, 80],
        ];
        beatX = x0;
        beatEnd = x0 + 100 * unit();
        return;
      }
      const dep = 6 * Math.max(0, (act - 0.5) / 0.5);
      const ra = 1 - 0.12 * act;
      const sa = 1 - 0.08 * act;
      const p: [number, number][] = [];
      let x = 0;
      const add = (dx: number, y: number) => p.push([x + dx, y]);
      x += 7 * r;
      add(0, 80);
      add(7, 70);
      add(14, 80);
      x += 14;
      x += 22 * r;
      add(0, 80);
      add(6, 80);
      add(12, 80 - 56 * ra);
      add(21, 80 + 56 * sa);
      add(29, 80);
      x += 29;
      add(0, 80 + dep);
      x += 14 * r;
      add(0, 80 + dep);
      add(0, 80 + dep);
      add(9, 68 + dep);
      add(18, 80 + dep);
      x += 18;
      add(0, 80 + dep);
      x += 96 * r;
      add(0, 80);
      p.unshift([0, 80]);
      pts = p;
      beatX = x0;
      beatEnd = x0 + x * unit();
    };
    const a0 = () => act;
    const yAt = (px: number) => {
      if (px >= beatEnd || !pts.length) buildBeat(px >= beatEnd && beatEnd ? beatEnd : px);
      const u = (px - beatX) / unit();
      let y = 80;
      for (let i = 1; i < pts.length; i++) {
        if (u <= pts[i][0]) {
          const a = pts[i - 1];
          const b = pts[i];
          y = b[0] === a[0] ? b[1] : a[1] + ((b[1] - a[1]) * (u - a[0])) / (b[0] - a[0]);
          break;
        }
      }
      if (act > 0.12)
        y += (Math.random() - 0.5) * 7 * act * act + Math.sin(px / (60 * dpr)) * 2 * act;
      return y;
    };
    size();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(size);
    ro?.observe(cv);
    const sec = cv.closest('section') ?? cv;
    const inView = () => {
      const b = sec.getBoundingClientRect();
      return b.bottom > 0 && b.top < window.innerHeight;
    };
    let head = 0; // px; the trail is 63% of the width and the head runs off the right edge before the line restarts
    let last = 0;
    let raf = 0;
    let timer = 0;
    let lastCheck = 0;
    let vis = true;
    const poll = () => {
      timer = 0;
      vis = inView();
      if (vis) {
        last = 0;
        raf = requestAnimationFrame(frame);
      } else timer = window.setTimeout(poll, 300);
    };
    function frame(now: number) {
      raf = 0;
      if (now - lastCheck > 250) {
        lastCheck = now;
        vis = inView();
      }
      if (!vis) {
        timer = window.setTimeout(poll, 300);
        return;
      }
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
      last = now;
      const speed = dt > 0 ? dist / dt : 0;
      dist = 0;
      const target = Math.min(1, speed / 1000);
      act += (target - act) * (1 - Math.exp(-dt / (target > act ? 0.25 : 3)));
      if (act < 0.004) act = 0;
      const trail = 0.63 * W;
      head += 0.355 * W * dt;
      if (head > W + trail) {
        head = 0;
        filled = 0;
        beatEnd = 0;
        pts = [];
      }
      const upto = Math.min(W, Math.floor(head));
      for (; filled <= upto; filled++) ys[filled] = yAt(filled);
      ctx.clearRect(0, 0, W, H);
      const x0 = Math.max(0, Math.floor(head - trail));
      const x1 = upto;
      if (x1 > x0) {
        const g = ctx.createLinearGradient(head - trail, 0, head, 0);
        g.addColorStop(0, 'rgba(241,207,146,0)');
        g.addColorStop(0.9, 'rgba(241,207,146,.85)');
        g.addColorStop(1, 'rgba(255,240,205,1)');
        const path = new Path2D();
        for (let x = x0; x <= x1; x++) {
          const y = (ys[x] / 160) * H;
          if (x === x0) path.moveTo(x, y);
          else path.lineTo(x, y);
        }
        ctx.lineJoin = 'round';
        ctx.strokeStyle = g;
        ctx.globalAlpha = 0.16 + 0.12 * act;
        ctx.lineWidth = 7 * dpr;
        ctx.stroke(path);
        ctx.globalAlpha = 1;
        ctx.lineWidth = 2.2 * dpr;
        ctx.stroke(path);
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      window.removeEventListener('pointermove', mv);
      ro?.disconnect();
    };
  }, []);
  return <canvas ref={ref} className="l-ecgc" aria-hidden />;
}

/** Extra tiles around the last screen's download grid so the background reaches every edge of the screen. */
function DlExtra() {
  const out: ReactElement[] = [];
  for (let j = -3; j <= 11; j++) {
    for (let k = -3; k <= 11; k++) {
      if (j >= 0 && j <= 7 && k >= 0 && k <= 7) continue;
      out.push(
        <rect
          key={`${j},${k}`}
          className="l-st"
          x={40 + 118 * k}
          y={40 + 118 * j}
          width="100"
          height="100"
          rx="24"
          opacity=".2"
        />,
      );
    }
  }
  return <>{out}</>;
}

/**
 * "Everywhere": point at a device and it turns blue and sends ripples across the water; the first thing they reach is the server,
 * which turns blue in its turn and sends new ripples on to every other device; each lights up as they arrive, then everything settles back.
 */
const EV_NODES = [
  { id: 'tablet', x: 180, y: 235, i: 7 },
  { id: 'phone', x: 755, y: 160, i: 8 },
  { id: 'laptop', x: 255, y: 780, i: 9 },
  { id: 'browser', x: 560, y: 800, i: 10 },
  { id: 'server', x: 905, y: 734, i: 11 },
] as const;
const EV_LINK: Record<string, number> = { tablet: 3, phone: 4, laptop: 5, browser: 6 }; // child index of the dashed path running to the server
function EverywhereFx() {
  const gRef = useRef<SVGGElement>(null);
  useEffect(() => {
    const g = gRef.current;
    const svg = g?.ownerSVGElement;
    const sec = g?.closest('section');
    if (!g || !svg || !sec) return;
    const kids = Array.from(svg.children);
    const el = (id: string) => kids[EV_NODES.find((n) => n.id === id)!.i];
    const link = (id: string) => kids[EV_LINK[id]];
    let timers: number[] = [];
    let lit: Element[] = [];
    let cur = '';
    let leave = 0;
    const light = (...es: (Element | undefined)[]) =>
      es.forEach((e) => {
        if (!e) return;
        e.classList.add('l-hot');
        lit.push(e);
      });
    // the pointed-at device and its line are green, everything the signal reaches turns blue
    const lightSrc = (...es: (Element | undefined)[]) =>
      es.forEach((e) => {
        if (!e) return;
        e.classList.add('l-hot2');
        lit.push(e);
      });
    let dots: SVGCircleElement[] = [];
    let raf = 0;
    const clear = () => {
      timers.forEach(clearTimeout);
      timers = [];
      cancelAnimationFrame(raf);
      raf = 0;
      dots.forEach((d) => d.remove());
      dots = [];
      svg.classList.remove('l-evon');
      lit.forEach((e) => e.classList.remove('l-hot', 'l-hot2')); // the CSS transition fades them out
      lit = [];
    };
    // A signal dot runs along a line (towards the server or away from it) and vanishes on arrival; it is quick enough to land before the next recolouring.
    const send = (path: Element | undefined, toServer: boolean, color: string, ms: number) => {
      const p = path as SVGPathElement | undefined;
      if (!p || !p.getTotalLength) return;
      const L = p.getTotalLength();
      const d = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      d.setAttribute('r', '7');
      d.style.fill = color;
      d.style.filter = `drop-shadow(0 0 5px ${color})`;
      g.appendChild(d);
      dots.push(d);
      const t0 = performance.now();
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / ms);
        const pt = p.getPointAtLength((toServer ? k : 1 - k) * L);
        d.setAttribute('cx', String(pt.x));
        d.setAttribute('cy', String(pt.y));
        if (k < 1) raf = requestAnimationFrame(step);
        else d.remove();
      };
      raf = requestAnimationFrame(step);
    };
    // Pointing at a device turns it green and sends a dot to the server; the server turns blue and sends dots on to the other devices, which turn blue as they arrive; leaving fades everything back.
    const HOP = 440;
    const start = (id: string) => {
      clear();
      cur = id;
      svg.classList.add('l-evon');
      lightSrc(el(id), link(id));
      send(link(id), true, '#5fe08a', HOP);
      timers.push(
        window.setTimeout(() => {
          light(el('server'));
          EV_NODES.filter((n) => n.id !== 'server' && n.id !== id).forEach((n) =>
            send(link(n.id), false, '#6fc4ff', HOP),
          );
        }, 500),
        window.setTimeout(() => {
          EV_NODES.filter((n) => n.id !== 'server' && n.id !== id).forEach((n) =>
            light(link(n.id), el(n.id)),
          );
        }, 1000),
      );
    };
    // A device counts only while the pointer is really over its drawn shape (the shapes are tilted, so boxes would not do).
    const shapes = new Map<string, SVGGeometryElement[]>();
    const shapesOf = (id: string) => {
      let s = shapes.get(id);
      if (!s) {
        const all = Array.from(
          el(id).querySelectorAll<SVGGeometryElement>('rect, path, polygon, ellipse'),
        );
        const area = (e: SVGGeometryElement) => {
          const b = e.getBBox();
          return b.width * b.height;
        };
        const top = Math.max(0, ...all.map(area));
        s = all.filter((e) => area(e) >= top * 0.005);
        shapes.set(id, s);
      }
      return s;
    };
    const near = (cx: number, cy: number) => {
      // the server is not a device: pointing at it starts nothing, it only answers the devices
      for (const n of EV_NODES) {
        if (n.id === 'server') continue;
        for (const s of shapesOf(n.id)) {
          const m = s.getScreenCTM();
          if (!m) continue;
          const p = new DOMPoint(cx, cy).matrixTransform(m.inverse());
          if (s.isPointInFill(p)) return n.id;
        }
      }
      return '';
    };
    const mv = (e: PointerEvent) => {
      const r = sec.getBoundingClientRect();
      const inside = e.clientY >= r.top && e.clientY <= r.bottom;
      const id = inside ? near(e.clientX, e.clientY) : '';
      if (id) {
        clearTimeout(leave);
        leave = 0;
        if (id !== cur) start(id);
        return;
      }
      // off the device: the blue stays until the pointer has really left it (a short grace bridges gaps in the drawing)
      if (cur && !leave)
        leave = window.setTimeout(() => {
          leave = 0;
          cur = '';
          clear();
        }, 140);
    };
    window.addEventListener('pointermove', mv, { passive: true });
    return () => {
      window.removeEventListener('pointermove', mv);
      clearTimeout(leave);
      clear();
    };
  }, []);
  return <g ref={gRef} className="l-ev" />;
}

const CAL_X = (k: number) => 12 + 108 * k;
const CAL_Y = (j: number) => 190 + 108 * j;
const CAL_TAKEN: Record<number, string> = {};
// A tile never carries two statuses: cells (as "k,j") ticked by the visitor are off limits to the ambient marks, and an ambient mark sitting on a tile the visitor ticks moves away at once.
const CAL_USER = new Set<string>();
const CAL_EVICT: Record<number, () => void> = {};
const calPick = (id: number) => {
  const busy = new Set([
    ...Object.entries(CAL_TAKEN)
      .filter(([k]) => Number(k) !== id)
      .map(([, v]) => v),
    ...CAL_USER,
  ]);
  let c = '';
  do c = `${1 + Math.floor(Math.random() * 8)},${Math.floor(Math.random() * 6)}`;
  while (busy.has(c) || c === CAL_TAKEN[id]);
  CAL_TAKEN[id] = c;
  const [k, j] = c.split(',').map(Number);
  return { k, j };
};

const CAL_KIND = {
  done: { fill: 'rgba(76,190,140,.12)', stroke: '#4cbe8c', d: 'M30 50 L43 63 L68 36' },
  missed: { fill: 'rgba(226,86,79,.12)', stroke: '#e2564f', d: 'M34 34 L66 66 M66 34 L34 66' },
  rest: {
    fill: 'rgba(147,212,242,.10)',
    stroke: '#93d4f2',
    d: 'M50 64 C34 60 34 44 50 36 C66 44 66 60 50 64 Z M30 52 C34 62 42 66 50 64 M70 52 C66 62 58 66 50 64',
  },
} as const;

/** A day of the calendar background being marked: ticked off (done), crossed out (missed) or set aside (rest), always on a different tile. */
function CalMark({
  id,
  kind,
  dur,
  delay,
}: {
  id: number;
  kind: keyof typeof CAL_KIND;
  dur: number;
  delay: number;
}) {
  const [cell, setCell] = useState(() => calPick(id));
  const c = CAL_KIND[kind];
  // The registry must hold the cell that is really on screen (React may discard an initial pick, e.g. in StrictMode).
  useEffect(() => {
    CAL_TAKEN[id] = `${cell.k},${cell.j}`;
    if (CAL_USER.has(CAL_TAKEN[id])) setCell(calPick(id));
  }, [id, cell]);
  useEffect(() => {
    CAL_EVICT[id] = () => setCell(calPick(id));
    return () => {
      delete CAL_EVICT[id];
    };
  }, [id]);
  return (
    <g
      className="l-cmg"
      transform={`translate(${CAL_X(cell.k)} ${CAL_Y(cell.j)})`}
      style={{ animationDuration: `${dur}s`, animationDelay: `${delay}s` }}
      onAnimationIteration={(e) => {
        if (e.target === e.currentTarget) setCell(calPick(id));
      }}
    >
      <rect
        className={`l-cmr l-cmr-${kind}`}
        width="92"
        height="92"
        rx="12"
        fill={c.fill}
        stroke={c.stroke}
        strokeWidth="1.5"
      />
      <path
        className={`l-cmp l-cmp-${kind}`}
        d={c.d}
        pathLength={1}
        fill="none"
        stroke={c.stroke}
        strokeWidth={kind === 'rest' ? 3 : 5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ animationDuration: `${dur}s`, animationDelay: `${delay}s` }}
        transform="translate(-4 -4) scale(1.08)"
      />
    </g>
  );
}

/** The calendar behind "The trainer": a grid that fills the screen, with days being marked now and then. */
function CalGrid() {
  const gRef = useRef<SVGGElement>(null);
  const [done, setDone] = useState<string[]>([]);
  const tiles = useMemo(() => {
    const out: ReactElement[] = [];
    for (let j = -3; j <= 10; j++) {
      for (let k = -2; k <= 11; k++) {
        const i = (j + 3) * 14 + (k + 2);
        const pop = i % 3 === 0 && k >= 1 && k <= 8 && j >= 0 && j <= 5;
        out.push(
          <rect
            key={i}
            data-c={`${j},${k}`}
            className={pop ? 'l-st l-ct l-pop' : 'l-st l-ct'}
            style={{
              fill: 'rgba(217,162,79,.08)',
              ...(pop
                ? { animationDelay: `-${((i * 0.37) % 8).toFixed(2)}s`, animationDuration: '8s' }
                : {}),
            }}
            x={CAL_X(k)}
            y={CAL_Y(j)}
            width="92"
            height="92"
            rx="12"
            opacity={pop ? 1 : 0.5}
          />,
        );
      }
    }
    return out;
  }, []);
  // Pointer: the tile under it lights up blue; a click ticks it off as done (click again to clear).
  useEffect(() => {
    const g = gRef.current;
    const svg = g?.ownerSVGElement;
    const sec = g?.closest('section');
    if (!g || !svg || !sec) return;
    let hotEl: Element | null = null;
    let hotKey = '';
    let raf = 0;
    let ev: { x: number; y: number } | null = null;
    // The tile nearest to the pointer, judged by what is actually on screen (the background drifts and tilts, so SVG maths alone drifts off).
    const cellAt = (cx: number, cy: number) => {
      const m = svg.getScreenCTM();
      if (!m) return '';
      const p = new DOMPoint(cx, cy).matrixTransform(m.inverse());
      const k0 = Math.floor((p.x - 12) / 108);
      const j0 = Math.floor((p.y - 190) / 108);
      let best = '';
      let bd = Infinity;
      for (let dj = -1; dj <= 1; dj++) {
        for (let dk = -1; dk <= 1; dk++) {
          const j = j0 + dj;
          const k = k0 + dk;
          const el = svg.querySelector(`rect[data-c="${j},${k}"]`);
          if (!el) continue;
          const b = el.getBoundingClientRect();
          const mx = (b.left + b.right) / 2;
          const my = (b.top + b.bottom) / 2;
          const nx = Math.abs(cx - mx) / (b.width / 2 || 1);
          const ny = Math.abs(cy - my) / (b.height / 2 || 1);
          const d = Math.max(nx, ny);
          if (d < bd) {
            bd = d;
            best = `${j},${k}`;
          }
        }
      }
      return bd <= 1.12 ? best : '';
    };
    const setHot = (key: string) => {
      if (key === hotKey) return;
      hotEl?.classList.remove('l-hot');
      hotKey = key;
      hotEl = key ? svg.querySelector(`rect[data-c="${key}"]`) : null;
      hotEl?.classList.add('l-hot');
    };
    const pick = () => {
      raf = 0;
      if (ev) setHot(cellAt(ev.x, ev.y));
    };
    const mv = (e: PointerEvent) => {
      const r = sec.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom) {
        ev = null;
        setHot('');
        return;
      }
      ev = { x: e.clientX, y: e.clientY };
      if (!raf) raf = requestAnimationFrame(pick);
    };
    const click = (e: globalThis.MouseEvent) => {
      const r = sec.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right)
        return;
      // Anything that is really a control (links, buttons, fields) keeps its own click; everything else counts for the tile behind it.
      if (
        (e.target as HTMLElement).closest?.(
          'a, button, input, textarea, select, label, [role="button"]',
        )
      )
        return;
      const key = cellAt(e.clientX, e.clientY);
      if (!key) return;
      const [kj, kk] = key.split(',').map(Number);
      const cell = `${kk},${kj}`;
      if (CAL_USER.has(cell)) CAL_USER.delete(cell);
      else {
        CAL_USER.add(cell);
        Object.entries(CAL_TAKEN).forEach(([id, c]) => {
          if (c === cell) CAL_EVICT[Number(id)]?.();
        });
      }
      setDone((d) => (d.includes(key) ? d.filter((x) => x !== key) : [...d, key]));
    };
    window.addEventListener('pointermove', mv, { passive: true });
    window.addEventListener('click', click);
    return () => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('click', click);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <g ref={gRef}>
      {tiles}
      <CalMark id={0} kind="done" dur={9} delay={-1} />
      <CalMark id={1} kind="done" dur={11} delay={-6} />
      <CalMark id={2} kind="done" dur={13} delay={-3} />
      <CalMark id={3} kind="rest" dur={10} delay={-4} />
      <CalMark id={4} kind="rest" dur={15} delay={-9} />
      <CalMark id={5} kind="missed" dur={17} delay={-12} />
      {done.map((key) => {
        const [j, k] = key.split(',').map(Number);
        return (
          <g
            key={key}
            transform={`translate(${CAL_X(k)} ${CAL_Y(j)})`}
            className="l-cdone"
            onAnimationEnd={(e) => {
              if (e.animationName === 'ld-cdlife') {
                CAL_USER.delete(`${k},${j}`);
                setDone((d) => d.filter((x) => x !== key));
              }
            }}
          >
            <rect
              width="92"
              height="92"
              rx="12"
              fill={CAL_KIND.done.fill}
              stroke={CAL_KIND.done.stroke}
              strokeWidth="1.5"
            />
            <path
              d={CAL_KIND.done.d}
              pathLength={1}
              fill="none"
              stroke={CAL_KIND.done.stroke}
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              transform="translate(-4 -4) scale(1.08)"
            />
          </g>
        );
      })}
    </g>
  );
}

const DL_TAKEN: Record<number, number> = {};
const dlPick = (id: number) => {
  const busy = new Set(
    Object.entries(DL_TAKEN)
      .filter(([k]) => Number(k) !== id)
      .map(([, v]) => v),
  );
  let c = 0;
  do c = Math.floor(Math.random() * 64);
  while (busy.has(c) || c === DL_TAKEN[id]);
  DL_TAKEN[id] = c;
  return c;
};

/** One tile of the last screen's background: a download that runs to the end and ticks. It turns up on a different tile every time. */
function DlTile({ id, delay }: { id: number; delay: string }) {
  const [cell, setCell] = useState(() => dlPick(id));
  const x = 40 + 118 * (cell % 8);
  const y = 40 + 118 * Math.floor(cell / 8);
  return (
    <g
      className="l-dlg"
      transform={`translate(${x} ${y})`}
      style={{ animationDelay: delay }}
      onAnimationIteration={(e) => {
        if (e.target === e.currentTarget) setCell(dlPick(id));
      }}
    >
      <rect
        className="l-st"
        style={{ fill: 'rgba(217,162,79,.07)' }}
        strokeWidth="2"
        x="0"
        y="0"
        width="100"
        height="100"
        rx="24"
        opacity=".8"
      />
      <g className="l-dla" style={{ animationDelay: delay }}>
        <path className="l-st" strokeWidth="3" d="M50 36 V62 M38 52 L50 64 L62 52" />
      </g>
      <circle
        className="l-st l-dlr"
        style={{ '--C': '214', strokeDasharray: '214', animationDelay: delay } as CSSProperties}
        strokeWidth="4"
        strokeLinecap="round"
        cx="50"
        cy="50"
        r="34"
        transform="rotate(-90 50 50)"
      />
      <path
        className="l-st l-dlc"
        style={{ animationDelay: delay }}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M35 51 L46 62 L66 40"
      />
    </g>
  );
}

/** The colour-coded body on a turntable; spins on its own unless reduced motion is on. */
function AnatomyTurn({ label }: { label: string }) {
  const camera = useMemo(() => ({ yaw: 20, y: 0.5, zoom: 1, n: 0 }), []);
  return (
    <div
      className="l-tt-wrap"
      style={{
        position: 'relative',
        width: 'min(380px,100%)',
        height: 787,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        className="l-tt-halo"
        style={{
          position: 'absolute',
          left: '50%',
          top: '18%',
          width: 'min(720px,170%)',
          aspectRatio: '1',
          transform: 'translateX(-50%)',
          borderRadius: '50%',
          background: 'radial-gradient(circle,#3a2a12 0,rgba(19,20,22,0) 68%)',
        }}
      />
      <div className="l-tt-body" style={{ position: 'relative', width: '100%', height: '100%' }}>
        <AnatomyTurntable
          base="muscles"
          marks={RECOVERY_MARKS}
          baked={BAKED_TURN}
          label={label}
          camera={camera}
          rotatable={false}
          spin={45}
        />
      </div>
    </div>
  );
}

export interface LandingInvite {
  inviter: string | null;
  expiresAt: number;
  onStart: () => void;
}

function AuthSlot({ onLoggedIn, invite }: { onLoggedIn: () => void; invite?: LandingInvite }) {
  const { t, locale } = useT();
  const T = (k: string): string => (t as unknown as Record<string, string>)[`landing_${k}`] ?? k;
  if (invite) {
    return (
      <div className="ld-auth">
        <div className="ld-inv-by">
          {T('k77')} {invite.inviter && <b>{invite.inviter}</b>}
        </div>
        <div className="ld-inv-h">{T('k163')}</div>
        <div className="ld-inv-steps">
          {T('k191').replace(/\[[^\]]+\]/, fmtDayMonth(invite.expiresAt, locale))}
        </div>
        <button type="button" className="ld-inv-btn" onClick={invite.onStart}>
          {T('k126')}
        </button>
      </div>
    );
  }
  return (
    <div className="ld-auth">
      <div className="ld-auth-h">{t.signIn}</div>
      <AuthView onLoggedIn={onLoggedIn} />
    </div>
  );
}

/** Every screen is exactly as tall as the viewport; when its content is taller (narrow or short windows) the content is scaled down to fit, so nothing is cut and nothing is dropped. */
function useFitScreens(dep: unknown) {
  useEffect(() => {
    const secs = Array.from(document.querySelectorAll<HTMLElement>('.ld section[id^="s-"]'));
    const wraps = secs.map((s) => s.querySelector<HTMLElement>(':scope > .l-wrap'));
    let raf = 0;
    const set = (w: HTMLElement, k: number) => {
      w.style.zoom = String(k);
      w.style.setProperty('--fz', String(k));
    };
    const fit = () => {
      raf = 0;
      secs.forEach((s, i) => {
        const w = wraps[i];
        if (!w) return;
        const cs = getComputedStyle(s);
        const avail = s.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
        set(w, 1);
        if (w.getBoundingClientRect().height <= avail + 0.5) return;
        let lo = 0.3;
        let hi = 1;
        for (let n = 0; n < 8; n++) {
          const mid = (lo + hi) / 2;
          set(w, mid);
          if (w.getBoundingClientRect().height <= avail + 0.5) lo = mid;
          else hi = mid;
        }
        set(w, lo);
      });
      // Illustrated backgrounds: scaled so the whole artwork fits the screen and fills it along the tighter side.
      ['log', 'rec', 'pro', 'ret'].forEach((id) => {
        const sec = document.querySelector<HTMLElement>(`.ld #s-${id}`);
        const sv = sec?.querySelector<SVGSVGElement>(':scope > .l-bgx svg');
        if (!sec || !sv) return;
        if (typeof sv.getBBox !== 'function') return; // jsdom has no SVG geometry
        const b = sv.getBBox();
        const x0 = Math.max(0, b.x);
        const x1 = Math.min(1000, b.x + b.width);
        const y0 = Math.max(0, b.y);
        const y1 = Math.min(1000, b.y + b.height);
        if (x1 - x0 < 1 || y1 - y0 < 1) return;
        const k = Math.min(
          2.2,
          0.9 * Math.min(sec.clientWidth / (x1 - x0), sec.clientHeight / (y1 - y0)),
        );
        sv.style.setProperty('--bs', `${Math.round(1000 * k)}px`);
      });
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(fit);
    };
    fit();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(queue);
    secs.forEach((s, i) => {
      ro?.observe(s);
      const w = wraps[i];
      if (w) ro?.observe(w);
    });
    window.addEventListener('resize', queue);
    document.fonts?.ready.then(queue);
    const late = window.setTimeout(queue, 1500);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(late);
      ro?.disconnect();
      window.removeEventListener('resize', queue);
      wraps.forEach((w) => {
        if (w) {
          w.style.zoom = '';
          w.style.removeProperty('--fz');
        }
      });
    };
  }, [dep]);
}

export function LandingDesign({
  onLoggedIn,
  invite,
}: {
  onLoggedIn: () => void;
  invite?: LandingInvite;
}) {
  const { t, locale } = useT();
  useFitScreens(locale);
  const T = (k: string): string => (t as unknown as Record<string, string>)[`landing_${k}`] ?? k;
  const [st, setSt] = useState<Record<string, any>>({});
  const patch = (p: Record<string, unknown>) => setSt((s) => ({ ...s, ...p }));

  const n: number = st.sets || 0;
  const off: number = st.off || 0;
  const pd: number = st.pd || 0;
  const os = detectOS();
  // Inside the installed app the desktop installers are pointless (Android and the rest stay).
  const deskApp = isAppShell() ? ' l-noapp' : '';
  const rows = [
    { cls: 'l-srow l-warm', idx: 'W', reps: '10', kg: '40', kind: T('kind_w') },
    { cls: 'l-srow', idx: '1', reps: '8', kg: '80', kind: '' },
    { cls: 'l-srow l-pr', idx: '2', reps: '6', kg: '85', kind: 'PR' },
  ];
  for (let i = 0; i < n; i++)
    rows.push({ cls: 'l-srow', idx: String(3 + i), reps: '6', kg: '85', kind: '' });
  const restSecs = 120 + (off & 1 ? 0 : 30) + (off & 2 ? 0 : 20) + (off & 4 ? 0 : 10);
  const restTot = `${Math.floor(restSecs / 60)}:${`0${restSecs % 60}`.slice(-2)}`;
  const langs = LOCALE_IDS.map((id) => ({
    id,
    flag: FLAGS[id],
    name: NAMES[id],
    on: id === locale,
    cls: id === locale ? 'l-lang-item l-act' : 'l-lang-item',
    pick: () => {
      setLocale(id);
      patch({ open: false });
    },
  }));
  const v: Record<string, any> = {
    langs,
    flag: FLAGS[locale],
    curName: NAMES[locale],
    open: !!st.open,
    andOpen: !!st.andOpen,
    toggle: () => patch({ open: !st.open, andOpen: false }),
    // on an Android phone the tile downloads the .apk straight away; elsewhere it opens the QR
    toggleAnd: () =>
      os === 'and'
        ? window.location.assign(downloadUrl('android'))
        : patch({ andOpen: !st.andOpen, open: false }),
    // desktop installers make no sense on a phone, the .apk none on iOS, and iOS has no installer at all (it uses the web app)
    clsWin:
      (os === 'win' ? 'l-dl l-pri' : os === 'and' || os === 'ios' ? 'l-dl l-nomob' : 'l-dl') +
      deskApp,
    clsMac:
      (os === 'mac' ? 'l-dl l-pri' : os === 'and' || os === 'ios' ? 'l-dl l-nomob' : 'l-dl') +
      deskApp,
    clsAnd: os === 'and' ? 'l-dl l-pri' : os === 'ios' ? 'l-dl l-nomob' : 'l-dl',
    clsPdl: os === 'ios' ? 'l-pdl l-nomob' : 'l-pdl',
    andSmall: os === 'and' ? '.apk ↓' : 'QR · .apk',
    rows,
    gidx: `R${3 + n}`,
    logCls: n >= 4 ? 'l-logbtn l-off' : 'l-logbtn',
    undoStyle: n > 0 ? 'visibility:visible' : 'visibility:hidden',
    restDef: off === 0,
    restMod: off !== 0,
    restTot,
    ringStyle: `animation-duration:${restSecs}s`,
    rc1: off & 1 ? 'l-off' : '',
    rc2: off & 2 ? 'l-off' : '',
    rc3: off & 4 ? 'l-off' : '',
    rp1: off & 1 ? 'false' : 'true',
    rp2: off & 2 ? 'false' : 'true',
    rp3: off & 4 ? 'false' : 'true',
    rt1: () => patch({ off: off ^ 1 }),
    rt2: () => patch({ off: off ^ 2 }),
    rt3: () => patch({ off: off ^ 4 }),
    pc1: pd & 1 ? 'l-dn' : '',
    pc2: pd & 2 ? 'l-dn' : '',
    pc3: pd & 4 ? 'l-dn' : '',
    pc4: pd & 8 ? 'l-dn' : '',
    pq1: pd & 1 ? 'true' : 'false',
    pq2: pd & 2 ? 'true' : 'false',
    pq3: pd & 4 ? 'true' : 'false',
    pq4: pd & 8 ? 'true' : 'false',
    pk1: () => patch({ pd: pd ^ 1 }),
    pk2: () => patch({ pd: pd ^ 2 }),
    pk3: () => patch({ pd: pd ^ 4 }),
    pk4: () => patch({ pd: pd ^ 8 }),
    aiA: (st.air || 0) % 2 === 0,
    aiB: (st.air || 0) % 2 === 1,
    aiReplay: () => patch({ air: (st.air || 0) + 1 }),
    logSet: () => patch({ sets: Math.min(4, n + 1) }),
    undoSet: () => patch({ sets: Math.max(0, n - 1) }),
    stageVars: '',
    bgVars: '',
    // Pointer position goes to CSS variables only: re-rendering the whole page on every move would be slow.
    mm: (e: MouseEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      e.currentTarget.style.setProperty('--tx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      e.currentTarget.style.setProperty('--ty', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    },
  };

  const rootRef = useRef<HTMLDivElement>(null);
  // Only the screens actually on show run their endless animations: the rest are paused,
  // CSS animations through `.l-idle` and the SVG (SMIL) ones through pauseAnimations().
  useEffect(() => {
    const root = rootRef.current;
    const sc = root?.closest('.app-landing') as HTMLElement | null;
    if (!root || !sc || typeof IntersectionObserver === 'undefined') return;
    const secs = Array.from(root.querySelectorAll<HTMLElement>('section[id^="s-"]'));
    const set = (s: Element, idle: boolean) => {
      s.classList.toggle('l-idle', idle);
      s.querySelectorAll('svg').forEach((v) => {
        const sv = v as SVGSVGElement;
        if (idle) sv.pauseAnimations?.();
        else sv.unpauseAnimations?.();
      });
    };
    secs.forEach((s) => set(s, true));
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => set(e.target, !(e.isIntersecting && e.intersectionRatio > 0))),
      { root: sc, rootMargin: '0px', threshold: [0, 0.002, 0.01] },
    );
    secs.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  // The recovery screen's background reacts to the pointer: the row (bar + ring) nearest to it turns x-ray blue.
  useEffect(() => {
    const sec = rootRef.current?.querySelector<HTMLElement>('#s-rec');
    const svg = sec?.querySelector<SVGSVGElement>('.l-bgs svg');
    if (!sec || !svg) return;
    const kids = Array.from(svg.children).filter((c) => c.tagName !== 'defs');
    const rows: Element[][] = [];
    for (let i = 0; i + 3 < kids.length; i += 4) rows.push(kids.slice(i, i + 4));
    let hot = -1;
    let raf = 0;
    let px = 0;
    let py = 0;
    const apply = (n: number) => {
      if (n === hot) return;
      if (hot >= 0) rows[hot].forEach((el) => el.classList.remove('l-hot'));
      hot = n;
      if (n >= 0) rows[n].forEach((el) => el.classList.add('l-hot'));
    };
    const pick = () => {
      raf = 0;
      let best = -1;
      let bd = 170;
      rows.forEach((r, i) => {
        const b = r[0].getBoundingClientRect();
        const dx = px < b.left ? b.left - px : px > b.right ? px - b.right : 0;
        const dy = py < b.top ? b.top - py : py > b.bottom ? py - b.bottom : 0;
        const d = Math.hypot(dx, dy);
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      apply(best);
    };
    const mv = (e: PointerEvent) => {
      const r = sec.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom) {
        if (hot >= 0 && !raf) raf = requestAnimationFrame(() => ((raf = 0), apply(-1)));
        return;
      }
      px = e.clientX;
      py = e.clientY;
      if (!raf) raf = requestAnimationFrame(pick);
    };
    window.addEventListener('pointermove', mv, { passive: true });
    return () => {
      window.removeEventListener('pointermove', mv);
      cancelAnimationFrame(raf);
    };
  }, []);

  // In-page rail / anchors must not touch the app's hash router.
  const onRootClick = (e: MouseEvent<HTMLElement>) => {
    const a = (e.target as HTMLElement).closest?.('a[href^="#s-"]');
    if (!a) return;
    e.preventDefault();
    document
      .getElementById((a.getAttribute('href') || '').slice(1))
      ?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="ld pg" ref={rootRef} onClick={onRootClick}>
      <div
        id="top"
        data-os={os}
        data-shell={isAppShell() ? 'app' : 'web'}
        style={{ background: '#131416', color: '#ecebe7', minHeight: '100dvh' }}
      >
        <nav className="l-rail" aria-label="Sections">
          <div className="l-rail-in">
            <div className="l-rail-line">
              <u />
            </div>
            <a className="l-rd l-rd-s-top" href="#s-top">
              <span>Spotter</span>
              <i />
            </a>
            <a className="l-rd l-rd-s-log" href="#s-log">
              <span>{T('a_k')}</span>
              <i />
            </a>
            <a className="l-rd l-rd-s-rec" href="#s-rec">
              <span>{T('c_k')}</span>
              <i />
            </a>
            <a className="l-rd l-rd-s-pro" href="#s-pro">
              <span>{T('m_k')}</span>
              <i />
            </a>
            <a className="l-rd l-rd-s-rest" href="#s-rest">
              <span>{T('rest_l')}</span>
              <i />
            </a>
            <a className="l-rd l-rd-s-atl" href="#s-atl">
              <span>Atlas</span>
              <i />
            </a>
            <a className="l-rd l-rd-s-prog" href="#s-prog">
              <span>{T('p_k')}</span>
              <i />
            </a>
            <a className="l-rd l-rd-s-ret" href="#s-ret">
              <span>{T('i_k')}</span>
              <i />
            </a>
            <a className="l-rd l-rd-s-all" href="#s-all">
              <span>{T('e_k')}</span>
              <i />
            </a>
            <a className="l-rd l-rd-s-get" href="#s-get">
              <span>{T('nav_get')}</span>
              <i />
            </a>
          </div>
        </nav>
        <section id="s-top" className="l-hero" onMouseMove={v.mm}>
          <div className="l-hero-bg l-px-bg">
            <div className="l-hb-in" style={sv(v.bgVars)}>
              <div className="l-hs" style={{ backgroundImage: 'url(/landing/hero.webp)' }}>
                <div className="l-hs-beam">
                  <div className="l-hs-wd">
                    <div className="l-hs-glow" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="l-hero-shade" />
          <div className="l-wrap">
            <div className="l-bar">
              <span className="l-brand">
                <span className="l-plate">
                  <img src="/landing/glyph.png" alt="" width="30" height="30" />
                </span>
                <span className="l-word">spotter</span>
              </span>
              <div className="l-lang">
                <button
                  type="button"
                  className="l-lang-chip"
                  onClick={v.toggle}
                  aria-label={T('lang_aria')}
                  aria-expanded={v.open}
                  aria-haspopup="menu"
                >
                  <span aria-hidden="true">{v.flag}</span>
                  <span>{v.curName}</span>
                  <span className="l-car" aria-hidden="true">
                    ▾
                  </span>
                </button>
                {v.open && (
                  <>
                    <div className="l-lang-scrim" onClick={v.toggle} aria-hidden="true" />
                    <div className="l-lang-pop" role="menu">
                      {(v.langs as any[]).map((l, i) => (
                        <Fragment key={i}>
                          <button
                            type="button"
                            role="menuitemradio"
                            aria-checked={l.on}
                            className={l.cls}
                            onClick={l.pick}
                          >
                            <span aria-hidden="true">{l.flag}</span>
                            <span>{l.name}</span>
                          </button>
                        </Fragment>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="l-hero-grid">
              <div className="l-hero-copy">
                <h1 className="l-h1 l-fd">
                  {T('h_h')} <em>{T('h_h2')}</em>
                </h1>
                <p className="l-hsub">{T('h_p')}</p>
              </div>
              <div className="l-panel">
                <div className="l-pform">
                  <AuthSlot onLoggedIn={onLoggedIn} invite={invite} />
                </div>
                <div className={v.clsPdl}>
                  <div className="l-pdl-l l-fm">{T('get_l')}</div>
                  <div className="l-dls">
                    <a className={v.clsWin} href={downloadUrl('win')}>
                      <svg className="l-ic" viewBox="0 0 18 18" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M1 2.6 7.6 1.7v6H1zM8.5 1.6 17 .4v7.3H8.5zM1 8.6h6.6v6L1 13.4zM8.5 8.6H17V16l-8.5-1.2z"
                        />
                      </svg>
                      <span>Windows</span>
                      <small>.exe ↓</small>
                    </a>{' '}
                    <a className={v.clsMac} href={downloadUrl('mac')}>
                      <svg className="l-ic" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
                        />
                      </svg>
                      <span>macOS</span>
                      <small>.dmg ↓</small>
                    </a>{' '}
                    <button
                      type="button"
                      className={`${v.clsAnd} l-and-pop`}
                      onClick={v.toggleAnd}
                      aria-expanded={v.andOpen}
                    >
                      <svg className="l-ic" viewBox="0 0 24 24" aria-hidden="true">
                        <g fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M4.5 10.2a7.5 7.5 0 0 1 15 0zM8.1 7.4a.9.9 0 1 0 1.8 0 .9.9 0 1 0-1.8 0zM14.1 7.4a.9.9 0 1 0 1.8 0 .9.9 0 1 0-1.8 0z"
                          />
                          <rect x="4.5" y="11.2" width="15" height="7.4" rx="1.8" />
                          <rect x="1.5" y="11.2" width="2.2" height="6.2" rx="1.1" />
                          <rect x="20.3" y="11.2" width="2.2" height="6.2" rx="1.1" />
                          <rect x="8" y="17.4" width="2.5" height="4.4" rx="1.25" />
                          <rect x="13.5" y="17.4" width="2.5" height="4.4" rx="1.25" />
                        </g>
                        <path
                          d="M8.2 3.6 7 1.8M15.8 3.6 17 1.8"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          fill="none"
                        />
                      </svg>
                      <span>Android</span>
                      <small>{v.andSmall}</small>
                    </button>{' '}
                    <a className="l-dl l-and-direct" href={downloadUrl('android')}>
                      <svg className="l-ic" viewBox="0 0 24 24" aria-hidden="true">
                        <g fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M4.5 10.2a7.5 7.5 0 0 1 15 0zM8.1 7.4a.9.9 0 1 0 1.8 0 .9.9 0 1 0-1.8 0zM14.1 7.4a.9.9 0 1 0 1.8 0 .9.9 0 1 0-1.8 0z"
                          />
                          <rect x="4.5" y="11.2" width="15" height="7.4" rx="1.8" />
                          <rect x="1.5" y="11.2" width="2.2" height="6.2" rx="1.1" />
                          <rect x="20.3" y="11.2" width="2.2" height="6.2" rx="1.1" />
                          <rect x="8" y="17.4" width="2.5" height="4.4" rx="1.25" />
                          <rect x="13.5" y="17.4" width="2.5" height="4.4" rx="1.25" />
                        </g>
                        <path
                          d="M8.2 3.6 7 1.8M15.8 3.6 17 1.8"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          fill="none"
                        />
                      </svg>
                      <span>Android</span>
                      <small>.apk ↓</small>
                    </a>
                  </div>
                </div>
                {v.andOpen && (
                  <>
                    <div className="l-qrp" role="group" aria-label="Android">
                      <div className="l-qrimg">
                        <svg
                          viewBox="0 0 53 53"
                          style={{ display: 'block', width: '100%', height: '100%' }}
                          role="img"
                          aria-label="QR"
                        >
                          <path fill="#fff" d="M0 0h53v53h-53z" />
                          <path
                            stroke="#111"
                            d="M2 2.5h7m2 0h2m2 0h2m2 0h1m1 0h1m3 0h1m3 0h1m1 0h2m2 0h1m1 0h2m3 0h1m1 0h7m-49 1h1m5 0h1m1 0h2m1 0h2m2 0h1m2 0h1m2 0h2m1 0h4m4 0h1m1 0h2m1 0h4m1 0h1m5 0h1m-49 1h1m1 0h3m1 0h1m3 0h1m2 0h1m3 0h2m3 0h3m2 0h2m1 0h5m4 0h2m1 0h1m1 0h3m1 0h1m-49 1h1m1 0h3m1 0h1m1 0h1m6 0h1m2 0h1m2 0h2m1 0h1m1 0h1m2 0h1m1 0h1m3 0h3m1 0h1m2 0h1m1 0h3m1 0h1m-49 1h1m1 0h3m1 0h1m2 0h5m2 0h5m1 0h5m1 0h5m3 0h2m4 0h1m1 0h3m1 0h1m-49 1h1m5 0h1m1 0h5m2 0h2m1 0h1m1 0h1m1 0h1m3 0h2m1 0h1m1 0h2m1 0h1m1 0h1m1 0h1m3 0h1m5 0h1m-49 1h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7m-37 1h3m1 0h1m1 0h5m3 0h1m1 0h1m1 0h4m3 0h1m1 0h1m-40 1h5m1 0h3m6 0h2m1 0h10m8 0h2m1 0h3m1 0h1m1 0h1m1 0h1m-48 1h1m6 0h3m4 0h1m4 0h1m3 0h2m2 0h1m1 0h2m1 0h1m2 0h3m3 0h3m1 0h1m-46 1h1m1 0h2m1 0h3m1 0h1m2 0h3m2 0h1m1 0h1m4 0h1m1 0h2m5 0h2m1 0h1m1 0h1m1 0h1m2 0h3m1 0h2m-47 1h2m4 0h1m5 0h2m7 0h1m1 0h1m2 0h1m1 0h1m1 0h2m1 0h1m1 0h1m1 0h2m1 0h1m1 0h1m-45 1h1m1 0h3m1 0h1m2 0h3m1 0h2m2 0h1m1 0h1m2 0h6m2 0h1m3 0h7m2 0h1m2 0h2m-48 1h1m3 0h1m2 0h1m1 0h1m1 0h2m2 0h1m2 0h1m2 0h1m1 0h2m3 0h3m1 0h2m1 0h3m3 0h3m1 0h1m1 0h1m-45 1h1m1 0h2m1 0h1m4 0h1m3 0h1m1 0h1m4 0h4m5 0h2m1 0h1m1 0h3m2 0h1m3 0h2m-49 1h2m3 0h1m1 0h1m1 0h1m2 0h2m1 0h1m1 0h1m3 0h1m2 0h3m1 0h3m1 0h2m1 0h1m1 0h3m1 0h2m1 0h1m3 0h1m-49 1h4m2 0h1m2 0h1m2 0h1m2 0h4m1 0h1m2 0h1m2 0h2m1 0h3m2 0h1m1 0h1m1 0h6m2 0h3m-48 1h3m4 0h1m4 0h2m4 0h1m1 0h1m3 0h1m1 0h1m2 0h2m1 0h1m1 0h2m4 0h3m1 0h1m-41 1h3m2 0h1m1 0h1m3 0h1m1 0h1m1 0h1m1 0h2m2 0h2m3 0h2m1 0h1m2 0h2m1 0h1m2 0h2m1 0h1m1 0h1m-48 1h4m3 0h1m1 0h2m1 0h1m2 0h5m6 0h3m2 0h1m1 0h1m2 0h1m2 0h1m1 0h1m1 0h2m-45 1h1m3 0h4m2 0h1m3 0h1m2 0h1m3 0h3m1 0h1m2 0h1m1 0h1m1 0h5m2 0h4m2 0h1m1 0h1m-45 1h1m5 0h4m2 0h5m1 0h1m2 0h1m1 0h1m1 0h4m2 0h2m4 0h2m1 0h2m1 0h1m-48 1h1m1 0h8m1 0h2m2 0h3m2 0h1m1 0h5m2 0h1m1 0h6m1 0h1m1 0h6m1 0h2m-49 1h3m1 0h1m3 0h1m1 0h3m1 0h1m1 0h2m1 0h4m3 0h1m1 0h2m2 0h2m1 0h1m1 0h2m1 0h1m3 0h1m3 0h1m-49 1h1m2 0h2m1 0h1m1 0h1m1 0h1m2 0h1m1 0h2m1 0h1m1 0h1m1 0h1m1 0h1m1 0h2m1 0h2m3 0h1m1 0h2m2 0h1m1 0h1m1 0h5m-47 1h3m3 0h4m10 0h1m3 0h2m2 0h2m3 0h3m2 0h1m3 0h4m-48 1h1m1 0h7m1 0h1m1 0h4m1 0h1m1 0h1m1 0h7m1 0h1m3 0h4m1 0h11m-46 1h3m1 0h3m4 0h1m1 0h1m2 0h1m1 0h1m2 0h1m1 0h1m1 0h3m1 0h2m3 0h2m1 0h2m3 0h1m1 0h2m-48 1h2m1 0h1m1 0h3m1 0h1m1 0h3m2 0h1m1 0h1m1 0h5m1 0h1m2 0h1m3 0h3m1 0h2m1 0h8m-45 1h2m1 0h1m7 0h1m2 0h1m2 0h1m2 0h1m1 0h5m5 0h2m1 0h2m1 0h1m2 0h3m-47 1h1m3 0h2m2 0h3m1 0h1m3 0h1m1 0h1m2 0h4m3 0h1m3 0h3m2 0h2m1 0h2m3 0h3m-44 1h1m1 0h5m2 0h2m1 0h1m3 0h1m2 0h1m1 0h1m1 0h3m1 0h1m7 0h1m2 0h1m1 0h1m2 0h1m-49 1h1m2 0h6m2 0h3m1 0h4m1 0h2m5 0h1m1 0h3m1 0h7m2 0h3m1 0h1m-47 1h1m2 0h1m4 0h1m1 0h4m5 0h1m1 0h5m1 0h1m2 0h1m2 0h1m1 0h2m2 0h3m1 0h1m2 0h1m-47 1h2m4 0h2m7 0h2m1 0h4m1 0h2m4 0h1m1 0h1m1 0h2m1 0h8m2 0h3m-49 1h3m2 0h1m2 0h1m2 0h3m2 0h4m2 0h3m3 0h5m1 0h1m2 0h1m2 0h1m3 0h2m2 0h1m-49 1h5m1 0h2m2 0h1m1 0h1m2 0h1m2 0h1m3 0h1m1 0h1m1 0h2m2 0h1m3 0h6m3 0h6m-46 1h1m7 0h1m1 0h1m2 0h8m1 0h1m3 0h2m1 0h1m2 0h1m1 0h1m2 0h4m2 0h1m-46 1h1m3 0h3m1 0h1m5 0h4m1 0h1m1 0h1m2 0h1m2 0h1m2 0h1m1 0h4m1 0h5m3 0h3m-48 1h3m7 0h1m1 0h2m1 0h1m1 0h3m1 0h2m1 0h2m1 0h1m1 0h3m1 0h1m5 0h1m2 0h2m3 0h1m-49 1h3m3 0h1m3 0h2m1 0h1m1 0h4m1 0h1m1 0h6m1 0h2m4 0h3m1 0h9m-40 1h2m1 0h4m4 0h1m2 0h1m3 0h1m2 0h3m1 0h1m1 0h1m4 0h1m3 0h1m1 0h2m-48 1h7m1 0h4m1 0h2m1 0h2m1 0h1m1 0h2m1 0h1m1 0h2m3 0h1m2 0h1m1 0h3m1 0h1m1 0h1m1 0h1m1 0h3m-49 1h1m5 0h1m3 0h2m2 0h1m7 0h1m3 0h7m1 0h1m2 0h4m3 0h1m3 0h1m-49 1h1m1 0h3m1 0h1m1 0h1m1 0h5m2 0h1m1 0h1m2 0h6m1 0h3m3 0h14m-49 1h1m1 0h3m1 0h1m1 0h1m1 0h1m1 0h1m2 0h1m2 0h1m2 0h1m5 0h7m1 0h1m1 0h1m1 0h4m1 0h2m1 0h2m-49 1h1m1 0h3m1 0h1m1 0h1m2 0h2m4 0h1m1 0h1m1 0h1m1 0h2m2 0h1m1 0h1m1 0h5m2 0h2m1 0h3m-44 1h1m5 0h1m1 0h1m1 0h1m1 0h1m2 0h1m1 0h1m3 0h2m4 0h2m1 0h1m1 0h1m5 0h1m2 0h2m1 0h1m3 0h1m-49 1h7m1 0h3m2 0h1m2 0h3m1 0h1m3 0h1m4 0h3m1 0h1m1 0h3m1 0h1m1 0h1m1 0h1m1 0h4"
                          />
                        </svg>
                      </div>
                      <div>
                        <div className="l-qrt">{T('and_scan')}</div>
                        <a className="l-qrl" href={downloadUrl('android')}>
                          {T('and_dl')} ↓
                        </a>
                      </div>
                      <button
                        type="button"
                        className="l-qrx"
                        onClick={v.toggleAnd}
                        aria-label={T('and_close')}
                      >
                        ✕
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
        <section id="s-log" className="l-sc" onMouseMove={v.mm}>
          <div className="l-bgx" style={sv(v.bgVars)}>
            <div className="l-bgs">
              <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                <defs>
                  <linearGradient id="gl" x1="0" x2="1">
                    <stop offset="0" stopColor="#fff" stopOpacity="0" />
                    <stop offset=".5" stopColor="#f1cf92" stopOpacity=".22" />
                    <stop offset="1" stopColor="#fff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <g className="l-sp l-lift">
                  <rect
                    className="l-st"
                    style={{ strokeOpacity: '.35' }}
                    x="60"
                    y="486"
                    width="880"
                    height="28"
                    rx="3"
                  />
                  <rect
                    className="l-st"
                    style={{ strokeOpacity: '.45' }}
                    x="300"
                    y="494"
                    width="400"
                    height="12"
                  />
                  <line
                    className="l-st"
                    style={{ strokeOpacity: '.3' }}
                    x1="360"
                    y1="500"
                    x2="640"
                    y2="500"
                    strokeWidth="10"
                    strokeDasharray="1.5 4"
                  />
                  <rect
                    className="l-st"
                    style={{ strokeOpacity: '.45' }}
                    x="176"
                    y="452"
                    width="14"
                    height="96"
                    rx="3"
                  />
                  <rect
                    className="l-st"
                    style={{ strokeOpacity: '.45' }}
                    x="810"
                    y="452"
                    width="14"
                    height="96"
                    rx="3"
                  />
                  <g className="l-pl l-pl-0 l-pl-l">
                    <rect
                      className="l-st l-plt"
                      style={{ animationDelay: '-0.0s' }}
                      x="300"
                      y="265"
                      width="34"
                      height="470"
                      rx="6"
                    />
                    <line
                      className="l-st"
                      style={{ strokeOpacity: '.25' }}
                      x1="317"
                      y1="287"
                      x2="317"
                      y2="713"
                    />
                  </g>
                  <g className="l-pl l-pl-0 l-pl-r">
                    <rect
                      className="l-st l-plt"
                      style={{ animationDelay: '-0.9s' }}
                      x="666"
                      y="265"
                      width="34"
                      height="470"
                      rx="6"
                    />
                    <line
                      className="l-st"
                      style={{ strokeOpacity: '.25' }}
                      x1="683"
                      y1="287"
                      x2="683"
                      y2="713"
                    />
                  </g>
                  <g className="l-pl l-pl-1 l-pl-l">
                    <rect
                      className="l-st l-plt"
                      style={{ animationDelay: '-1.9s' }}
                      x="262"
                      y="305"
                      width="28"
                      height="390"
                      rx="6"
                    />
                    <line
                      className="l-st"
                      style={{ strokeOpacity: '.25' }}
                      x1="276"
                      y1="327"
                      x2="276"
                      y2="673"
                    />
                  </g>
                  <g className="l-pl l-pl-1 l-pl-r">
                    <rect
                      className="l-st l-plt"
                      style={{ animationDelay: '-2.8s' }}
                      x="710"
                      y="305"
                      width="28"
                      height="390"
                      rx="6"
                    />
                    <line
                      className="l-st"
                      style={{ strokeOpacity: '.25' }}
                      x1="724"
                      y1="327"
                      x2="724"
                      y2="673"
                    />
                  </g>
                  <g className="l-pl l-pl-2 l-pl-l">
                    <rect
                      className="l-st l-plt"
                      style={{ animationDelay: '-3.8s' }}
                      x="228"
                      y="350"
                      width="22"
                      height="300"
                      rx="6"
                    />
                    <line
                      className="l-st"
                      style={{ strokeOpacity: '.25' }}
                      x1="239"
                      y1="372"
                      x2="239"
                      y2="628"
                    />
                  </g>
                  <g className="l-pl l-pl-2 l-pl-r">
                    <rect
                      className="l-st l-plt"
                      style={{ animationDelay: '-4.7s' }}
                      x="750"
                      y="350"
                      width="22"
                      height="300"
                      rx="6"
                    />
                    <line
                      className="l-st"
                      style={{ strokeOpacity: '.25' }}
                      x1="761"
                      y1="372"
                      x2="761"
                      y2="628"
                    />
                  </g>
                  <g className="l-pl l-pl-3 l-pl-l">
                    <rect
                      className="l-st l-plt"
                      style={{ animationDelay: '-5.7s' }}
                      x="200"
                      y="390"
                      width="16"
                      height="220"
                      rx="6"
                    />
                    <line
                      className="l-st"
                      style={{ strokeOpacity: '.25' }}
                      x1="208"
                      y1="412"
                      x2="208"
                      y2="588"
                    />
                  </g>
                  <g className="l-pl l-pl-3 l-pl-r">
                    <rect
                      className="l-st l-plt"
                      style={{ animationDelay: '-6.6s' }}
                      x="784"
                      y="390"
                      width="16"
                      height="220"
                      rx="6"
                    />
                    <line
                      className="l-st"
                      style={{ strokeOpacity: '.25' }}
                      x1="792"
                      y1="412"
                      x2="792"
                      y2="588"
                    />
                  </g>
                </g>
              </svg>
            </div>
          </div>
          <div className="l-wrap">
            <div className="l-grid">
              <div className="l-txt l-rv">
                <div className="l-kk l-fm">
                  <b>01</b>
                  <span>/ 08</span>
                  <i />
                  {T('a_k')}
                </div>
                <h2 className="l-h2 l-fd">{T('a_h')}</h2>
                <p className="l-lead">{T('a_p')}</p>
                <ul className="l-fts">
                  <li>
                    <span className="l-fi">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M8 7l4-4 4 4M8 17l4 4 4-4M12 3v18" />
                      </svg>
                    </span>
                    <span>{T('a_1')}</span>
                  </li>
                  <li>
                    <span className="l-fi">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M3 12V4h8l10 10-8 8z" />
                        <path d="M7.5 8.5h.01" />
                      </svg>
                    </span>
                    <span>{T('a_2')}</span>
                  </li>
                  <li>
                    <span className="l-fi">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M9 14L4 9l5-5" />
                        <path d="M4 9h10a6 6 0 010 12h-4" />
                      </svg>
                    </span>
                    <span>{T('a_3')}</span>
                  </li>
                  <li>
                    <span className="l-fi">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" />
                        <circle cx="12" cy="12" r="3.5" />
                      </svg>
                    </span>
                    <span>{T('a_4')}</span>
                  </li>
                </ul>
              </div>
              <div className="l-gx">
                <div
                  className=""
                  style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  <div className="l-stage3">
                    <div className="l-s3d" style={sv(v.stageVars)}>
                      <span className="l-chip l-c1">
                        <span>{T('rest_l')}</span>
                        <b>3:00</b>
                      </span>
                      <div className="l-cardwrap">
                        <div className="l-deck l-d2">
                          <i />
                          <i />
                        </div>
                        <div className="l-deck l-d1">
                          <i />
                          <i />
                        </div>
                        <div className="l-card">
                          <div className="l-c-head">
                            <svg className="l-drag" viewBox="0 0 12 20" aria-hidden="true">
                              <g fill="currentColor">
                                <circle cx="3" cy="4" r="1.6" />
                                <circle cx="9" cy="4" r="1.6" />
                                <circle cx="3" cy="10" r="1.6" />
                                <circle cx="9" cy="10" r="1.6" />
                                <circle cx="3" cy="16" r="1.6" />
                                <circle cx="9" cy="16" r="1.6" />
                              </g>
                            </svg>
                            <div className="l-thumb">
                              <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
                                <g stroke="#d9a24f" strokeWidth="2.4" strokeLinecap="round">
                                  <path d="M3 15h24M8 9v12M22 9v12M5 12v6M25 12v6" />
                                </g>
                              </svg>
                            </div>
                            <div>
                              <div className="l-c-name">{T('lg_name')}</div>
                              <span className="l-pill">{T('lg_musc')}</span>
                            </div>
                          </div>
                          <div className="l-cols">
                            <span>#</span>
                            <span>{T('col_reps')}</span>
                            <span>{T('col_kg')}</span>
                            <span />
                          </div>
                          {(v.rows as any[]).map((r, i) => (
                            <Fragment key={i}>
                              <div className={r.cls}>
                                <span className="l-idx">{r.idx}</span>
                                <span className="l-v">{r.reps}</span>
                                <span className="l-v">{r.kg}</span>
                                <span className="l-kind">{r.kind}</span>
                              </div>
                            </Fragment>
                          ))}
                          <div className="l-rest">
                            <span>{T('rest_l')}</span>
                            <b className="l-cnt" />
                            <span className="l-tr">
                              <u />
                            </span>
                          </div>
                          <div className="l-ghost">
                            <span className="l-idx">{v.gidx}</span>
                            <span className="l-g">6</span>
                            <span className="l-g">85</span>
                            <button type="button" className={v.logCls} onClick={v.logSet}>
                              {T('btn_log')}
                            </button>
                          </div>
                          <button
                            type="button"
                            className="l-undo"
                            style={sv(v.undoStyle)}
                            onClick={v.undoSet}
                          >
                            ↶ {T('btn_undo')}
                          </button>
                        </div>
                      </div>
                      <span className="l-chip l-c2">
                        <span className="l-dot" />
                        <span>{T('rb_mus')}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section id="s-rec" className="l-sc l-alt l-flip" onMouseMove={v.mm}>
          <div className="l-bgx" style={sv(v.bgVars)}>
            <div className="l-bgs">
              <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                <defs>
                  <pattern
                    id="hat"
                    width="9"
                    height="9"
                    patternUnits="userSpaceOnUse"
                    patternTransform="rotate(35)"
                  >
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="9"
                      stroke="#d9a24f"
                      strokeWidth="2.5"
                      strokeOpacity=".22"
                    />
                  </pattern>
                </defs>
                <rect
                  className="l-st"
                  x="110"
                  y="90"
                  width="760"
                  height="40"
                  rx="20"
                  opacity=".3"
                />
                <rect
                  className="l-mbar"
                  style={
                    {
                      '--w': '0.55',
                      animationDelay: '0.0s',
                      animationDuration: '9s',
                      fill: 'url(#hat)',
                      stroke: '#d9a24f',
                      strokeOpacity: '0.4',
                      strokeWidth: '1.2',
                    } as CSSProperties
                  }
                  x="110"
                  y="90"
                  width="760"
                  height="40"
                  rx="20"
                />
                <circle className="l-st" cx="930" cy="110" r="22" opacity=".3" />
                <circle
                  className="l-st l-arc"
                  style={
                    {
                      '--C': '138',
                      strokeDasharray: '138',
                      animationDuration: '10s',
                      animationDelay: '0.0s',
                    } as CSSProperties
                  }
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  cx="930"
                  cy="110"
                  r="22"
                  transform="rotate(-90 930 110)"
                  opacity=".8"
                />
                <rect
                  className="l-st"
                  x="110"
                  y="182"
                  width="760"
                  height="40"
                  rx="20"
                  opacity=".3"
                />
                <rect
                  className="l-mbar"
                  style={
                    {
                      '--w': '0.9',
                      animationDelay: '-1.3s',
                      animationDuration: '11s',
                      fill: 'url(#hat)',
                      stroke: '#d9a24f',
                      strokeOpacity: '0.75',
                      strokeWidth: '2',
                    } as CSSProperties
                  }
                  x="110"
                  y="182"
                  width="760"
                  height="40"
                  rx="20"
                />
                <circle className="l-st" cx="930" cy="202" r="22" opacity=".3" />
                <circle
                  className="l-st l-arc"
                  style={
                    {
                      '--C': '138',
                      strokeDasharray: '138',
                      animationDuration: '12s',
                      animationDelay: '-1.7s',
                    } as CSSProperties
                  }
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  cx="930"
                  cy="202"
                  r="22"
                  transform="rotate(-90 930 202)"
                  opacity=".8"
                />
                <rect
                  className="l-st"
                  x="110"
                  y="274"
                  width="760"
                  height="40"
                  rx="20"
                  opacity=".3"
                />
                <rect
                  className="l-mbar"
                  style={
                    {
                      '--w': '0.4',
                      animationDelay: '-2.6s',
                      animationDuration: '13s',
                      fill: 'url(#hat)',
                      stroke: '#d9a24f',
                      strokeOpacity: '0.4',
                      strokeWidth: '1.2',
                    } as CSSProperties
                  }
                  x="110"
                  y="274"
                  width="760"
                  height="40"
                  rx="20"
                />
                <circle className="l-st" cx="930" cy="294" r="22" opacity=".3" />
                <circle
                  className="l-st l-arc"
                  style={
                    {
                      '--C': '138',
                      strokeDasharray: '138',
                      animationDuration: '14s',
                      animationDelay: '-3.4s',
                    } as CSSProperties
                  }
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  cx="930"
                  cy="294"
                  r="22"
                  transform="rotate(-90 930 294)"
                  opacity=".8"
                />
                <rect
                  className="l-st"
                  x="110"
                  y="366"
                  width="760"
                  height="40"
                  rx="20"
                  opacity=".3"
                />
                <rect
                  className="l-mbar"
                  style={
                    {
                      '--w': '0.75',
                      animationDelay: '-3.9000000000000004s',
                      animationDuration: '9s',
                      fill: 'url(#hat)',
                      stroke: '#d9a24f',
                      strokeOpacity: '0.4',
                      strokeWidth: '1.2',
                    } as CSSProperties
                  }
                  x="110"
                  y="366"
                  width="760"
                  height="40"
                  rx="20"
                />
                <circle className="l-st" cx="930" cy="386" r="22" opacity=".3" />
                <circle
                  className="l-st l-arc"
                  style={
                    {
                      '--C': '138',
                      strokeDasharray: '138',
                      animationDuration: '16s',
                      animationDelay: '-5.1s',
                    } as CSSProperties
                  }
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  cx="930"
                  cy="386"
                  r="22"
                  transform="rotate(-90 930 386)"
                  opacity=".8"
                />
                <rect
                  className="l-st"
                  x="110"
                  y="458"
                  width="760"
                  height="40"
                  rx="20"
                  opacity=".3"
                />
                <rect
                  className="l-mbar"
                  style={
                    {
                      '--w': '1.0',
                      animationDelay: '-5.2s',
                      animationDuration: '11s',
                      fill: 'url(#hat)',
                      stroke: '#d9a24f',
                      strokeOpacity: '0.75',
                      strokeWidth: '2',
                    } as CSSProperties
                  }
                  x="110"
                  y="458"
                  width="760"
                  height="40"
                  rx="20"
                />
                <circle className="l-st" cx="930" cy="478" r="22" opacity=".3" />
                <circle
                  className="l-st l-arc"
                  style={
                    {
                      '--C': '138',
                      strokeDasharray: '138',
                      animationDuration: '10s',
                      animationDelay: '-6.8s',
                    } as CSSProperties
                  }
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  cx="930"
                  cy="478"
                  r="22"
                  transform="rotate(-90 930 478)"
                  opacity=".8"
                />
                <rect
                  className="l-st"
                  x="110"
                  y="550"
                  width="760"
                  height="40"
                  rx="20"
                  opacity=".3"
                />
                <rect
                  className="l-mbar"
                  style={
                    {
                      '--w': '0.3',
                      animationDelay: '-6.5s',
                      animationDuration: '13s',
                      fill: 'url(#hat)',
                      stroke: '#d9a24f',
                      strokeOpacity: '0.4',
                      strokeWidth: '1.2',
                    } as CSSProperties
                  }
                  x="110"
                  y="550"
                  width="760"
                  height="40"
                  rx="20"
                />
                <circle className="l-st" cx="930" cy="570" r="22" opacity=".3" />
                <circle
                  className="l-st l-arc"
                  style={
                    {
                      '--C': '138',
                      strokeDasharray: '138',
                      animationDuration: '12s',
                      animationDelay: '-8.5s',
                    } as CSSProperties
                  }
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  cx="930"
                  cy="570"
                  r="22"
                  transform="rotate(-90 930 570)"
                  opacity=".8"
                />
                <rect
                  className="l-st"
                  x="110"
                  y="642"
                  width="760"
                  height="40"
                  rx="20"
                  opacity=".3"
                />
                <rect
                  className="l-mbar"
                  style={
                    {
                      '--w': '0.65',
                      animationDelay: '-7.800000000000001s',
                      animationDuration: '9s',
                      fill: 'url(#hat)',
                      stroke: '#d9a24f',
                      strokeOpacity: '0.4',
                      strokeWidth: '1.2',
                    } as CSSProperties
                  }
                  x="110"
                  y="642"
                  width="760"
                  height="40"
                  rx="20"
                />
                <circle className="l-st" cx="930" cy="662" r="22" opacity=".3" />
                <circle
                  className="l-st l-arc"
                  style={
                    {
                      '--C': '138',
                      strokeDasharray: '138',
                      animationDuration: '14s',
                      animationDelay: '-10.2s',
                    } as CSSProperties
                  }
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  cx="930"
                  cy="662"
                  r="22"
                  transform="rotate(-90 930 662)"
                  opacity=".8"
                />
                <rect
                  className="l-st"
                  x="110"
                  y="734"
                  width="760"
                  height="40"
                  rx="20"
                  opacity=".3"
                />
                <rect
                  className="l-mbar"
                  style={
                    {
                      '--w': '0.86',
                      animationDelay: '-9.1s',
                      animationDuration: '11s',
                      fill: 'url(#hat)',
                      stroke: '#d9a24f',
                      strokeOpacity: '0.75',
                      strokeWidth: '2',
                    } as CSSProperties
                  }
                  x="110"
                  y="734"
                  width="760"
                  height="40"
                  rx="20"
                />
                <circle className="l-st" cx="930" cy="754" r="22" opacity=".3" />
                <circle
                  className="l-st l-arc"
                  style={
                    {
                      '--C': '138',
                      strokeDasharray: '138',
                      animationDuration: '16s',
                      animationDelay: '-11.9s',
                    } as CSSProperties
                  }
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  cx="930"
                  cy="754"
                  r="22"
                  transform="rotate(-90 930 754)"
                  opacity=".8"
                />
                <rect
                  className="l-st"
                  x="110"
                  y="826"
                  width="760"
                  height="40"
                  rx="20"
                  opacity=".3"
                />
                <rect
                  className="l-mbar"
                  style={
                    {
                      '--w': '0.5',
                      animationDelay: '-10.4s',
                      animationDuration: '13s',
                      fill: 'url(#hat)',
                      stroke: '#d9a24f',
                      strokeOpacity: '0.4',
                      strokeWidth: '1.2',
                    } as CSSProperties
                  }
                  x="110"
                  y="826"
                  width="760"
                  height="40"
                  rx="20"
                />
                <circle className="l-st" cx="930" cy="846" r="22" opacity=".3" />
                <circle
                  className="l-st l-arc"
                  style={
                    {
                      '--C': '138',
                      strokeDasharray: '138',
                      animationDuration: '10s',
                      animationDelay: '-13.6s',
                    } as CSSProperties
                  }
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  cx="930"
                  cy="846"
                  r="22"
                  transform="rotate(-90 930 846)"
                  opacity=".8"
                />
                <line
                  className="l-st"
                  strokeDasharray="7 9"
                  strokeWidth="2"
                  x1="718"
                  y1="60"
                  x2="718"
                  y2="940"
                  opacity=".7"
                />
              </svg>
            </div>
          </div>
          <div className="l-wrap">
            <div className="l-grid">
              <div className="l-txt l-rv">
                <div className="l-kk l-fm">
                  <b>02</b>
                  <span>/ 08</span>
                  <i />
                  {T('c_k')}
                </div>
                <h2 className="l-h2 l-fd">{T('c_h')}</h2>
                <p className="l-lead">{T('c_p')}</p>
                <ul className="l-fts">
                  <li>
                    <span className="l-fi">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M5 20V10M12 20V4M19 20v-7" />
                      </svg>
                    </span>
                    <span>{T('c_1')}</span>
                  </li>
                  <li>
                    <span className="l-fi">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="12" r="8" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </span>
                    <span>{T('c_2')}</span>
                  </li>
                </ul>
              </div>
              <div className="l-gx">
                <div
                  className="l-tilt l-tilt-l"
                  style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  <AnatomyXray label={T('k94')} />
                </div>
              </div>
            </div>
          </div>
        </section>
        <section id="s-pro" className="l-sc" onMouseMove={v.mm}>
          <div className="l-bgx" style={sv(v.bgVars)}>
            <div className="l-bgs">
              <div className="l-g-grid" />
              <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                <path
                  className="l-st l-draw"
                  pathLength="1"
                  style={{ animationDelay: '0.0s' }}
                  strokeWidth="2"
                  d="M60 800 L180 760 L260 770 L360 690 L450 700 L560 600 L650 620 L760 480 L880 440"
                  opacity=".6"
                />
                <path
                  className="l-sd l-pop"
                  style={{ animationDelay: '-6.4s', animationDuration: '7s' }}
                  d="M880 427 L893 440 L880 453 L867 440 Z"
                />
                <path
                  className="l-sd l-pop"
                  style={{ animationDelay: '-4.8s', animationDuration: '7s' }}
                  d="M650 607 L663 620 L650 633 L637 620 Z"
                />
                <line
                  className="l-st"
                  strokeDasharray="3 9"
                  x1="60"
                  y1="620"
                  x2="940"
                  y2="620"
                  opacity=".25"
                />
                <path
                  className="l-st l-draw"
                  pathLength="1"
                  style={{ animationDelay: '-2.2s' }}
                  strokeWidth="2"
                  d="M60 890 L200 850 L300 860 L420 800 L520 790 L640 720 L760 730 L900 650"
                  opacity=".6"
                />
                <path
                  className="l-sd l-pop"
                  style={{ animationDelay: '-7.3s', animationDuration: '7s' }}
                  d="M900 637 L913 650 L900 663 L887 650 Z"
                />
                <path
                  className="l-sd l-pop"
                  style={{ animationDelay: '-5.7s', animationDuration: '7s' }}
                  d="M640 707 L653 720 L640 733 L627 720 Z"
                />
                <line
                  className="l-st"
                  strokeDasharray="3 9"
                  x1="60"
                  y1="720"
                  x2="940"
                  y2="720"
                  opacity=".25"
                />
                <path
                  className="l-st l-draw"
                  pathLength="1"
                  style={{ animationDelay: '-4.4s' }}
                  strokeWidth="2"
                  d="M60 700 L160 690 L280 640 L380 650 L500 560 L620 540 L720 430 L820 440 L940 300"
                  opacity=".6"
                />
                <path
                  className="l-sd l-pop"
                  style={{ animationDelay: '-9.8s', animationDuration: '7s' }}
                  d="M940 287 L953 300 L940 313 L927 300 Z"
                />
                <path
                  className="l-sd l-pop"
                  style={{ animationDelay: '-8.2s', animationDuration: '7s' }}
                  d="M720 417 L733 430 L720 443 L707 430 Z"
                />
                <line
                  className="l-st"
                  strokeDasharray="3 9"
                  x1="60"
                  y1="430"
                  x2="940"
                  y2="430"
                  opacity=".25"
                />
              </svg>
            </div>
          </div>
          <div className="l-wrap">
            <div className="l-grid">
              <div className="l-txt l-rv">
                <div className="l-kk l-fm">
                  <b>03</b>
                  <span>/ 08</span>
                  <i />
                  {T('m_k')}
                </div>
                <h2 className="l-h2 l-fd">{T('m_h')}</h2>
                <p className="l-lead">{T('m_p')}</p>
                <ul className="l-fts">
                  <li>
                    <span className="l-fi">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
                      </svg>
                    </span>
                    <span>{T('m_1')}</span>
                  </li>
                  <li>
                    <span className="l-fi">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="6" cy="18" r="2" />
                        <circle cx="18" cy="6" r="2" />
                        <path d="M8 18h5a3 3 0 000-6h-2a3 3 0 010-6h5" />
                      </svg>
                    </span>
                    <span>{T('m_2')}</span>
                  </li>
                </ul>
              </div>
              <div className="l-gx">
                <div
                  className="l-tilt l-tilt-r"
                  style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  <AnatomyTurn label={T('k231')} />
                  <div className="l-rank">
                    <div className="l-rank-top">
                      <span>{T('m_rm')} · kg</span>
                    </div>
                    <div className="l-prr">
                      <span>{T('pr_e1')}</span>
                      <b>102.5</b>
                      <i className="l-prb">{T('m_pr')}</i>
                    </div>
                    <div className="l-prr">
                      <span>{T('pr_e2')}</span>
                      <b>87</b>
                      <i />
                    </div>
                    <div className="l-prr">
                      <span>{T('pr_e3')}</span>
                      <b>61</b>
                      <i />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section id="s-rest" className="l-sc l-alt l-flip" onMouseMove={v.mm}>
          <div className="l-bgx" style={sv(v.bgVars)}>
            <div className="l-bgs l-flat">
              <div className="l-g-grid" />
              <div className="l-ecgbg">
                <EcgBg />
              </div>
            </div>
          </div>
          <div className="l-wrap">
            <div className="l-grid">
              <div className="l-txt l-rv">
                <div className="l-kk l-fm">
                  <b>04</b>
                  <span>/ 08</span>
                  <i />
                  {T('rest_k')}
                </div>
                <h2 className="l-h2 l-fd">{T('r_h')}</h2>
                <p className="l-lead">{T('r_p')}</p>
              </div>
              <div className="l-gx">
                <div
                  className="l-tilt l-tilt-l"
                  style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  <div className="l-rcard">
                    <div className="l-ring">
                      <svg viewBox="0 0 200 200" aria-hidden="true">
                        <circle
                          cx="100"
                          cy="100"
                          r="88"
                          fill="none"
                          stroke="#2a2b30"
                          strokeWidth="10"
                        />
                        <circle
                          className="l-rp"
                          style={sv(v.ringStyle)}
                          cx="100"
                          cy="100"
                          r="88"
                          fill="none"
                          stroke="#d9a24f"
                          strokeWidth="10"
                          strokeLinecap="round"
                          transform="rotate(-90 100 100)"
                        />
                      </svg>
                      <div className="l-mid">
                        {v.restDef && (
                          <>
                            <div className="l-big l-cnt" />
                          </>
                        )}
                        {v.restMod && (
                          <>
                            <div className="l-big">{v.restTot}</div>
                          </>
                        )}
                        <div className="l-sm">
                          {T('rest_l')} · {v.restTot}
                        </div>
                      </div>
                    </div>
                    <div className="l-brk">
                      <span>{T('rb_base')}</span>
                      <b>2:00</b>
                    </div>
                    <button
                      type="button"
                      className={`l-brk l-tg ${v.rc1}`}
                      onClick={v.rt1}
                      aria-pressed={v.rp1}
                    >
                      <span>{T('rb_rpe')}</span>
                      <b>+0:30</b>
                    </button>
                    <button
                      type="button"
                      className={`l-brk l-tg ${v.rc2}`}
                      onClick={v.rt2}
                      aria-pressed={v.rp2}
                    >
                      <span>{T('rb_mus')}</span>
                      <b>+0:20</b>
                    </button>
                    <button
                      type="button"
                      className={`l-brk l-tg ${v.rc3}`}
                      onClick={v.rt3}
                      aria-pressed={v.rp3}
                    >
                      <span>{T('rb_slp')}</span>
                      <b>+0:10</b>
                    </button>
                    <div className="l-brk l-tot">
                      <span>{T('rb_tot')}</span>
                      <b>{v.restTot}</b>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="l-pband">
              <div className="l-chs">
                <div className="l-chn">
                  <div className="l-fm l-chn-h">
                    <span>CH 01</span>
                    <span className="l-led">●</span>
                  </div>
                  <p>{T('r_1')}</p>
                </div>
                <div className="l-chn">
                  <div className="l-fm l-chn-h">
                    <span>CH 02</span>
                    <span className="l-led">●</span>
                  </div>
                  <p>{T('r_2')}</p>
                </div>
                <div className="l-chn">
                  <div className="l-fm l-chn-h">
                    <span>CH 03</span>
                    <span className="l-led">●</span>
                  </div>
                  <p>{T('r_3')}</p>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section id="s-atl" className="l-sc" onMouseMove={v.mm}>
          <div className="l-bgx" style={sv(v.bgVars)}>
            <div className="l-bgs">
              <AtlasNet />
            </div>
          </div>
          <div className="l-wrap">
            <div className="l-grid">
              <div className="l-txt l-rv">
                <div className="l-kk l-fm">
                  <b>05</b>
                  <span>/ 08</span>
                  <i />
                  {T('atlas_k')}
                </div>
                <h2 className="l-h2 l-fd">{T('t_h')}</h2>
                <p className="l-lead">{T('t_p')}</p>
                <ul className="l-fts">
                  <li>
                    <span className="l-fi">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M2 9a15 15 0 0120 0M5 13a10 10 0 0114 0M9 17a5 5 0 016 0" />
                        <path d="M12 20h.01M3 3l18 18" />
                      </svg>
                    </span>
                    <span>{T('t_1')}</span>
                  </li>
                </ul>
              </div>
              <div className="l-gx">
                <div
                  className="l-tilt l-tilt-r"
                  style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  {v.aiA && (
                    <>
                      <div className="l-chat l-aiw">
                        <div className="l-ch-head">
                          <AtlasFace temper={3} size={40} />
                          <b className="l-fd" style={{ fontSize: '18px' }}>
                            Atlas
                          </b>
                          <span className="l-ai-off l-fm">{T('ai_off')}</span>
                          <button
                            type="button"
                            className="l-ai-rp"
                            onClick={v.aiReplay}
                            aria-label="Replay"
                          >
                            ↻
                          </button>
                        </div>
                        <div className="l-b-u l-ai-q1">{T('t_q1')}</div>
                        <div className="l-ai-turn">
                          <div className="l-ai-th">
                            <div className="l-ai-t">
                              <i />
                              <i />
                              <i />
                              <span className="l-fm">{T('ai_t')}</span>
                            </div>
                            <div className="l-ai-cs">
                              <span className="l-ai-c l-ai-c1">{T('ai_s1')}</span>
                              <span className="l-ai-c l-ai-c2">{T('ai_s2')}</span>
                              <span className="l-ai-c l-ai-c3">{T('ai_s3')}</span>
                            </div>
                          </div>
                          <div className="l-b-a l-ai-a1">
                            {T('t_a1')}
                            <span className="l-caret l-c1" />
                            <div className="l-src">{T('t_s1')}</div>
                          </div>
                        </div>
                        <div className="l-b-u l-ai-q2">{T('t_q2')}</div>
                        <div className="l-ai-turn">
                          <div className="l-ai-th l-ai-th2">
                            <div className="l-ai-t">
                              <i />
                              <i />
                              <i />
                              <span className="l-fm">{T('ai_t')}</span>
                            </div>
                            <div className="l-ai-cs">
                              <span className="l-ai-c l-ai-c4">{T('ai_s4')}</span>
                              <span className="l-ai-c l-ai-c5">{T('ai_s5')}</span>
                            </div>
                          </div>
                          <div className="l-b-a l-ai-a2">
                            {T('t_a2')}
                            <span className="l-caret l-c2" />
                          </div>
                        </div>
                        <div className="l-ai-in">
                          <span>{T('ai_ph')}</span>
                          <i />
                        </div>
                      </div>
                    </>
                  )}
                  {v.aiB && (
                    <>
                      <div className="l-chat l-aiw">
                        <div className="l-ch-head">
                          <AtlasFace temper={3} size={40} />
                          <b className="l-fd" style={{ fontSize: '18px' }}>
                            Atlas
                          </b>
                          <span className="l-ai-off l-fm">{T('ai_off')}</span>
                          <button
                            type="button"
                            className="l-ai-rp"
                            onClick={v.aiReplay}
                            aria-label="Replay"
                          >
                            ↻
                          </button>
                        </div>
                        <div className="l-b-u l-ai-q1">{T('t_q1')}</div>
                        <div className="l-ai-turn">
                          <div className="l-ai-th">
                            <div className="l-ai-t">
                              <i />
                              <i />
                              <i />
                              <span className="l-fm">{T('ai_t')}</span>
                            </div>
                            <div className="l-ai-cs">
                              <span className="l-ai-c l-ai-c1">{T('ai_s1')}</span>
                              <span className="l-ai-c l-ai-c2">{T('ai_s2')}</span>
                              <span className="l-ai-c l-ai-c3">{T('ai_s3')}</span>
                            </div>
                          </div>
                          <div className="l-b-a l-ai-a1">
                            {T('t_a1')}
                            <span className="l-caret l-c1" />
                            <div className="l-src">{T('t_s1')}</div>
                          </div>
                        </div>
                        <div className="l-b-u l-ai-q2">{T('t_q2')}</div>
                        <div className="l-ai-turn">
                          <div className="l-ai-th l-ai-th2">
                            <div className="l-ai-t">
                              <i />
                              <i />
                              <i />
                              <span className="l-fm">{T('ai_t')}</span>
                            </div>
                            <div className="l-ai-cs">
                              <span className="l-ai-c l-ai-c4">{T('ai_s4')}</span>
                              <span className="l-ai-c l-ai-c5">{T('ai_s5')}</span>
                            </div>
                          </div>
                          <div className="l-b-a l-ai-a2">
                            {T('t_a2')}
                            <span className="l-caret l-c2" />
                          </div>
                        </div>
                        <div className="l-ai-in">
                          <span>{T('ai_ph')}</span>
                          <i />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
        <section id="s-prog" className="l-sc l-alt l-flip" onMouseMove={v.mm}>
          <div className="l-bgx" style={sv(v.bgVars)}>
            <div className="l-bgs">
              <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                <CalGrid />
              </svg>
            </div>
          </div>
          <div className="l-wrap">
            <div className="l-grid">
              <div className="l-txt l-rv">
                <div className="l-kk l-fm">
                  <b>06</b>
                  <span>/ 08</span>
                  <i />
                  {T('p_k')}
                </div>
                <h2 className="l-h2 l-fd">{T('p_h')}</h2>
                <p className="l-lead">{T('p_p')}</p>
                <ul className="l-fts">
                  <li>
                    <span className="l-fi">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <path d="M3 7l9 6 9-6" />
                      </svg>
                    </span>
                    <span>{T('p_1')}</span>
                  </li>
                  <li>
                    <span className="l-fi">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <rect x="3" y="4" width="18" height="16" rx="2" />
                        <path d="M3 10h18M9 4v16" />
                      </svg>
                    </span>
                    <span>{T('p_2')}</span>
                  </li>
                  <li>
                    <span className="l-fi">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z" />
                        <circle cx="12" cy="10" r="2.5" />
                      </svg>
                    </span>
                    <span>{T('p_3')}</span>
                  </li>
                </ul>
              </div>
              <div className="l-gx">
                <div
                  className="l-tilt l-tilt-l"
                  style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  <div className="l-pcard">
                    <div className="l-pc-top">
                      <span className="l-pc-day l-fd">{T('pr_day')}</span>
                      <span className="l-pill" style={{ margin: '0' }}>
                        {T('pr_by')}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={`l-prow ${v.pc1}`}
                      onClick={v.pk1}
                      aria-pressed={v.pq1}
                    >
                      <span className="l-pn">1</span>
                      <span className="l-pt" />
                      <span className="l-pnm">{T('pr_e1')}</span>
                      <span className="l-psets">4 × 6–8</span>
                    </button>
                    <button
                      type="button"
                      className={`l-prow ${v.pc2}`}
                      onClick={v.pk2}
                      aria-pressed={v.pq2}
                    >
                      <span className="l-pn">2</span>
                      <span className="l-pt" />
                      <span className="l-pnm">{T('pr_e2')}</span>
                      <span className="l-psets">4 × 8</span>
                    </button>
                    <button
                      type="button"
                      className={`l-prow ${v.pc3}`}
                      onClick={v.pk3}
                      aria-pressed={v.pq3}
                    >
                      <span className="l-pn">3</span>
                      <span className="l-pt" />
                      <span className="l-pnm">{T('pr_e3')}</span>
                      <span className="l-psets">3 × 8–10</span>
                    </button>
                    <button
                      type="button"
                      className={`l-prow ${v.pc4}`}
                      onClick={v.pk4}
                      aria-pressed={v.pq4}
                    >
                      <span className="l-pn">4</span>
                      <span className="l-pt" />
                      <span className="l-pnm">{T('pr_e4')}</span>
                      <span className="l-psets">3 × 10–12</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section id="s-ret" className="l-sc" onMouseMove={v.mm}>
          <div className="l-bgx" style={sv(v.bgVars)}>
            <div className="l-bgs">
              <div className="l-glow" style={{ right: '0', top: '0' }} />
              <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                <path
                  className="l-st l-flow"
                  strokeDasharray="3 14"
                  strokeWidth="2"
                  d="M110 810 L330 720 L480 580 L640 430 L800 290 L930 170"
                />
                <circle className="l-sd l-rn l-rn0" cx="330" cy="720" r="11" />
                <circle className="l-st" cx="330" cy="720" r="26" opacity=".5" />
                <circle className="l-st l-rw l-rw0" cx="330" cy="720" r="60" />
                <circle className="l-sd l-rn l-rn1" cx="480" cy="580" r="11" />
                <circle className="l-st" cx="480" cy="580" r="26" opacity=".5" />
                <circle className="l-st l-rw l-rw1" cx="480" cy="580" r="60" />
                <circle className="l-sd l-rn l-rn2" cx="640" cy="430" r="11" />
                <circle className="l-st" cx="640" cy="430" r="26" opacity=".5" />
                <circle className="l-st l-rw l-rw2" cx="640" cy="430" r="60" />
                <circle className="l-sd l-rn l-rn3" cx="800" cy="290" r="11" />
                <circle className="l-st" cx="800" cy="290" r="26" opacity=".5" />
                <circle className="l-st l-rw l-rw3" cx="800" cy="290" r="60" />
                <circle r="9" className="l-sd l-rdot" />
                <circle r="22" fill="none" stroke="#d9a24f" strokeOpacity=".5" className="l-rdot" />
              </svg>
            </div>
          </div>
          <div className="l-wrap">
            <div className="l-grid">
              <div className="l-txt l-rv">
                <div className="l-kk l-fm">
                  <b>07</b>
                  <span>/ 08</span>
                  <i />
                  {T('i_k')}
                </div>
                <h2 className="l-h2 l-fd">{T('i_h')}</h2>
                <p className="l-lead">{T('i_p')}</p>
                <ul className="l-fts">
                  <li>
                    <span className="l-fi">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <rect x="3" y="5" width="18" height="16" rx="2" />
                        <path d="M3 10h18M8 3v4M16 3v4" />
                      </svg>
                    </span>
                    <span>{T('i_1')}</span>
                  </li>
                </ul>
              </div>
              <div className="l-gx">
                <div
                  className="l-tilt l-tilt-r"
                  style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  <div className="l-phs">
                    <div className="l-ph-list">
                      <div className="l-ph-line">
                        <u />
                      </div>
                      <div className="l-ph l-done">
                        <span className="l-ph-d" />
                        <span className="l-ph-n l-fd">Protect</span>
                        <span className="l-ph-s">{T('ph_done')}</span>
                      </div>
                      <div className="l-ph l-now">
                        <span className="l-ph-d" />
                        <span className="l-ph-n l-fd">Reintroduce</span>
                        <span className="l-ph-s">{T('ph_now')}</span>
                      </div>
                      <div className="l-ph l-next">
                        <span className="l-ph-d" />
                        <span className="l-ph-n l-fd">Rebuild</span>
                        <span className="l-ph-s">{T('ph_next')}</span>
                      </div>
                      <div className="l-ph l-next">
                        <span className="l-ph-d" />
                        <span className="l-ph-n l-fd">Return</span>
                        <span className="l-ph-s">{T('ph_next')}</span>
                      </div>
                    </div>
                    <div className="l-back">
                      <b>{T('ph_c1')}</b>
                      <span>{T('ph_c2')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section id="s-all" className="l-sc l-alt l-flip" onMouseMove={v.mm}>
          <div className="l-bgx" style={sv(v.bgVars)}>
            <div className="l-bgs">
              <svg viewBox="20 15 1145 975" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                <circle
                  className="l-st l-sp l-wave"
                  style={{ animationDelay: '0.0s' }}
                  cx="905"
                  cy="734"
                  r="150"
                />
                <circle
                  className="l-st l-sp l-wave"
                  style={{ animationDelay: '-2.6s' }}
                  cx="905"
                  cy="734"
                  r="150"
                />
                <circle
                  className="l-st l-sp l-wave"
                  style={{ animationDelay: '-5.2s' }}
                  cx="905"
                  cy="734"
                  r="150"
                />
                <path
                  className="l-st l-flow"
                  strokeDasharray="4 10"
                  d="M180 235 Q502 434 905 734"
                  opacity=".4"
                />
                <path
                  className="l-st l-flow"
                  strokeDasharray="4 10"
                  d="M755 160 Q870 397 905 734"
                  opacity=".4"
                />
                <path
                  className="l-st l-flow"
                  strokeDasharray="4 10"
                  d="M255 780 Q540 707 905 734"
                  opacity=".4"
                />
                <path
                  className="l-st l-flow"
                  strokeDasharray="4 10"
                  d="M560 800 Q772 717 905 734"
                  opacity=".4"
                />
                <g transform="translate(60 150) rotate(-8) scale(1)">
                  <g className="l-fl" style={{ animationDelay: '0.0s', animationDuration: '8.0s' }}>
                    <rect
                      className="l-st"
                      style={{ fill: '#1a1b1e' }}
                      x="0"
                      y="0"
                      width="240"
                      height="170"
                      rx="18"
                    />
                    <circle className="l-sd" cx="120" cy="156" r="3" />
                    <line
                      className="l-st l-pop"
                      style={{ animationDelay: '-0.0s', animationDuration: '6s' }}
                      strokeWidth="5"
                      strokeLinecap="round"
                      x1="35"
                      y1="38"
                      x2="185"
                      y2="38"
                    />
                    <line
                      className="l-st l-pop"
                      style={{ animationDelay: '-1.4s', animationDuration: '6s' }}
                      strokeWidth="5"
                      strokeLinecap="round"
                      x1="35"
                      y1="72"
                      x2="163"
                      y2="72"
                    />
                    <line
                      className="l-st l-pop"
                      style={{ animationDelay: '-2.8s', animationDuration: '6s' }}
                      strokeWidth="5"
                      strokeLinecap="round"
                      x1="35"
                      y1="106"
                      x2="141"
                      y2="106"
                    />
                  </g>
                </g>
                <g transform="translate(700 40) rotate(11) scale(1)">
                  <g
                    className="l-fl"
                    style={{ animationDelay: '-2.3s', animationDuration: '9.7s' }}
                  >
                    <rect
                      className="l-st"
                      style={{ fill: '#1a1b1e' }}
                      x="0"
                      y="0"
                      width="110"
                      height="230"
                      rx="22"
                    />
                    <line
                      className="l-st l-pop"
                      style={{ animationDelay: '-0.6s', animationDuration: '6s' }}
                      strokeWidth="5"
                      strokeLinecap="round"
                      x1="25"
                      y1="55"
                      x2="87"
                      y2="55"
                    />
                    <line
                      className="l-st l-pop"
                      style={{ animationDelay: '-2.0s', animationDuration: '6s' }}
                      strokeWidth="5"
                      strokeLinecap="round"
                      x1="25"
                      y1="97"
                      x2="73"
                      y2="97"
                    />
                    <line
                      className="l-st l-pop"
                      style={{ animationDelay: '-3.4s', animationDuration: '6s' }}
                      strokeWidth="5"
                      strokeLinecap="round"
                      x1="25"
                      y1="139"
                      x2="59"
                      y2="139"
                    />
                  </g>
                </g>
                <g transform="translate(110 690) rotate(4) scale(1)">
                  <g
                    className="l-fl"
                    style={{ animationDelay: '-4.6s', animationDuration: '11.4s' }}
                  >
                    <rect
                      className="l-st"
                      style={{ fill: '#1a1b1e' }}
                      x="0"
                      y="0"
                      width="290"
                      height="180"
                      rx="12"
                    />
                    <rect
                      className="l-st"
                      style={{ fill: '#1a1b1e' }}
                      x="-30"
                      y="188"
                      width="350"
                      height="14"
                      rx="7"
                    />
                    <line
                      className="l-st l-pop"
                      style={{ animationDelay: '-1.1s', animationDuration: '6s' }}
                      strokeWidth="5"
                      strokeLinecap="round"
                      x1="35"
                      y1="48"
                      x2="235"
                      y2="48"
                    />
                    <line
                      className="l-st l-pop"
                      style={{ animationDelay: '-2.5s', animationDuration: '6s' }}
                      strokeWidth="5"
                      strokeLinecap="round"
                      x1="35"
                      y1="86"
                      x2="207"
                      y2="86"
                    />
                    <line
                      className="l-st l-pop"
                      style={{ animationDelay: '-3.9s', animationDuration: '6s' }}
                      strokeWidth="5"
                      strokeLinecap="round"
                      x1="35"
                      y1="124"
                      x2="179"
                      y2="124"
                    />
                  </g>
                </g>
                <g transform="translate(430 720) rotate(-6) scale(0.85)">
                  <g
                    className="l-fl"
                    style={{ animationDelay: '-6.8999999999999995s', animationDuration: '13.1s' }}
                  >
                    <rect
                      className="l-st"
                      style={{ fill: '#1a1b1e' }}
                      x="0"
                      y="0"
                      width="300"
                      height="190"
                      rx="12"
                    />
                    <line className="l-st" x1="0" y1="38" x2="300" y2="38" />
                    <circle className="l-sd" cx="20" cy="19" r="4" />
                    <circle className="l-sd" cx="36" cy="19" r="4" />
                    <circle className="l-sd" cx="52" cy="19" r="4" />
                    <line
                      className="l-st l-pop"
                      style={{ animationDelay: '-1.7s', animationDuration: '6s' }}
                      strokeWidth="5"
                      strokeLinecap="round"
                      x1="30"
                      y1="72"
                      x2="240"
                      y2="72"
                    />
                    <line
                      className="l-st l-pop"
                      style={{ animationDelay: '-3.1s', animationDuration: '6s' }}
                      strokeWidth="5"
                      strokeLinecap="round"
                      x1="30"
                      y1="108"
                      x2="210"
                      y2="108"
                    />
                    <line
                      className="l-st l-pop"
                      style={{ animationDelay: '-4.5s', animationDuration: '6s' }}
                      strokeWidth="5"
                      strokeLinecap="round"
                      x1="30"
                      y1="144"
                      x2="180"
                      y2="144"
                    />
                  </g>
                </g>
                <g transform="translate(830 640) rotate(-5) scale(1)">
                  <g
                    className="l-fl"
                    style={{ animationDelay: '-9.2s', animationDuration: '14.8s' }}
                  >
                    <rect
                      className="l-st"
                      style={{ fill: '#201f1d' }}
                      x="0"
                      y="0"
                      width="150"
                      height="56"
                      rx="10"
                    />
                    <circle
                      className="l-sd l-pop"
                      style={{ animationDelay: '0.0s', animationDuration: '3s' }}
                      cx="27"
                      cy="28"
                      r="5"
                    />
                    <circle
                      className="l-sd l-pop"
                      style={{ animationDelay: '-0.5s', animationDuration: '3s' }}
                      cx="45"
                      cy="28"
                      r="5"
                    />
                    <line className="l-st" x1="80" y1="28" x2="126" y2="28" strokeDasharray="2 6" />
                    <rect
                      className="l-st"
                      style={{ fill: '#201f1d' }}
                      x="0"
                      y="66"
                      width="150"
                      height="56"
                      rx="10"
                    />
                    <circle
                      className="l-sd l-pop"
                      style={{ animationDelay: '-1.1s', animationDuration: '3s' }}
                      cx="27"
                      cy="94"
                      r="5"
                    />
                    <circle
                      className="l-sd l-pop"
                      style={{ animationDelay: '-1.6s', animationDuration: '3s' }}
                      cx="45"
                      cy="94"
                      r="5"
                    />
                    <line className="l-st" x1="80" y1="94" x2="126" y2="94" strokeDasharray="2 6" />
                    <rect
                      className="l-st"
                      style={{ fill: '#201f1d' }}
                      x="0"
                      y="132"
                      width="150"
                      height="56"
                      rx="10"
                    />
                    <circle
                      className="l-sd l-pop"
                      style={{ animationDelay: '-2.2s', animationDuration: '3s' }}
                      cx="27"
                      cy="160"
                      r="5"
                    />
                    <circle
                      className="l-sd l-pop"
                      style={{ animationDelay: '-2.7s', animationDuration: '3s' }}
                      cx="45"
                      cy="160"
                      r="5"
                    />
                    <line
                      className="l-st"
                      x1="80"
                      y1="160"
                      x2="126"
                      y2="160"
                      strokeDasharray="2 6"
                    />
                  </g>
                </g>
                <circle className="l-sd" r="7">
                  <animateMotion
                    dur="4.0s"
                    repeatCount="indefinite"
                    begin="0.0s"
                    path="M180 235 Q502 434 905 734"
                    keyPoints="0;1"
                    keyTimes="0;1"
                    calcMode="linear"
                  />
                </circle>
                <circle className="l-sd" r="7">
                  <animateMotion
                    dur="4.9s"
                    repeatCount="indefinite"
                    begin="-1.1s"
                    path="M755 160 Q870 397 905 734"
                    keyPoints="0;1"
                    keyTimes="0;1"
                    calcMode="linear"
                  />
                </circle>
                <circle className="l-sd" r="7">
                  <animateMotion
                    dur="5.8s"
                    repeatCount="indefinite"
                    begin="-2.2s"
                    path="M255 780 Q540 707 905 734"
                    keyPoints="0;1"
                    keyTimes="0;1"
                    calcMode="linear"
                  />
                </circle>
                <circle className="l-sd" r="7">
                  <animateMotion
                    dur="6.7s"
                    repeatCount="indefinite"
                    begin="-3.3000000000000003s"
                    path="M560 800 Q772 717 905 734"
                    keyPoints="0;1"
                    keyTimes="0;1"
                    calcMode="linear"
                  />
                </circle>
                <EverywhereFx />
              </svg>
            </div>
          </div>
          <div className="l-wrap">
            <div className="l-grid">
              <div className="l-txt l-rv">
                <div className="l-kk l-fm">
                  <b>08</b>
                  <span>/ 08</span>
                  <i />
                  {T('e_k')}
                </div>
                <h2 className="l-h2 l-fd">{T('e_h')}</h2>
                <p className="l-lead">{T('e_p')}</p>
              </div>
              <div className="l-gx">
                <div
                  className="l-tilt l-tilt-l"
                  style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  <div className="l-tiles">
                    <div className="l-tile">
                      <b className="l-fd">{T('e_t1')}</b>
                      <p>{T('e_d1')}</p>
                    </div>
                    <div className="l-tile">
                      <b className="l-fd">{T('e_t2')}</b>
                      <p>{T('e_d2')}</p>
                    </div>
                    <div className="l-tile">
                      <b className="l-fd">{T('e_t3')}</b>
                      <p>{T('e_d3')}</p>
                    </div>
                    <div className="l-tile">
                      <b className="l-fd">{T('e_t4')}</b>
                      <p>{T('e_d4')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section id="s-get" className="l-sc l-cta" onMouseMove={v.mm}>
          <div className="l-bgx" style={sv(v.bgVars)}>
            <div className="l-bgs">
              <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                <DlExtra />
                <rect
                  className="l-st"
                  x="158"
                  y="630"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="276"
                  y="158"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="630"
                  y="394"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="748"
                  y="748"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />

                <rect
                  className="l-st"
                  x="40"
                  y="40"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="158"
                  y="40"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="276"
                  y="40"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="394"
                  y="40"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="512"
                  y="40"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="630"
                  y="40"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="748"
                  y="40"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="866"
                  y="40"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="40"
                  y="158"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="158"
                  y="158"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <DlTile id={0} delay="0s" />
                <rect
                  className="l-st"
                  x="394"
                  y="158"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="512"
                  y="158"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="630"
                  y="158"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="748"
                  y="158"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="866"
                  y="158"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="40"
                  y="276"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="158"
                  y="276"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="276"
                  y="276"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="394"
                  y="276"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="512"
                  y="276"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="630"
                  y="276"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="748"
                  y="276"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="866"
                  y="276"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="40"
                  y="394"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="158"
                  y="394"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="276"
                  y="394"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="394"
                  y="394"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="512"
                  y="394"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <DlTile id={1} delay="-2.7s" />
                <rect
                  className="l-st"
                  x="748"
                  y="394"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="866"
                  y="394"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="40"
                  y="512"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="158"
                  y="512"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="276"
                  y="512"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="394"
                  y="512"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="512"
                  y="512"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="630"
                  y="512"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="748"
                  y="512"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="866"
                  y="512"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="40"
                  y="630"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <DlTile id={2} delay="-5.1s" />
                <rect
                  className="l-st"
                  x="276"
                  y="630"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="394"
                  y="630"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="512"
                  y="630"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="630"
                  y="630"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="748"
                  y="630"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="866"
                  y="630"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="40"
                  y="748"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="158"
                  y="748"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="276"
                  y="748"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="394"
                  y="748"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="512"
                  y="748"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="630"
                  y="748"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <DlTile id={3} delay="-1.4s" />
                <rect
                  className="l-st"
                  x="866"
                  y="748"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="40"
                  y="866"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="158"
                  y="866"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="276"
                  y="866"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="394"
                  y="866"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="512"
                  y="866"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="630"
                  y="866"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="748"
                  y="866"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
                <rect
                  className="l-st"
                  x="866"
                  y="866"
                  width="100"
                  height="100"
                  rx="24"
                  opacity=".2"
                />
              </svg>
            </div>
          </div>
          <div className="l-wrap">
            <div className="l-kk l-fm">
              <i />
              {T('nav_get')}
              <i />
            </div>
            <h2 className="l-h2 l-fd">{T('f_h')}</h2>
            <p className="l-lead">{T('f_p')}</p>
            <div className="l-panel l-cta-panel">
              <div className="l-pform">
                <AuthSlot onLoggedIn={onLoggedIn} invite={invite} />
              </div>
              <div className={v.clsPdl}>
                <div className="l-pdl-l l-fm">{T('get_l')}</div>
                <div className="l-dls">
                  <a className={v.clsWin} href={downloadUrl('win')}>
                    <svg className="l-ic" viewBox="0 0 18 18" aria-hidden="true">
                      <path
                        fill="currentColor"
                        d="M1 2.6 7.6 1.7v6H1zM8.5 1.6 17 .4v7.3H8.5zM1 8.6h6.6v6L1 13.4zM8.5 8.6H17V16l-8.5-1.2z"
                      />
                    </svg>
                    <span>Windows</span>
                    <small>.exe ↓</small>
                  </a>{' '}
                  <a className={v.clsMac} href={downloadUrl('mac')}>
                    <svg className="l-ic" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="currentColor"
                        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
                      />
                    </svg>
                    <span>macOS</span>
                    <small>.dmg ↓</small>
                  </a>{' '}
                  <button
                    type="button"
                    className={`${v.clsAnd} l-and-pop`}
                    onClick={v.toggleAnd}
                    aria-expanded={v.andOpen}
                  >
                    <svg className="l-ic" viewBox="0 0 24 24" aria-hidden="true">
                      <g fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M4.5 10.2a7.5 7.5 0 0 1 15 0zM8.1 7.4a.9.9 0 1 0 1.8 0 .9.9 0 1 0-1.8 0zM14.1 7.4a.9.9 0 1 0 1.8 0 .9.9 0 1 0-1.8 0z"
                        />
                        <rect x="4.5" y="11.2" width="15" height="7.4" rx="1.8" />
                        <rect x="1.5" y="11.2" width="2.2" height="6.2" rx="1.1" />
                        <rect x="20.3" y="11.2" width="2.2" height="6.2" rx="1.1" />
                        <rect x="8" y="17.4" width="2.5" height="4.4" rx="1.25" />
                        <rect x="13.5" y="17.4" width="2.5" height="4.4" rx="1.25" />
                      </g>
                      <path
                        d="M8.2 3.6 7 1.8M15.8 3.6 17 1.8"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        fill="none"
                      />
                    </svg>
                    <span>Android</span>
                    <small>{v.andSmall}</small>
                  </button>{' '}
                  <a className="l-dl l-and-direct" href={downloadUrl('android')}>
                    <svg className="l-ic" viewBox="0 0 24 24" aria-hidden="true">
                      <g fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M4.5 10.2a7.5 7.5 0 0 1 15 0zM8.1 7.4a.9.9 0 1 0 1.8 0 .9.9 0 1 0-1.8 0zM14.1 7.4a.9.9 0 1 0 1.8 0 .9.9 0 1 0-1.8 0z"
                        />
                        <rect x="4.5" y="11.2" width="15" height="7.4" rx="1.8" />
                        <rect x="1.5" y="11.2" width="2.2" height="6.2" rx="1.1" />
                        <rect x="20.3" y="11.2" width="2.2" height="6.2" rx="1.1" />
                        <rect x="8" y="17.4" width="2.5" height="4.4" rx="1.25" />
                        <rect x="13.5" y="17.4" width="2.5" height="4.4" rx="1.25" />
                      </g>
                      <path
                        d="M8.2 3.6 7 1.8M15.8 3.6 17 1.8"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        fill="none"
                      />
                    </svg>
                    <span>Android</span>
                    <small>.apk ↓</small>
                  </a>
                </div>
              </div>
              {v.andOpen && (
                <>
                  <div className="l-qrp" role="group" aria-label="Android">
                    <div className="l-qrimg">
                      <svg
                        viewBox="0 0 53 53"
                        style={{ display: 'block', width: '100%', height: '100%' }}
                        role="img"
                        aria-label="QR"
                      >
                        <path fill="#fff" d="M0 0h53v53h-53z" />
                        <path
                          stroke="#111"
                          d="M2 2.5h7m2 0h2m2 0h2m2 0h1m1 0h1m3 0h1m3 0h1m1 0h2m2 0h1m1 0h2m3 0h1m1 0h7m-49 1h1m5 0h1m1 0h2m1 0h2m2 0h1m2 0h1m2 0h2m1 0h4m4 0h1m1 0h2m1 0h4m1 0h1m5 0h1m-49 1h1m1 0h3m1 0h1m3 0h1m2 0h1m3 0h2m3 0h3m2 0h2m1 0h5m4 0h2m1 0h1m1 0h3m1 0h1m-49 1h1m1 0h3m1 0h1m1 0h1m6 0h1m2 0h1m2 0h2m1 0h1m1 0h1m2 0h1m1 0h1m3 0h3m1 0h1m2 0h1m1 0h3m1 0h1m-49 1h1m1 0h3m1 0h1m2 0h5m2 0h5m1 0h5m1 0h5m3 0h2m4 0h1m1 0h3m1 0h1m-49 1h1m5 0h1m1 0h5m2 0h2m1 0h1m1 0h1m1 0h1m3 0h2m1 0h1m1 0h2m1 0h1m1 0h1m1 0h1m3 0h1m5 0h1m-49 1h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7m-37 1h3m1 0h1m1 0h5m3 0h1m1 0h1m1 0h4m3 0h1m1 0h1m-40 1h5m1 0h3m6 0h2m1 0h10m8 0h2m1 0h3m1 0h1m1 0h1m1 0h1m-48 1h1m6 0h3m4 0h1m4 0h1m3 0h2m2 0h1m1 0h2m1 0h1m2 0h3m3 0h3m1 0h1m-46 1h1m1 0h2m1 0h3m1 0h1m2 0h3m2 0h1m1 0h1m4 0h1m1 0h2m5 0h2m1 0h1m1 0h1m1 0h1m2 0h3m1 0h2m-47 1h2m4 0h1m5 0h2m7 0h1m1 0h1m2 0h1m1 0h1m1 0h2m1 0h1m1 0h1m1 0h2m1 0h1m1 0h1m-45 1h1m1 0h3m1 0h1m2 0h3m1 0h2m2 0h1m1 0h1m2 0h6m2 0h1m3 0h7m2 0h1m2 0h2m-48 1h1m3 0h1m2 0h1m1 0h1m1 0h2m2 0h1m2 0h1m2 0h1m1 0h2m3 0h3m1 0h2m1 0h3m3 0h3m1 0h1m1 0h1m-45 1h1m1 0h2m1 0h1m4 0h1m3 0h1m1 0h1m4 0h4m5 0h2m1 0h1m1 0h3m2 0h1m3 0h2m-49 1h2m3 0h1m1 0h1m1 0h1m2 0h2m1 0h1m1 0h1m3 0h1m2 0h3m1 0h3m1 0h2m1 0h1m1 0h3m1 0h2m1 0h1m3 0h1m-49 1h4m2 0h1m2 0h1m2 0h1m2 0h4m1 0h1m2 0h1m2 0h2m1 0h3m2 0h1m1 0h1m1 0h6m2 0h3m-48 1h3m4 0h1m4 0h2m4 0h1m1 0h1m3 0h1m1 0h1m2 0h2m1 0h1m1 0h2m4 0h3m1 0h1m-41 1h3m2 0h1m1 0h1m3 0h1m1 0h1m1 0h1m1 0h2m2 0h2m3 0h2m1 0h1m2 0h2m1 0h1m2 0h2m1 0h1m1 0h1m-48 1h4m3 0h1m1 0h2m1 0h1m2 0h5m6 0h3m2 0h1m1 0h1m2 0h1m2 0h1m1 0h1m1 0h2m-45 1h1m3 0h4m2 0h1m3 0h1m2 0h1m3 0h3m1 0h1m2 0h1m1 0h1m1 0h5m2 0h4m2 0h1m1 0h1m-45 1h1m5 0h4m2 0h5m1 0h1m2 0h1m1 0h1m1 0h4m2 0h2m4 0h2m1 0h2m1 0h1m-48 1h1m1 0h8m1 0h2m2 0h3m2 0h1m1 0h5m2 0h1m1 0h6m1 0h1m1 0h6m1 0h2m-49 1h3m1 0h1m3 0h1m1 0h3m1 0h1m1 0h2m1 0h4m3 0h1m1 0h2m2 0h2m1 0h1m1 0h2m1 0h1m3 0h1m3 0h1m-49 1h1m2 0h2m1 0h1m1 0h1m1 0h1m2 0h1m1 0h2m1 0h1m1 0h1m1 0h1m1 0h1m1 0h2m1 0h2m3 0h1m1 0h2m2 0h1m1 0h1m1 0h5m-47 1h3m3 0h4m10 0h1m3 0h2m2 0h2m3 0h3m2 0h1m3 0h4m-48 1h1m1 0h7m1 0h1m1 0h4m1 0h1m1 0h1m1 0h7m1 0h1m3 0h4m1 0h11m-46 1h3m1 0h3m4 0h1m1 0h1m2 0h1m1 0h1m2 0h1m1 0h1m1 0h3m1 0h2m3 0h2m1 0h2m3 0h1m1 0h2m-48 1h2m1 0h1m1 0h3m1 0h1m1 0h3m2 0h1m1 0h1m1 0h5m1 0h1m2 0h1m3 0h3m1 0h2m1 0h8m-45 1h2m1 0h1m7 0h1m2 0h1m2 0h1m2 0h1m1 0h5m5 0h2m1 0h2m1 0h1m2 0h3m-47 1h1m3 0h2m2 0h3m1 0h1m3 0h1m1 0h1m2 0h4m3 0h1m3 0h3m2 0h2m1 0h2m3 0h3m-44 1h1m1 0h5m2 0h2m1 0h1m3 0h1m2 0h1m1 0h1m1 0h3m1 0h1m7 0h1m2 0h1m1 0h1m2 0h1m-49 1h1m2 0h6m2 0h3m1 0h4m1 0h2m5 0h1m1 0h3m1 0h7m2 0h3m1 0h1m-47 1h1m2 0h1m4 0h1m1 0h4m5 0h1m1 0h5m1 0h1m2 0h1m2 0h1m1 0h2m2 0h3m1 0h1m2 0h1m-47 1h2m4 0h2m7 0h2m1 0h4m1 0h2m4 0h1m1 0h1m1 0h2m1 0h8m2 0h3m-49 1h3m2 0h1m2 0h1m2 0h3m2 0h4m2 0h3m3 0h5m1 0h1m2 0h1m2 0h1m3 0h2m2 0h1m-49 1h5m1 0h2m2 0h1m1 0h1m2 0h1m2 0h1m3 0h1m1 0h1m1 0h2m2 0h1m3 0h6m3 0h6m-46 1h1m7 0h1m1 0h1m2 0h8m1 0h1m3 0h2m1 0h1m2 0h1m1 0h1m2 0h4m2 0h1m-46 1h1m3 0h3m1 0h1m5 0h4m1 0h1m1 0h1m2 0h1m2 0h1m2 0h1m1 0h4m1 0h5m3 0h3m-48 1h3m7 0h1m1 0h2m1 0h1m1 0h3m1 0h2m1 0h2m1 0h1m1 0h3m1 0h1m5 0h1m2 0h2m3 0h1m-49 1h3m3 0h1m3 0h2m1 0h1m1 0h4m1 0h1m1 0h6m1 0h2m4 0h3m1 0h9m-40 1h2m1 0h4m4 0h1m2 0h1m3 0h1m2 0h3m1 0h1m1 0h1m4 0h1m3 0h1m1 0h2m-48 1h7m1 0h4m1 0h2m1 0h2m1 0h1m1 0h2m1 0h1m1 0h2m3 0h1m2 0h1m1 0h3m1 0h1m1 0h1m1 0h1m1 0h3m-49 1h1m5 0h1m3 0h2m2 0h1m7 0h1m3 0h7m1 0h1m2 0h4m3 0h1m3 0h1m-49 1h1m1 0h3m1 0h1m1 0h1m1 0h5m2 0h1m1 0h1m2 0h6m1 0h3m3 0h14m-49 1h1m1 0h3m1 0h1m1 0h1m1 0h1m1 0h1m2 0h1m2 0h1m2 0h1m5 0h7m1 0h1m1 0h1m1 0h4m1 0h2m1 0h2m-49 1h1m1 0h3m1 0h1m1 0h1m2 0h2m4 0h1m1 0h1m1 0h1m1 0h2m2 0h1m1 0h1m1 0h5m2 0h2m1 0h3m-44 1h1m5 0h1m1 0h1m1 0h1m1 0h1m2 0h1m1 0h1m3 0h2m4 0h2m1 0h1m1 0h1m5 0h1m2 0h2m1 0h1m3 0h1m-49 1h7m1 0h3m2 0h1m2 0h3m1 0h1m3 0h1m4 0h3m1 0h1m1 0h3m1 0h1m1 0h1m1 0h1m1 0h4"
                        />
                      </svg>
                    </div>
                    <div>
                      <div className="l-qrt">{T('and_scan')}</div>
                      <a className="l-qrl" href={downloadUrl('android')}>
                        {T('and_dl')} ↓
                      </a>
                    </div>
                    <button
                      type="button"
                      className="l-qrx"
                      onClick={v.toggleAnd}
                      aria-label={T('and_close')}
                    >
                      ✕
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="l-getimgs"></div>
          </div>
        </section>
      </div>
    </div>
  );
}
