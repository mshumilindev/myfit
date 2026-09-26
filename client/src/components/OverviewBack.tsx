/**
 * "‹ Overview" — the back link on every Overview drill-in (Progress, Trends,
 * Programs, Goals, Playbook, Exercises). Navigates by hash so any page can use
 * it without threading the shell through.
 */
import { useT } from '../i18n';
import { Icon } from '../ui';

export function OverviewBack({ className }: { className?: string }) {
  const { t } = useT();
  return (
    <button
      type="button"
      className={['ov-back', className].filter(Boolean).join(' ')}
      onClick={() => {
        window.location.hash = '#/overview';
      }}
    >
      <Icon name="caret-left" weight="bold" />
      {t.overviewTab}
    </button>
  );
}
