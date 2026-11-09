/**
 * Studio background (Waves): three soft wave layers in the theme accent across the top of the screen, drifting at
 * 34 / 52 / 74 s per cycle (transform only). Mounted by the app shell next to the night sky: Sleep wins whenever a
 * night is live, and this layer only exists while Studio is the active theme. Pure CSS animation, no rAF; it stops on
 * reduced motion and while the tab is hidden.
 */
import { useEffect, useRef } from 'react';
import { useTheme } from '../themes/registry';
import './StudioWaves.css';

const WAVE =
  'M0 40 C 120 10, 240 70, 360 40 S 600 10, 720 40 S 960 70, 1080 40 S 1320 10, 1440 40 V 160 H 0 Z';

export function StudioWaves() {
  const theme = useTheme();
  const ref = useRef<HTMLDivElement | null>(null);
  const on = theme === 'studio';
  useEffect(() => {
    const el = ref.current;
    if (!on || !el) return;
    const sync = () => {
      el.dataset.paused = String(document.hidden);
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, [on]);
  if (!on) return null;
  return (
    <div className="sw-waves" ref={ref} aria-hidden="true">
      {[1, 2, 3].map((n) => (
        <svg
          key={n}
          className={`sw-layer sw-l${n}`}
          viewBox="0 0 1440 160"
          preserveAspectRatio="none"
        >
          <path d={WAVE} />
          <path d={WAVE} transform="translate(1440 0)" />
        </svg>
      ))}
    </div>
  );
}
