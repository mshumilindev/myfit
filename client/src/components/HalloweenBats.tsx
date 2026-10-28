/**
 * Halloween app switch (SPO-378): the bat swarm from the approved board. Black bats fly in on curved paths from random
 * edges, small and far first, growing as they come close, until nothing but black is on screen (phase `out`, 1100 ms);
 * they hold while the next app loads (`load`) and scatter the other way (`in`, 900 ms). Mounted once at the root (the
 * app shells unmount during a switch), loaded lazily, shown only while `html[data-glitch]` is set (hidden with display:none otherwise, so nothing animates at rest), which
 * components/appGlitch.ts drives (reduced motion never sets it). Flight paths are generated keyframes
 * (halloweenBats.generated.css) on a 280x560 phone / 760x460 desktop stage scaled to cover the screen.
 */
import { lazy, Suspense, useEffect } from 'react';
import { useTheme } from '../themes/registry';

const loadView = () => import('./HalloweenBats.view');
const View = lazy(loadView);

export function HalloweenBats() {
  const theme = useTheme();
  // The swarm is mounted (hidden, no animation running) for as long as the theme is on and its chunk is fetched the
  // moment the theme turns on, so the first app switch starts on the very next frame instead of after a load.
  useEffect(() => {
    if (theme === 'halloween') void loadView();
  }, [theme]);
  if (theme !== 'halloween') return null;
  return (
    <Suspense fallback={null}>
      <View />
    </Suspense>
  );
}
