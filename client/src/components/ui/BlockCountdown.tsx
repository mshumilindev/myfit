import type { ReactNode } from 'react';
import { Button } from './Button';
import { Ring } from './Ring';
import './BlockCountdown.css';

export interface BlockCountdownProps {
  /** Seconds left, `total`..1. Ignored while `go`. */
  n: number;
  /** Seconds the countdown starts from (ring and dots scale to it). */
  total?: number;
  /** The "GO" beat: the block clock has just started. */
  go?: boolean;
  /** Last seconds that get the warning colour. */
  warnAt?: number;
  /** Top line (the format tag, e.g. a `Tag`). */
  tag?: ReactNode;
  /** What is about to start ("12 min · target 8 rounds"). */
  title: string;
  /** Word shown instead of the digit on the GO beat. */
  goLabel: string;
  /** Hint above Cancel; differs before / after GO. */
  hint: string;
  cancelLabel: string;
  ariaLabel: string;
  onCancel: () => void;
  /** Tap anywhere on the stage skips the countdown. */
  onSkip?: () => void;
  /** Storybook / design shots only: pause the pop animation mid-flight. */
  still?: boolean;
}

/** Full-screen "get ready" countdown before a timed block starts (kit `blockcountdown`). The caller owns the clock and sound. */
export function BlockCountdown({
  n,
  total = 5,
  go = false,
  warnAt = 3,
  tag,
  title,
  goLabel,
  hint,
  cancelLabel,
  ariaLabel,
  onCancel,
  onSkip,
  still = false,
}: BlockCountdownProps) {
  const last = !go && n <= warnAt;
  const left = go ? total : Math.max(0, Math.min(total, n));
  const cls = ['uicd', last && 'uicd--last', go && 'uicd--go', still && 'uicd--still']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <div className="uicd-top">
        {tag}
        <div className="uicd-title">{title}</div>
      </div>
      <div
        className="uicd-stage"
        onClick={onSkip}
        role={onSkip ? 'button' : undefined}
        tabIndex={onSkip ? 0 : undefined}
        onKeyDown={(e) => {
          if (onSkip && (e.key === 'Enter' || e.key === ' ')) onSkip();
        }}
      >
        <Ring
          value={(left / total) * 100}
          size={280}
          width={10}
          tone={go ? 'ok' : last ? 'danger' : 'accent'}
          label={go ? goLabel : String(n)}
        >
          <div className="uicd-num" key={go ? 'go' : n} aria-live="assertive">
            {go ? goLabel : n}
          </div>
        </Ring>
        <div className="uicd-dots" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => total - i).map((i) => (
            <i key={i} className={go || i >= n ? 'on' : ''} />
          ))}
        </div>
      </div>
      <div className="uicd-foot">
        <div className="uicd-hint">{hint}</div>
        <Button variant="secondary" size="lg" fullWidth onClick={onCancel}>
          {cancelLabel}
        </Button>
      </div>
    </div>
  );
}
