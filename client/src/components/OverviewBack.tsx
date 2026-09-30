/**
 * "‹" (Overview) — the round back button on every Overview drill-in (Progress, Trends,
 * Programs, Goals, Playbook, Exercises). Navigates by hash so any page can use
 * it without threading the shell through.
 */
import { BackButton } from './ui/BackButton';
import { useT } from '../i18n';

export function OverviewBack({ className }: { className?: string }) {
  const { t } = useT();
  return (
    <BackButton
      className={['ov-back', className].filter(Boolean).join(' ')}
      label={t.overviewTab}
      onClick={() => {
        window.location.hash = '#/overview';
      }}
    />
  );
}
