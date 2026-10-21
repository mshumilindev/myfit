import type { HTMLAttributes } from 'react';

export interface HintProps extends HTMLAttributes<HTMLElement> {
  /**
   * `quiet` — a faint one-line note under a lens or history (`<p>`); `field` — the hint line beside a
   * field or hint row in an editor (`<div>`).
   */
  variant?: 'quiet' | 'field';
}

/**
 * A quiet, informational line (kit `hint`): context that changes no number. Renders in the muted text
 * scale of its surface; put the sentence in `children`. Not for errors (`FailedState`) or for a
 * dismissible message (`Banner`).
 */
export function Hint({ variant = 'quiet', className, children, ...rest }: HintProps) {
  const cls = [variant === 'quiet' ? 'uihint ut-xs ut-faint' : 'uihint se-hint', className]
    .filter(Boolean)
    .join(' ');
  const Tag = variant === 'quiet' ? 'p' : 'div';
  return (
    <Tag className={cls} {...rest}>
      {children}
    </Tag>
  );
}
