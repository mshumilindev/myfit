import type { ButtonHTMLAttributes } from 'react';
import './SetRow.css';

export interface SetRowProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Warm-up set: values are dimmed. */
  warm?: boolean;
  /** Personal record: ok-tinted row. */
  record?: boolean;
  /** Timed / cardio grid (index · value · value · tags). */
  timed?: boolean;
  /** Row carries a load meter (its gauge is set through `style`). */
  metered?: boolean;
}

/**
 * One logged set (kit `setrow`): index · reps · load · tags. The parent lays
 * the cells out as `.idx`, `.val`, `.kind` children. Keeps the legacy
 * `set-row` class so the session's row variants (drops, rest rows) still
 * hook onto it — the base look lives here, once.
 */
export function SetRow({
  warm = false,
  record = false,
  timed = false,
  metered = false,
  className,
  type = 'button',
  ...rest
}: SetRowProps) {
  const cls = [
    'uisetrow',
    'set-row',
    timed ? 'timed' : '',
    warm ? 'warm' : '',
    record ? 'record' : '',
    metered ? 'metered' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={cls} {...rest} />;
}
