import { useEffect, useRef } from 'react';
import { moonInfo } from '../moon';

/**
 * A phase-accurate moon disc, drawn on a small canvas with the SAME terminator
 * math as the Spotter Sky (see SpotterSky.drawMoon) so the glyph and the living
 * sky always agree. Phase & illuminated fraction are astronomical (date-driven);
 * the lit limb follows `litOnRight` (hemisphere-aware). Static — repaints only
 * when its inputs change.
 */
export function MoonGlyph({
  size = 100,
  date,
  lat = 0,
  halo = true,
}: {
  size?: number;
  date?: number;
  lat?: number;
  halo?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(size * dpr);
    canvas.height = Math.floor(size * dpr);
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    const o = canvas.getContext('2d');
    if (!o) return;
    o.setTransform(dpr, 0, 0, dpr, 0, 0);
    o.clearRect(0, 0, size, size);
    const moon = moonInfo(new Date(date ?? Date.now()), lat);
    const cx = size / 2;
    const cy = size / 2;
    const R = size * (halo ? 0.4 : 0.47);
    if (halo) {
      const h = o.createRadialGradient(cx, cy, R * 0.5, cx, cy, R * 2.1);
      h.addColorStop(0, 'rgba(195,206,244,0.28)');
      h.addColorStop(1, 'rgba(195,206,244,0)');
      o.fillStyle = h;
      o.beginPath();
      o.arc(cx, cy, R * 2.1, 0, 6.283);
      o.fill();
    }
    // Dark disc.
    o.fillStyle = '#1a2036';
    o.beginPath();
    o.arc(cx, cy, R, 0, 6.283);
    o.fill();
    // Lit fraction via a terminator ellipse (identical to SpotterSky).
    const illum = moon.illum;
    o.save();
    o.beginPath();
    o.arc(cx, cy, R, 0, 6.283);
    o.clip();
    const grad = o.createRadialGradient(cx + R * 0.22, cy - R * 0.18, R * 0.1, cx, cy, R * 1.1);
    grad.addColorStop(0, '#f6f6f2');
    grad.addColorStop(0.55, '#dee0e5');
    grad.addColorStop(1, '#b2b5c2');
    o.fillStyle = grad;
    const k = (illum - 0.5) * 2; // -1..1
    const dir = moon.litOnRight ? 1 : -1;
    o.beginPath();
    o.ellipse(cx, cy, R, R, 0, -Math.PI / 2, Math.PI / 2, dir < 0);
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
    // A few maria on the lit side for texture.
    o.globalAlpha = 0.32;
    o.fillStyle = '#a7aab8';
    const maria: [number, number, number][] = [
      [0.28, -0.18, 0.13],
      [0.1, 0.22, 0.09],
      [0.42, 0.06, 0.07],
      [0.2, -0.4, 0.055],
    ];
    for (const [mx, my, mr] of maria) {
      o.beginPath();
      o.arc(cx + mx * R * dir, cy + my * R, mr * R, 0, 6.283);
      o.fill();
    }
    o.globalAlpha = 1;
    o.restore();
    // Soft limb shadow.
    const limb = o.createRadialGradient(cx, cy, R * 0.72, cx, cy, R);
    limb.addColorStop(0, 'rgba(12,14,26,0)');
    limb.addColorStop(1, 'rgba(12,14,26,0.42)');
    o.fillStyle = limb;
    o.beginPath();
    o.arc(cx, cy, R, 0, 6.283);
    o.fill();
  }, [size, date, lat, halo]);
  return <canvas ref={ref} className="moon-glyph" aria-hidden="true" />;
}
