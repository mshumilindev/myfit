import type { ReactNode } from 'react';
import { Icon } from '../../ui';
import { IconButton } from './Button';
import './WeekStepper.css';

export interface WeekStepperProps {
  /** Main label — the week's range ("28 Sep – 4 Oct"). */
  label: ReactNode;
  /** Small line under it ("This week", "3 sessions"). */
  sub?: ReactNode;
  /** Go to the previous (older) week. */
  onPrev: () => void;
  /** Go to the next (newer) week. */
  onNext: () => void;
  /** Tap on the label: pick any week. */
  onOpen?: () => void;
  canPrev: boolean;
  canNext: boolean;
  prevLabel: string;
  nextLabel: string;
  /** aria-label of the label button. */
  openLabel?: string;
  className?: string;
}

/** ‹ [ range · caption ▾ ] › — a week-at-a-time pager (design A "Week stepper"). */
export function WeekStepper(p: WeekStepperProps) {
  const inner = (
    <>
      <span className="uiwk-text">
        <b className="uiwk-label">{p.label}</b>
        {p.sub != null && <span className="uiwk-sub">{p.sub}</span>}
      </span>
      {p.onOpen && <Icon name="caret-down" weight="bold" />}
    </>
  );
  return (
    <div className={['uiwk', p.className].filter(Boolean).join(' ')}>
      <IconButton
        variant="secondary"
        shape="round"
        icon="caret-left"
        label={p.prevLabel}
        disabled={!p.canPrev}
        onClick={p.onPrev}
      />
      {p.onOpen ? (
        <button
          type="button"
          className="uiwk-pick uit--accent"
          aria-label={p.openLabel}
          onClick={p.onOpen}
        >
          {inner}
        </button>
      ) : (
        <div className="uiwk-pick uit--accent">{inner}</div>
      )}
      <IconButton
        variant="secondary"
        shape="round"
        icon="caret-right"
        label={p.nextLabel}
        disabled={!p.canNext}
        onClick={p.onNext}
      />
    </div>
  );
}
