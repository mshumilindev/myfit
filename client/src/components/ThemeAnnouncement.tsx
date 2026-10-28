/**
 * Announcement of a new theme (SPO-355). Two pieces:
 *  - `ThemeInvite`: a card at the top of Today / Coach Agenda, drawn in the NEW theme (ThemeFrame), with one
 *    action: Preview. Shown once per new theme (themes/seen.ts); never over a preview in progress.
 *  - `ThemePreviewHost`: mounted once in App; while a preview runs it shows the kit's ThemePreviewDock. The app
 *    behind it already wears the theme; nothing is saved until "Use".
 */
import { useEffect } from 'react';
import { currentHash } from '../route';
import { quietZoneAt } from '../themes/quietZones';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Tag } from './ui/Tag';
import { ThemePreviewDock } from './ui/ThemePreviewDock';
import { useT } from '../i18n';
import {
  PICKABLE_THEMES,
  endPreview,
  getPreview,
  startPreview,
  useCommittedTheme,
  usePreview,
} from '../themes';
import { markThemesSeen, useUnseenThemes } from '../themes/seen';
import { ThemeFrame } from '../views/ThemeFrame';
import '../views/themes.css';
import './ThemeAnnouncement.css';

export function ThemeInvite() {
  const { t } = useT();
  const unseen = useUnseenThemes();
  const previewing = usePreview();
  // the unseen list depends on the saved theme too: re-render when it changes
  useCommittedTheme();
  const next = unseen[0];
  if (!next || previewing !== null) return null;
  return (
    <div className="thinv">
      <ThemeFrame themeId={next.id} title={next.name}>
        <Card emphasis="glass" pad="md" className="thinv-card">
          <div className="thinv-text">
            <span className="thinv-kicker">
              {t.themeInviteKicker} <Tag tone="accent">{t.themeNew}</Tag>
            </span>
            <span className="thinv-name">{next.name}</span>
          </div>
          <Button variant="primary" onClick={() => startPreview(next.id)}>
            {t.themePreviewAction}
          </Button>
        </Card>
      </ThemeFrame>
    </div>
  );
}

export function ThemePreviewHost() {
  const { t } = useT();
  const id = usePreview();
  // A preview never follows the person into training, reading or typing (themes/quietZones.ts): leaving
  // for one of those puts the look back and saves nothing. The route changes through pushState (no event), so
  // while a preview runs the address is looked at a few times a second.
  const previewing = id !== null;
  useEffect(() => {
    if (!previewing) return;
    const check = () => {
      if (quietZoneAt(currentHash())) endPreview(false, true);
    };
    check();
    // Esc = "Keep current" (the dock is not modal, so the key is only taken when nothing else wants it: a dialog,
    // a menu or a text field handled it first).
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const el = e.target instanceof HTMLElement ? e.target : null;
      if (
        el?.closest(
          'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]',
        )
      )
        return;
      const current = getPreview();
      if (current === null) return;
      markThemesSeen([current]);
      endPreview(false);
    };
    window.addEventListener('keydown', onKey);
    const timer = window.setInterval(check, 300);
    window.addEventListener('hashchange', check);
    window.addEventListener('popstate', check);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('hashchange', check);
      window.removeEventListener('popstate', check);
      window.removeEventListener('keydown', onKey);
    };
  }, [previewing]);
  if (id === null) return null;
  const name = PICKABLE_THEMES.find((th) => th.id === id)?.name ?? id;
  return (
    <ThemePreviewDock
      themeName={name}
      newLabel={t.themeNew}
      hint={t.themePreviewHint}
      label={t.themePreviewLabel}
      keepLabel={t.themePreviewKeep}
      useLabel={t.themePreviewUse(name)}
      onKeep={() => {
        markThemesSeen([id]);
        endPreview(false);
      }}
      onUse={() => {
        markThemesSeen([id]);
        endPreview(true);
      }}
    />
  );
}
