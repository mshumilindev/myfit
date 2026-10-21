import type { ReactNode } from 'react';
import { PageHead } from '../../../components/ui/PageHead';
import '../../../views/Health.css';
import '../ClientCoach.css';

/** The real pushed-page frame of Health > Privacy and sharing (`.screen.hl > .hl-pbar + .hl-scroll > .hl-cnt`). */
export function PushedPage({
  title,
  backLabel,
  onBack,
  children,
}: {
  title: string;
  backLabel: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="screen hl">
      <PageHead className="hl-pbar" back={{ label: backLabel, onClick: onBack }} title={title} />
      <div className="hl-scroll">
        <div className="hl-cnt">{children}</div>
      </div>
    </div>
  );
}
