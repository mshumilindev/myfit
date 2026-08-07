/**
 * Temporary on-device layout probe (not product UI — raw numbers on purpose).
 *
 * The hairline sits at the bottom of the layout viewport, so one screenshot
 * shows whether the empty strip under the tab bar belongs to the page or to
 * the OS window. Delete this together with its styles once the standalone
 * bottom inset is settled.
 */
import { useEffect, useState } from 'react';
import { isStandaloneDisplay } from '../pwaInstall';
import { measureViewport } from '../viewportFit';

function readProbe(): string {
  const { innerHeight, visualHeight, clientHeight } = measureViewport();
  const bar = document.querySelector('.tabbar');
  const rect = bar?.getBoundingClientRect();
  const pad = bar ? Math.round(parseFloat(getComputedStyle(bar).paddingBottom)) : null;
  return [
    __BUILD_ID__,
    `ih${Math.round(innerHeight)}`,
    `vv${visualHeight === null ? '-' : Math.round(visualHeight)}`,
    `ch${clientHeight}`,
    `sh${window.screen.height}`,
    `gap${rect ? Math.round(innerHeight - rect.bottom) : '-'}`,
    `pad${pad ?? '-'}`,
    `st${isStandaloneDisplay() ? 1 : 0}`,
  ].join(' ');
}

export function ViewportProbe() {
  const [text, setText] = useState('');

  useEffect(() => {
    const tick = () => setText(readProbe());
    tick();
    // The tab bar mounts after the first paint; keep sampling for a moment.
    const timer = window.setInterval(tick, 1000);
    const stop = window.setTimeout(() => window.clearInterval(timer), 10_000);
    window.addEventListener('orientationchange', tick);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(stop);
      window.removeEventListener('orientationchange', tick);
    };
  }, []);

  return <div className="viewport-probe">{text}</div>;
}
