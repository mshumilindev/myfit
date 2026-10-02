/**
 * Themes — its own page (opened from Today, under Customize Today) because more
 * look-and-feel settings will join it. A preview of Today as it really looks
 * now sits beside the theme's name, status and the Applied button. Only Brass
 * Glass exists today. Kit components only; the preview is a scaled, inert copy
 * of the live Today screen (data/todaySnapshot).
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { BackButton } from '../components/ui/BackButton';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { IconTile } from '../components/ui/IconTile';
import { SectionLabel } from '../components/ui/SectionLabel';
import { Tag } from '../components/ui/Tag';
import { todaySnapshot } from '../data/todaySnapshot';
import { useT } from '../i18n';
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
  return (
    <div className="screen themes-screen">
      <div className="notif-head">
        <BackButton onClick={onClose} label={t.backAction} />
        <h2 className="title-26">{t.themesTitle}</h2>
      </div>
      <SectionLabel>{t.themesSection}</SectionLabel>
      <Card pad="md">
        <div className="thm-row">
          <TodayPreview alt={t.themesPreviewAlt} />
          <div className="thm-info">
            <Tag tone="accent">{t.themesCurrent}</Tag>
            <h3 className="thm-name">{t.themeBrassName}</h3>
            <p className="thm-sub">{t.themeBrassSub}</p>
            <Button variant="secondary" size="sm" icon="check" disabled>
              {t.themesApplied}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
