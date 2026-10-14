import { lazy, Suspense } from 'react';
import { Badge } from '../../components/ui/Badge';
import { IconButton } from '../../components/ui/Button';
import { useChatT } from '../../i18n/coachChat';
import type { CoachRoute } from '../routes';
import { dock, useDock } from './dockStore';
import './ChatDock.css';

const Panel = lazy(() => import('./ChatDockPanel'));

export interface ChatDockProps {
  /** total unread, the same number as the nav badge */
  unread: number;
  onNavigate: (r: CoachRoute) => void;
}

/**
 * Desktop chat dock (plan 2.5, >= 1280 only, hidden on the Chat screen): a round button with the total unread count
 * and a 440 px frosted panel (about 96% opaque) that holds the list and one thread. Session-only state. The button sits below dialogs and
 * sheets in the stacking order, so any open overlay covers it. The panel code loads on first open.
 */
export function ChatDock({ unread, onNavigate }: ChatDockProps) {
  const { ch } = useChatT();
  const { open } = useDock();
  return (
    <div className="cd-dock" role="region" aria-label={ch.chDockLabel}>
      {open && (
        <div className="cd-panel">
          <Suspense fallback={null}>
            <Panel onNavigate={onNavigate} />
          </Suspense>
        </div>
      )}
      <span className="cd-fab">
        <IconButton
          label={open ? ch.chDockClose : ch.chDockOpen}
          icon={open ? 'x' : 'chat-circle'}
          variant="primary"
          shape="round"
          aria-expanded={open}
          onClick={() => dock.toggle()}
        />
        {!open && <Badge n={unread} anchor="corner" tone="danger" />}
      </span>
    </div>
  );
}
