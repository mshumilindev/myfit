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

const DISPLAY_MODES = ['standalone', 'fullscreen', 'minimal-ui', 'browser'] as const;

function displayMode(): string {
  return DISPLAY_MODES.find((m) => window.matchMedia(`(display-mode: ${m})`).matches) ?? '?';
}

function readProbe(): string {
  const { innerHeight, visualHeight, clientHeight } = measureViewport();
  const bar = document.querySelector('.tabbar');
  const rect = bar?.getBoundingClientRect();
  const pad = bar ? Math.round(parseFloat(getComputedStyle(bar).paddingBottom)) : null;
  return [
    __BUILD_ID__,
    `ih${Math.round(innerHeight)}`,
    `sh${window.screen.height}`,
    `vv${visualHeight === null ? '-' : Math.round(visualHeight)}`,
    `ch${clientHeight}`,
    `gap${rect ? Math.round(innerHeight - rect.bottom) : '-'}`,
    `pad${pad ?? '-'}`,
    `dm:${displayMode()}`,
    `st${isStandaloneDisplay() ? 1 : 0}`,
  ].join(' ');
}

export function ViewportProbe() {
  const [text, setText] = useState('');

  useEffect(() => {
    // The tab bar only mounts once auth and the first sync settle, so keep
    // sampling until its numbers are in rather than for a fixed few seconds.
    const timer = window.setInterval(() => {
      setText(readProbe());
      if (document.querySelector('.tabbar')) window.clearInterval(timer);
    }, 500);
    const tick = () => setText(readProbe());
    tick();
    window.addEventListener('orientationchange', tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('orientationchange', tick);
    };
  }, []);

  return <div className="viewport-probe">{text}</div>;
}
