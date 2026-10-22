import { PageHead } from './PageHead';
import { useT } from '../../i18n';
import { navigateHash } from '../../navigateHash';

/**
 * The header of an Overview drill-in that has no actions of its own (Goals, Playbook, Exercises): the kit
 * PageHead with the back-to-Overview control. `programs-top` keeps the page-level rules that place this row.
 */
export function OverviewHead({ title }: { title: string }) {
  const { t } = useT();
  return (
    <PageHead
      className="programs-top"
      back={{ label: t.overviewTab, onClick: () => navigateHash('#/overview') }}
      title={title}
    />
  );
}
