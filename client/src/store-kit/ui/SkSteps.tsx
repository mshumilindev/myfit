import type { CSSProperties, ReactNode } from 'react';
import { cx } from '../cx';
import { SK_ICONS } from '../icons';
import '../tokens-e.css';
import './SkSteps.css';

export type SkStepState = 'pending' | 'active' | 'done' | 'failed';

export interface SkStep {
  id: string;
  /** App/add-on tile (an SkTile or any node). */
  tile?: ReactNode;
  name: ReactNode;
  state: SkStepState;
  /** 0..100, shown as a bar while `active`. */
  progress?: number;
  /** Secondary line: "Starts after Injury log", "Could not install. Check your connection." */
  detail?: ReactNode;
  /** Short trailing status text: "Waiting", "Done". Defaults to the percentage while active. */
  status?: ReactNode;
  /** Trailing action, e.g. a "Try again" button (failed). */
  action?: ReactNode;
}

function Glyph({ name }: { name: 'check' | 'alert' }) {
  return (
    <svg className="sk-step-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <path d={SK_ICONS[name]} />
    </svg>
  );
}

/**
 * The installing list (boards 10, 11, 16): one row per item with a pending / active / done / failed state.
 * An ordered list; each row exposes its state to assistive tech through `stateLabels`.
 */
export function SkSteps({
  items,
  stateLabels,
  label,
  className,
}: {
  items: SkStep[];
  /** Visually hidden state words per language, e.g. { done: 'Done', ... }. Defaults to English. */
  stateLabels?: Partial<Record<SkStepState, string>>;
  label?: string;
  className?: string;
}) {
  const words: Record<SkStepState, string> = {
    pending: 'Waiting',
    active: 'Installing',
    done: 'Done',
    failed: 'Failed',
    ...stateLabels,
  };
  return (
    <ol className={cx('sk-steps', className)} aria-label={label}>
      {items.map((s) => {
        const pct = Math.max(0, Math.min(100, Math.round(s.progress ?? 0)));
        return (
          <li
            key={s.id}
            className={cx('sk-step', `sk-step-${s.state}`)}
            aria-current={s.state === 'active' ? 'step' : undefined}
            data-state={s.state}
          >
            {s.tile}
            <div className="sk-step-main">
              <div className="sk-step-name">
                {s.name}
                <span className="sk-sr">{`, ${words[s.state]}`}</span>
              </div>
              {s.state === 'active' ? (
                <div
                  className="sk-step-bar"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  aria-label={typeof s.name === 'string' ? s.name : undefined}
                >
                  <i style={{ '--sk-step-pct': `${pct}%` } as CSSProperties} />
                </div>
              ) : (
                s.detail && <div className="sk-step-detail">{s.detail}</div>
              )}
            </div>
            <div className="sk-step-end">
              {s.state === 'done' && <Glyph name="check" />}
              {s.state === 'failed' && s.action}
              {s.state === 'failed' && !s.action && <Glyph name="alert" />}
              {s.state === 'active' && (
                <span className="sk-step-status">{s.status ?? `${pct}%`}</span>
              )}
              {s.state === 'pending' && <span className="sk-step-status">{s.status}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
