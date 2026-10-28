/**
 * Themes — its own page (opened from Today, under Customize Today) because more look-and-feel settings will
 * join it. Every theme is a kit Card drawn in ITS OWN theme (ThemeFrame): the theme's name set as a wordmark
 * on its own atmosphere, and one button. Landscape tiles on desktop: the theme in use is the big one. The theme in use comes first and shows "Applied"; the others have
 * Apply. No user data and no screenshot: the picture is the theme's tokens (SPO-346).
 */
import { useEffect, useState } from 'react';
import { PageHead } from '../components/ui/PageHead';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { SectionLabel } from '../components/ui/SectionLabel';
import { useT } from '../i18n';
import { APP_BREAKPOINT, useMinWidth } from '../components/ui/breakpoints';
import { PICKABLE_THEMES, THEMES, setTheme, useCommittedTheme, useHolidayTheme } from '../themes';
import { getUnseenThemes, markAllThemesSeen } from '../themes/seen';
import { ThemeCard } from './ThemeCard';
import './themes.css';

/** Places held for the themes still to come, so the page already has its final shape (five slots in all). */
const SOON_SLOTS = 3;

export function ThemesView({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const saved = useCommittedTheme();
  // a holiday theme veils the saved one: then no card is "in use" and every card is drawn in its own frame
  const holidayId = useHolidayTheme();
  const current = holidayId === null ? saved : null;
  const holidayDef = holidayId === null ? undefined : THEMES.find((x) => x.id === holidayId);
  // the themes that were new when the screen opened keep their tag for this visit; opening counts as seen
  const [fresh] = useState(() => new Set(getUnseenThemes().map((x) => x.id)));
  useEffect(() => {
    markAllThemesSeen();
  }, []);
  const land = useMinWidth(APP_BREAKPOINT);
  const cardCls = land ? 'thm-card thm-card--land' : 'thm-card';
  // the theme in use goes to the top; the registry order holds for the rest
  const picks = [...PICKABLE_THEMES].sort(
    (a, b) => Number(b.id === current) - Number(a.id === current),
  );
  // the holiday theme the schedule has on right now is listed first, so the person sees why the app looks like this
  const list = holidayDef ? [holidayDef, ...picks] : picks;
  return (
    <div className="screen themes-screen">
      <PageHead back={{ label: t.backAction, onClick: onClose }} title={t.themesTitle} />
      <SectionLabel>{t.themesSection}</SectionLabel>
      <div className="thm-list">
        {list.map((th, i) => (
          // desktop: the first (current) theme is the big tile, the rest are small landscape tiles
          <div key={th.id} className={i === 0 ? 'thm-cell thm-hero' : 'thm-cell'}>
            <ThemeCard
              theme={th}
              current={th.id === current || th.id === holidayId}
              seasonal={th.id === holidayId}
              fresh={fresh.has(th.id)}
              land={land}
              onApply={setTheme}
            />
          </div>
        ))}
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
