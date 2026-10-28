/**
 * Halloween background (SPO-378): the approved graveyard scene, drawn once as inline SVG with CSS animation only
 * (no rAF, no canvas). Mounted by the app shells next to the night sky: the night sky wins whenever a night is live,
 * and this layer only exists while the Halloween theme is the active one. The SVG is generated from the design board
 * (static trusted markup), loaded lazily so other themes never download it.
 */
import { lazy, Suspense, useEffect, useState } from 'react';
import { useTheme } from '../themes/registry';
import './HalloweenScene.css';

const Scene = lazy(() => import('./HalloweenScene.view'));

export function HalloweenScene() {
  const theme = useTheme();
  if (theme !== 'halloween') return null;
  return (
    <Suspense fallback={null}>
      <Scene />
    </Suspense>
  );
}

export function useWide(): boolean {
  const q = '(min-width: 720px)';
  const [wide, setWide] = useState(() => typeof matchMedia === 'function' && matchMedia(q).matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const m = matchMedia(q);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}
