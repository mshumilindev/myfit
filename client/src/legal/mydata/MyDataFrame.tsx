/** One page of "What Spotter knows about you": the screen frame the Consents page uses (header with Back, scrolling body). */
import type { ReactNode } from 'react';
import { PageHead } from '../../components/ui/PageHead';
import { useT } from '../../i18n';

export function MyDataFrame({
  title,
  sub,
  onBack,
  children,
}: {
  title: ReactNode;
  sub?: ReactNode;
  onBack: () => void;
  children: ReactNode;
}) {
  const { t } = useT();
  return (
    <div className="screen">
      <PageHead back={{ label: t.backAction, onClick: onBack }} title={title} sub={sub} />
      <div className="hl-scroll">
        <div className="hl-cnt">{children}</div>
      </div>
    </div>
  );
}
