/**
 * Themes — its own page (opened from Today, under Customize Today) because more
 * look-and-feel settings will join it. A preview of Today as it really looks
 * now sits beside the current theme's name and status; every other theme has an
 * Apply button. Kit components only; the preview is a scaled, inert copy
 * of the live Today screen (data/todaySnapshot).
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { PageHead } from '../components/ui/PageHead';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { IconTile } from '../components/ui/IconTile';
import { SectionLabel } from '../components/ui/SectionLabel';
import { Tag } from '../components/ui/Tag';
import { todaySnapshot } from '../data/todaySnapshot';
import { useT } from '../i18n';
import { THEMES, setTheme, useTheme } from '../themes';
import './themes.css';

/** The scaled copy of Today. `inert` + aria-hidden: it is a picture, not a second screen. */
function TodayPreview({ alt }: { alt: string }) {
  const [snap] = useState(todaySnapshot);
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box || !snap) return;
    const fit = () => setScale(box.clientWidth / snap.width);
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [snap]);

  return (
    <div className="thm-pv" ref={boxRef} role="img" aria-label={alt}>
      {snap ? (
        <div
          className="thm-pv-in"
          aria-hidden="true"
          inert
          style={{ width: snap.width, transform: `scale(${scale})`, opacity: scale ? 1 : 0 }}
          dangerouslySetInnerHTML={{ __html: snap.html }}
        />
      ) : (
        <IconTile tone="accent" size={48} icon="palette" />
      )}
    </div>
  );
}

export function ThemesView({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const current = useTheme();
  const sub: Record<string, string> = { glass: t.themeBrassSub, cyberpunk: t.themeCyberSub };
  return (
    <div className="screen themes-screen">
      <PageHead back={{ label: t.backAction, onClick: onClose }} title={t.themesTitle} />
      <SectionLabel>{t.themesSection}</SectionLabel>
      <div className="thm-list">
        {THEMES.map((th) => {
          const on = th.id === current;
          return (
            <Card pad="md" key={th.id}>
              <div className="thm-row">
                {on ? (
                  <TodayPreview alt={t.themesPreviewAlt} />
                ) : (
                  <div className="thm-sw">
                    <IconTile tone="accent" size={48} icon="palette" />
                  </div>
                )}
                <div className="thm-info">
                  {on && <Tag tone="accent">{t.themesCurrent}</Tag>}
                  <h3 className="thm-name">{th.name}</h3>
                  <p className="thm-sub">{sub[th.id] ?? ''}</p>
                  {on ? (
                    <Button variant="secondary" size="sm" icon="check" disabled>
                      {t.themesApplied}
                    </Button>
                  ) : (
                    <Button variant="primary" size="sm" onClick={() => setTheme(th.id)}>
                      {t.themesApply}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
