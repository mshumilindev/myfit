/**
 * Nutrition — the food/КБЖУ app, integrated into the Spotter suite. The whole
 * thing (its own lazurite kit, store and views) lives under ./nutrition. Its
 * stylesheet is namespaced under `.app-nutrition`, and NutritionRoot renders
 * that scope itself (alongside the shared `.apex-app` sub-app chrome), so this
 * wrapper just forwards the suite props.
 */
import './nutrition/nutrition.css';
import { NutritionRoot } from './nutrition/App';
import type { Notif, NotifState } from './notifications';

export function NutritionApp({
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
    <NutritionRoot
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
