/**
 * Christmas app switch (SPO-393): the snowstorm from the approved board. Mounted once at the root (the app shells
 * unmount during a switch), loaded lazily, only while the Christmas theme is active. The view listens to
 * `html[data-glitch]` (components/appGlitch.ts: `out` → `load` → `in`; reduced motion never sets it) and draws the storm
 * on one canvas; there is no veil, the screen is white only where the snow is.
 */
import { lazy, Suspense, useEffect } from 'react';
import { useTheme } from '../themes/registry';

const loadView = () => import('./ChristmasSnow.view');
const View = lazy(loadView);

export function ChristmasSnow() {
  const theme = useTheme();
  // The view is mounted (idle, nothing drawn) while the theme is on, and its chunk is fetched the moment the theme turns on,
  // so the first app switch starts on the very next frame.
  useEffect(() => {
    if (theme === 'christmas') void loadView();
  }, [theme]);
  if (theme !== 'christmas') return null;
  return (
    <Suspense fallback={null}>
      <View />
    </Suspense>
  );
}
