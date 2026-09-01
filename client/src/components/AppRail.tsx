/**
 * Sub-app desktop rail (Apex, People…). Mirrors the Gym rail's icon layout — a
 * brand app-icon on top, icon-only nav tiles, and a foot with the notifications
 * bell, the apps switcher and the account avatar. The accent skin comes from the
 * wrapping .app-* theme, so the same markup turns amethyst in Apex and silver in
 * People with no per-app styling. Hidden under 720px, where the mobile header +
 * bottom nav take over.
 */
import { currentUid, getUsername } from '../api';
import { useT } from '../i18n';
import { Icon } from '../ui';
import { SpotterMark } from '../brand/SpotterMark';
import { Avatar } from './Avatar';

export type RailNavItem = { id: string; icon: string; label: string };

export function AppRail({
  nav,
  activeId,
  onNav,
  onOpenShell,
  onOpenNotifications,
  onOpenProfile,
  notifUnread,
}: {
  nav: RailNavItem[];
  activeId: string | null;
  onNav: (id: string) => void;
  onOpenShell: () => void;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  notifUnread: number;
}) {
  const { t } = useT();
  const username = getUsername() ?? '';
  return (
    <aside className="rail">
      {/* Brand mark — the same across every app's rail. */}
      <div className="rail-brand">
        <SpotterMark size={40} variant="sidebar" />
      </div>
      {nav.map((x) => (
        <button
          key={x.id}
          className={`rail-item${activeId === x.id ? ' active' : ''}`}
          aria-label={x.label}
          title={x.label}
          onClick={() => onNav(x.id)}
        >
          <Icon name={x.icon} weight={activeId === x.id ? 'fill' : undefined} />
          <span className="rail-label">{x.label}</span>
        </button>
      ))}
      <div className="rail-foot">
        {/* Notifications — reachable from every app. */}
        <button
          className="rail-item"
          onClick={onOpenNotifications}
          aria-label={t.notifTitle}
          title={t.notifTitle}
        >
          <Icon name="bell" weight="fill" />
          {notifUnread > 0 && (
            <span className="rail-notif-badge">{notifUnread > 9 ? '9+' : notifUnread}</span>
          )}
        </button>
        {/* Apps — switch between Gym / Apex / People / Nutrition. */}
        <button
          className="rail-item rail-switch"
          onClick={onOpenShell}
          aria-label={t.shellSwitch}
          title={t.shellSwitch}
        >
          <Icon name="squares-four" />
        </button>
        <button
          className="account-chip"
          onClick={onOpenProfile}
          aria-label={username}
          title={username}
        >
          <span className="account-avatar">
            <Avatar userId={currentUid() ?? undefined} name={username} hasPhoto size={34} />
          </span>
        </button>
      </div>
    </aside>
  );
}
