/**
 * Halloween background (SPO-378): the approved graveyard scene, drawn once as inline SVG with CSS animation only
 * (no rAF, no canvas). Mounted by the app shells next to the night sky: the night sky wins whenever a night is live,
 * and this layer only exists while the Halloween theme is the active one. The SVG is generated from the design board
 * (static trusted markup), loaded lazily so other themes never download it.
 */
import { lazy, Suspense } from 'react';
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
