/**
 * Onboarding step 5 of 5: pick a look (SPO-355). The same theme cards as the Themes page (ThemeCard), one tap
 * applies a theme with the app-switch animation; "Continue" keeps whatever is on, so the step is skippable.
 * The terms and privacy were agreed in step 1. Reaching this step counts as having seen every theme, so the
 * new-theme invite does not greet the person on Today straight after.
 */
import { useEffect, type ReactNode } from 'react';
import { Button } from '../components/ui/Button';
import { Icon } from '../ui';
import { useT } from '../i18n';
import { PICKABLE_THEMES, setTheme, useCommittedTheme, useHolidayTheme } from '../themes';
import { markAllThemesSeen } from '../themes/seen';
import { ThemeCard } from './ThemeCard';
import './themes.css';

export function OnboardingThemeStep({
  rail,
  onContinue,
}: {
  rail: ReactNode;
  onContinue: () => void;
}) {
  const { t } = useT();
  const saved = useCommittedTheme();
  const current = useHolidayTheme() === null ? saved : null; // a holiday theme veils the saved one
  useEffect(() => {
    markAllThemesSeen();
  }, []);
  return (
    <div className="onb-card">
      {rail}
      <h2 className="display sm">{t.onbLookLead}</h2>
      <div className="thm-list">
        {PICKABLE_THEMES.map((th) => (
          <ThemeCard key={th.id} theme={th} current={th.id === current} onApply={setTheme} />
        ))}
      </div>
      <div className="footnote center">{t.onbLookNote}</div>
      <Button variant="primary" size="lg" onClick={onContinue}>
        {t.onbContinue} <Icon name="arrow-right" />
      </Button>
    </div>
  );
}
