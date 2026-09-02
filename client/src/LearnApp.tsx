/**
 * Learn — how-to videos, integrated into the Spotter suite. The module lives
 * under ./learn (its own gem-accented stylesheet, catalog and views). This
 * wrapper imports the stylesheet and forwards the suite props, exactly like
 * NutritionApp.
 */
import './learn/learn.css';
import { LearnRoot } from './learn/App';
import type { Notif, NotifState } from './notifications';

export function LearnApp({
  now,
  onOpenShell,
  onOpenProfile,
  notifs,
  notifState,
  notifUnread,
  onNotifSeen,
  onNotifMarkAll,
}: {
  now: number;
  onOpenShell: () => void;
  onOpenProfile: () => void;
  notifs: Notif[];
  notifState: NotifState;
  notifUnread: number;
  onNotifSeen: (ids: string[]) => void;
  onNotifMarkAll: () => void;
}) {
  return (
    <LearnRoot
      now={now}
      onOpenShell={onOpenShell}
      onOpenProfile={onOpenProfile}
      notifs={notifs}
      notifState={notifState}
      notifUnread={notifUnread}
      onNotifSeen={onNotifSeen}
      onNotifMarkAll={onNotifMarkAll}
    />
  );
}
