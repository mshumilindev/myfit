import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BOKEH } from './christmasBokeh';

/** Wide layout from 720 px; kept here so the Christmas chunk never pulls the Halloween scene. */
function useWide(): boolean {
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
export default function ChristmasSceneView() {
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
    <div
      className="xc-scene"
      data-wide={wide ? 'true' : 'false'}
      ref={ref}
      aria-hidden="true"
      data-testid="christmas-scene"
    >
      {BOKEH.map((b, i) => (
        // the wrapper carries the app's count rule (opacity); the disc inside carries the motion
        <i
          key={i}
          className={`xb xb-${b.tone}`}
          data-acc={b.k ? '1' : '0'}
          style={
            {
              left: `${b.x}%`,
              top: `${b.y}%`,
              width: b.size,
              height: b.size,
              '--k': b.k ?? 0,
              '--op': b.op,
              '--bl': `${b.blur}px`,
              '--dr': `${b.drift}s`,
              '--br': `${b.breathe}s`,
              '--dl': `${b.delay}s`,
            } as CSSProperties
          }
        >
          <b />
        </i>
      ))}
    </div>
  );
}
