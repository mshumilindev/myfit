import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import './WaterProgress.css';

export interface WaterProgressProps {
  /** 0-100: the real share, the water level is exactly this. */
  value: number;
  /** Width in px; the tank is 3:4 (height = 4/3 of it). */
  size?: number;
  /** What sits in the middle (a number, a glyph). */
  children?: ReactNode;
  /** Accessible name of the progress. */
  label: string;
  /** Let the water follow the phone's tilt (a full turn, 360 degrees). Off = a still level. */
  tilt?: boolean;
  /** The tilt that was measured on the device, in degrees (tests and stories set it; real use leaves it out). */
  angle?: number;
  className?: string;
}

/** The colour step of a level: red under 25, orange 25-49, yellow 50-74, green from 75. */
export function waterLevel(value: number): 'low' | 'warn' | 'mid' | 'high' {
  return value < 25 ? 'low' : value < 50 ? 'warn' : value < 75 ? 'mid' : 'high';
}

/**
 * Where gravity points on the screen, in radians (0 = phone upright, the water at the bottom; +-PI = phone turned over,
 * the water at the TOP of the screen), from the device's gamma and beta in degrees. The gravity vector in the screen
 * plane is (sin(gamma)cos(beta), sin(beta)) with y down. Lying flat there is no direction (null): the water keeps its
 * last one.
 */
export function gravityAngle(gammaDeg: number, betaDeg: number): number | null {
  const g = (gammaDeg * Math.PI) / 180;
  const b = (betaDeg * Math.PI) / 180;
  const x = Math.sin(g) * Math.cos(b);
  const y = Math.sin(b);
  if (Math.hypot(x, y) < 0.15) return null;
  return Math.atan2(x, y);
}

type OrientationCtor = {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

/**
 * The direction of gravity in the screen plane, in radians (0 = phone upright, +-PI = upside down), from the device's
 * roll and pitch (the prototype's formula). `null` until a reading arrives; `needsPermission` on iOS until the person
 * taps (the permission can only be asked from a gesture).
 */
export function useGravityAngle(enabled: boolean) {
  const [angle, setAngle] = useState<number | null>(null);
  const [on, setOn] = useState(false);
  const ask =
    typeof window !== 'undefined' &&
    'DeviceOrientationEvent' in window &&
    typeof (window.DeviceOrientationEvent as unknown as OrientationCtor).requestPermission ===
      'function';
  const needsPermission = enabled && ask && !on;
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return;
    if (ask && !on) return;
    const h = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      const a = gravityAngle(e.gamma, e.beta);
      if (a !== null) setAngle(a);
    };
    window.addEventListener('deviceorientation', h);
    return () => window.removeEventListener('deviceorientation', h);
  }, [enabled, on, ask]);
  const request = async () => {
    const ctor = (window as unknown as { DeviceOrientationEvent?: OrientationCtor })
      .DeviceOrientationEvent;
    try {
      const r = await ctor?.requestPermission?.();
      if (r === 'granted') setOn(true);
    } catch {
      /* denied: the water stays level */
    }
  };
  // iOS (also the installed app) only asks from a tap, and the tank itself is a tiny target nobody knows to press:
  // the first tap anywhere on the page is the gesture (the system prompt for motion access shows once).
  useEffect(() => {
    if (!needsPermission) return;
    const onTap = () => void request();
    document.addEventListener('pointerup', onTap, { once: true, capture: true });
    return () => document.removeEventListener('pointerup', onTap, { capture: true });
  }, [needsPermission]);
  return { angle, needsPermission, request };
}

const W = 300;
const H = 400;
const N = 44;
const M = 58;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** d such that the part of the tank with p.g >= d has the requested share of the area (bisection on a coarse grid). */
function offset(gx: number, gy: number, frac: number) {
  const v: number[] = [];
  for (let i = 0; i < N; i++)
    for (let j = 0; j < M; j++)
      v.push(((i + 0.5) / N - 0.5) * W * gx + ((j + 0.5) / M - 0.5) * H * gy);
  v.sort((p, q) => p - q);
  return v[Math.max(0, Math.min(v.length - 1, Math.round((1 - frac) * v.length)))];
}

/**
 * Program progress as water in a rounded 3:4 tank (Studio), the prototype's water. The level is the real percentage
 * (never below a 12 % film); the colour steps with it (red / orange / yellow / green). Two translucent wave layers; the
 * surface is a damped spring that follows the phone's tilt through a full turn (gravity direction from the device's
 * orientation); the wave grows a little while it swings. Without a sensor (or without the iOS permission) the water
 * rests level and calm; with reduced motion it is level, flat and still. Decorative: the number is in `children` and in
 * `aria-valuenow`.
 */
export function WaterProgress({
  value,
  size = 120,
  children,
  label,
  tilt = true,
  angle,
  className,
}: WaterProgressProps) {
  const pct = Math.max(0, Math.min(100, value));
  const g = useGravityAngle(tilt && angle === undefined);
  const target = angle !== undefined ? (angle * Math.PI) / 180 : (g.angle ?? 0);
  const root = useRef<HTMLDivElement | null>(null);
  const cv = useRef<HTMLCanvasElement | null>(null);
  const kickRef = useRef<(() => void) | null>(null);
  const live = useRef({ pct, target });
  useEffect(() => {
    const el = cv.current;
    const host = root.current;
    const ctx = el?.getContext?.('2d');
    if (!el || !host || !ctx) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    let th = 0;
    let om = 0;
    let t0 = 0;
    let raf = 0;
    let visible = true;
    const fit = () => {
      const r = el.getBoundingClientRect();
      el.width = Math.max(1, Math.round(r.width * dpr));
      el.height = Math.max(1, Math.round(r.height * dpr));
    };
    fit();
    const frame = (t: number) => {
      raf = 0;
      if (document.hidden || !visible) return;
      const dt = Math.min(0.033, (t - t0) / 1000 || 0.016);
      t0 = t;
      const { pct: level, target: tg } = live.current;
      const k = 22;
      const c = reduce ? 14 : 3;
      om += (-k * wrap(th - tg) - c * om) * dt;
      th = wrap(th + om * dt);
      ctx.setTransform(el.width / W, 0, 0, el.height / H, 0, 0);
      ctx.clearRect(0, 0, W, H);
      // what the number shows is what the tank shows: a level that rounds to 0 % is an empty tank; anything above it keeps at
      // least a thin film so a low level still reads as water
      const frac = Math.round(level) <= 0 ? 0 : Math.max(level, 12) / 100;
      const gx = Math.sin(th);
      const gy = Math.cos(th);
      const d = offset(gx, gy, frac);
      const tx = Math.cos(th);
      const ty = -Math.sin(th);
      const amp = reduce ? 0 : 2 + Math.min(9, Math.abs(om) * 5);
      const ph = t / 520;
      const R = 420;
      const cx = W / 2;
      const cy = H / 2;
      const ink = getComputedStyle(host).getPropertyValue('--wp-ink').trim() || '#888';
      for (let layer = 0; layer < (frac === 0 ? 0 : 2); layer++) {
        ctx.beginPath();
        for (let s = -R; s <= R; s += 6) {
          const w =
            Math.sin(s / 34 + ph * (layer ? -1.3 : 1) + layer * 2) * amp * (layer ? 0.7 : 1) +
            Math.sin(s / 17 - ph * 1.7) * amp * 0.3;
          const dd = d + w;
          const x = cx + gx * dd + tx * s;
          const y = cy + gy * dd + ty * s;
          if (s === -R) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineTo(cx + gx * 2 * R + tx * R, cy + gy * 2 * R + ty * R);
        ctx.lineTo(cx + gx * 2 * R - tx * R, cy + gy * 2 * R - ty * R);
        ctx.closePath();
        ctx.globalAlpha = layer ? 0.38 : 0.92;
        ctx.fillStyle = ink;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // a still, level surface needs no more frames: stop until something moves (the wave itself drifts, so keep going
      // unless motion is reduced)
      if (!reduce || Math.abs(om) > 0.001 || Math.abs(wrap(th - tg)) > 0.001)
        raf = requestAnimationFrame(frame);
    };
    const kick = () => {
      if (!raf) {
        t0 = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    kickRef.current = kick;
    kick();
    const vis = () => {
      if (!document.hidden) kick();
    };
    document.addEventListener('visibilitychange', vis);
    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver((es) => {
            visible = es.some((e) => e.isIntersecting);
            if (visible) kick();
          })
        : null;
    io?.observe(host);
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            fit();
            kick();
          })
        : null;
    ro?.observe(el);
    return () => {
      kickRef.current = null;
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', vis);
      io?.disconnect();
      ro?.disconnect();
    };
  }, []);
  useEffect(() => {
    // the loop reads the latest level and tilt from here; a new one also wakes a loop asleep under reduced motion
    live.current = { pct, target };
    kickRef.current?.();
  }, [pct, target]);
  const style = {
    '--wp-size': `${size}px`,
    '--wp-tilt': `${Math.round(((-target * 180) / Math.PI) * 100) / 100}deg`,
  } as CSSProperties;
  return (
    <div
      ref={root}
      className={['uiwater', `uiwater--${waterLevel(pct)}`, className].filter(Boolean).join(' ')}
      style={style}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={label}
    >
      <canvas ref={cv} className="uiwater-canvas" aria-hidden="true" />
      <span className="uiwater-mid">{children}</span>
      {g.needsPermission && (
        <button type="button" className="uiwater-allow" aria-label={label} onClick={g.request} />
      )}
    </div>
  );
}
