import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';
import { activeAnchor } from './focus';

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

/** Fixed position of a desktop sheet / popover next to its anchor (CSS variables for Overlays.css). */
export function useFixedPanelPosition(
  kind: 'sheet' | 'popover',
  anchorRef?: RefObject<HTMLElement | null>,
  preferredWidth?: number,
): CSSProperties {
  const [anchor] = useState(activeAnchor);
  const [style, setStyle] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    const place = () => {
      const isDesktop = !!window.matchMedia && window.matchMedia('(min-width: 720px)').matches;
      if (kind === 'sheet' && !isDesktop) {
        setStyle({});
        return;
      }

      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      const gutter = kind === 'sheet' ? 0 : 8;
      const preferredW = preferredWidth ?? (kind === 'sheet' ? 430 : 176);
      const width = Math.min(preferredW, viewportW - Math.max(gutter * 2, 36));
      const minPanelH = kind === 'sheet' ? 320 : 220;
      const target = anchorRef?.current ?? anchor;
      const rect = target && document.body.contains(target) ? target.getBoundingClientRect() : null;

      let left = viewportW - width - gutter;
      let top = gutter;

      if (kind === 'sheet') {
        top = 0;
      } else if (rect && rect.width > 0 && rect.height > 0) {
        if (kind === 'popover') {
          left = clamp(rect.right - width, gutter, viewportW - width - gutter);
          top = clamp(rect.bottom + 6, gutter, viewportH - minPanelH - gutter);
        }
      }

      setStyle({
        '--overlay-left': `${Math.round(left)}px`,
        '--overlay-top': `${Math.round(top)}px`,
        '--overlay-width': `${Math.round(width)}px`,
        '--overlay-max-height': `${Math.round(viewportH - top - gutter)}px`,
      } as CSSProperties);
    };

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor, anchorRef, kind, preferredWidth]);

  return style;
}
