import { EmptyState } from '../components/ui/EmptyState';
import { PageHead } from '../components/ui/PageHead';
import { useT } from '../i18n';
import { STRINGS } from './strings';

/** The Planner screen. I1 shell: header and the empty state; the week, month and form land in I4. */
export function PlannerPage({ onClose }: { onClose: () => void }) {
  const { t, locale } = useT();
  const s = STRINGS[locale];
  return (
    <div className="screen">
      <PageHead back={{ label: t.backAction, onClick: onClose }} title={s.name} />
      <EmptyState
        icon="calendar-plus"
        centered
        titleAs="h2"
        title={s.emptyTitle}
        body={s.emptyBody}
      />
    </div>
  );
}
