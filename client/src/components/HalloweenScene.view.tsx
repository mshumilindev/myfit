import { useEffect, useRef, useState } from 'react';
import { HALLOWEEN_SCENE_DESKTOP, HALLOWEEN_SCENE_PORTRAIT } from './halloweenScene.generated';

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

/** Default export so it can be lazy-loaded. Pauses every animation while the tab is hidden. */
export default function HalloweenSceneView() {
  const wide = useWide();
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => {
      el.dataset.paused = String(document.hidden);
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);
  return (
    <div className="hw-scene" ref={ref} aria-hidden="true" data-testid="halloween-scene">
      <div
        // Static, trusted markup generated at build time from the design board.
        dangerouslySetInnerHTML={{
          __html: wide ? HALLOWEEN_SCENE_DESKTOP : HALLOWEEN_SCENE_PORTRAIT,
        }}
        className="hw-art"
      />
      <div className="fog f2" />
      <div className="fog f3" />
      <div className="fog f4" />
    </div>
  );
}
