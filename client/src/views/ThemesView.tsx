/**
 * Themes — its own page (opened from Today, under Customize Today) because more look-and-feel settings will
 * join it. Every theme is a kit Card drawn in ITS OWN theme (ThemeFrame): the theme's name set as a wordmark
 * on its own atmosphere, and one button. Landscape tiles on desktop: the theme in use is the big one. The theme in use comes first and shows "Applied"; the others have
 * Apply. No user data and no screenshot: the picture is the theme's tokens (SPO-346).
 */
import { Fragment } from 'react';
import { PageHead } from '../components/ui/PageHead';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { SectionLabel } from '../components/ui/SectionLabel';
import { useT } from '../i18n';
import { APP_BREAKPOINT, useMinWidth } from '../components/ui/breakpoints';
import { THEMES, setTheme, useTheme } from '../themes';
import { ThemeFrame } from './ThemeFrame';
import './themes.css';

/** Places held for the themes still to come, so the page already has its final shape (five slots in all). */
const SOON_SLOTS = 3;

export function ThemesView({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const current = useTheme();
  const land = useMinWidth(APP_BREAKPOINT);
  const cardCls = land ? 'thm-card thm-card--land' : 'thm-card';
  // the theme in use goes to the top; the registry order holds for the rest
  const list = [...THEMES].sort((a, b) => Number(b.id === current) - Number(a.id === current));
  return (
    <div className="screen themes-screen">
      <PageHead back={{ label: t.backAction, onClick: onClose }} title={t.themesTitle} />
      <SectionLabel>{t.themesSection}</SectionLabel>
      <div className="thm-list">
        {list.map((th, i) => {
          const on = th.id === current;
          const card = (
            <Card pad="none" emphasis="glass" className={cardCls}>
              <div className="thm-art" aria-hidden="true">
                <span className="thm-wm">{th.name}</span>
              </div>
              <div className="thm-foot">
                {on ? (
                  <Button variant="secondary" icon="check" disabled fullWidth>
                    {t.themesApplied}
                  </Button>
                ) : (
                  <Button variant="primary" fullWidth onClick={() => setTheme(th.id)}>
                    {t.themesApply}
                  </Button>
                )}
              </div>
            </Card>
          );
          // a card is drawn in ITS theme: the current one is already live, the others go through a frame
          // desktop: the first (current) theme is the big tile, the rest are small landscape tiles
          return (
            <div key={th.id} className={i === 0 ? 'thm-cell thm-hero' : 'thm-cell'}>
              {on ? (
                <Fragment>{card}</Fragment>
              ) : (
                <ThemeFrame themeId={th.id} title={th.name}>
                  {card}
                </ThemeFrame>
              )}
            </div>
          );
        })}
        {Array.from({ length: SOON_SLOTS }, (_, i) => (
          <div key={`soon-${i}`} className="thm-cell">
            <Card pad="none" className={`${cardCls} thm-soon`}>
              {/* same parts as a real tile (picture + button), so it is exactly as big */}
              <div className="thm-art" aria-hidden="true" />
              <div className="thm-foot">
                <Button variant="secondary" disabled fullWidth>
                  {t.themesSoon}
                </Button>
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
