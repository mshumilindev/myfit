/**
 * Christmas background (SPO-393): the approved night forest with a garland, drawn once as inline SVG with CSS animation
 * only (no rAF, no canvas). Mounted by the app shells next to the night sky: the night sky wins whenever a night is
 * live (rule), and this layer only exists while the Christmas theme is the active one. The SVG is generated from the
 * design board (static trusted markup), loaded lazily so other themes never download it.
 */
import { lazy, Suspense } from 'react';
import { useTheme } from '../themes/registry';
import './ChristmasScene.css';

const Scene = lazy(() => import('./ChristmasScene.view'));

export function ChristmasScene() {
  const theme = useTheme();
  if (theme !== 'christmas') return null;
  return (
    <Suspense fallback={null}>
      <Scene />
    </Suspense>
  );
}
