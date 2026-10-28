/**
 * One theme as a kit Card drawn in ITS OWN theme (ThemeFrame): the theme's name set as a wordmark on its own
 * atmosphere, an optional "New" tag and one button. Shared by the Themes page and the onboarding step, so a
 * theme looks the same wherever it is offered (SPO-346, SPO-355).
 */
import { Fragment } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Tag } from '../components/ui/Tag';
import { useT } from '../i18n';
import type { ThemeDef } from '../themes';
import { ThemeFrame } from './ThemeFrame';
import './themes.css';

export function ThemeCard({
  theme,
  current,
  fresh = false,
  land = false,
  onApply,
}: {
  theme: ThemeDef;
  /** the theme in use: already live, so it is drawn without a frame and shows "Applied" */
  current: boolean;
  fresh?: boolean;
  /** desktop landscape tile (the page tells the card; a framed card has its own viewport) */
  land?: boolean;
  onApply: (id: string) => void;
}) {
  const { t } = useT();
  const card = (
    <Card pad="none" emphasis="glass" className={land ? 'thm-card thm-card--land' : 'thm-card'}>
      <div className="thm-art" aria-hidden="true">
        <span className="thm-wm">{theme.name}</span>
      </div>
      {fresh && (
        <Tag tone="accent" className="thm-new">
          {t.themeNew}
        </Tag>
      )}
      <div className="thm-foot">
        {current ? (
          <Button variant="secondary" icon="check" disabled fullWidth>
            {t.themesApplied}
          </Button>
        ) : (
          <Button variant="primary" fullWidth onClick={() => onApply(theme.id)}>
            {t.themesApply}
          </Button>
        )}
      </div>
    </Card>
  );
  return current ? (
    <Fragment>{card}</Fragment>
  ) : (
    <ThemeFrame themeId={theme.id} title={theme.name}>
      {card}
    </ThemeFrame>
  );
}
