import type { HTMLAttributes, ReactNode } from 'react';
import { Button } from './Button';
import { Chip, type ChipTone } from './Chip';
import './SyncStatus.css';

/**
 * What the sync indicator says. `synced` is the quiet resting state; the rest
 * describe background work or a connectivity problem. None of them blocks the
 * app: offline is a normal state, so only `failed` is tinted as an error.
 */
export type SyncStatusState = 'synced' | 'syncing' | 'saving' | 'slow' | 'offline' | 'failed';

export interface SyncStatusProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  state: SyncStatusState;
  /** The visible text (already localised). */
  children: ReactNode;
  /** When set, a small Retry button is shown (offline / slow / failed). */
  onRetry?: () => void;
  retryLabel?: string;
  /**
   * Float over the shell, top-centre under the safe area. The wrapper ignores
   * pointer events, so only the Retry button is tappable and nothing is covered
   * in a way that blocks the screen underneath.
   */
  floating?: boolean;
}

/** Which kit Chip tone and icon each state wears. */
const LOOK: Record<SyncStatusState, { tone: ChipTone; icon: string }> = {
  synced: { tone: 'ok', icon: 'check-circle' },
  syncing: { tone: 'accent', icon: 'arrows-clockwise' },
  saving: { tone: 'accent', icon: 'arrows-clockwise' },
  slow: { tone: 'neutral', icon: 'hourglass' },
  offline: { tone: 'neutral', icon: 'cloud-slash' },
  failed: { tone: 'danger', icon: 'warning-circle' },
};

/**
 * A small, non-modal sync indicator: a kit `Chip` (tone + icon) with an optional kit link `Button`
 * for Retry. Announced politely to assistive tech; never traps focus, never dims the page.
 * Replaces full-screen "Syncing…" scrims and spinners.
 */
export function SyncStatus({
  state,
  children,
  onRetry,
  retryLabel,
  floating = false,
  className,
  ...rest
}: SyncStatusProps) {
  const cls = ['uisync', `uisync--${state}`, floating ? 'uisync--floating' : '', className]
    .filter(Boolean)
    .join(' ');
  const look = LOOK[state];
  return (
    <div className={cls} role="status" aria-live="polite" data-sync-state={state} {...rest}>
      <Chip tone={look.tone} size="xs" icon={look.icon} className="uisync-chip">
        {children}
      </Chip>
      {onRetry && (
        <Button variant="link" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
