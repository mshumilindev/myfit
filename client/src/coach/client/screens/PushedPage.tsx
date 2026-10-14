import type { ReactNode } from 'react';
import { BackButton } from '../../../components/ui/BackButton';
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
      <div className="hl-pbar">
        <BackButton label={backLabel} onClick={onBack} />
        <h1 className="hl-pt">{title}</h1>
      </div>
      <div className="hl-scroll">
        <div className="hl-cnt">{children}</div>
      </div>
    </div>
  );
}
