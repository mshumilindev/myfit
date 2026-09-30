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
import { LanguageSelector } from '../ui';
import { SpotterMark } from '../brand/SpotterMark';
import { Avatar } from './Avatar';
import { Rail, RailItem } from './ui/Rail';
import { Button } from './ui/Button';

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
    <Rail
      brand={<SpotterMark size={40} variant="sidebar" />}
      foot={
        <>
          {/* Notifications — reachable from every app. */}
          <RailItem
            icon="bell"
            fill
            ariaLabel={t.notifTitle}
            badge={notifUnread > 0 ? (notifUnread > 9 ? '9+' : notifUnread) : null}
            onClick={onOpenNotifications}
          />
          {/* Apps — switch between Gym / Apex / People / Nutrition. */}
          <RailItem
            icon="squares-four"
            className="rail-switch"
            ariaLabel={t.shellSwitch}
            onClick={onOpenShell}
          />
          <div className="rail-lang">
            <LanguageSelector compact />
          </div>
          <Button
            variant="ghost"
            className="account-chip"
            onClick={onOpenProfile}
            aria-label={username}
            title={username}
          >
            <span className="account-avatar">
              <Avatar userId={currentUid() ?? undefined} name={username} hasPhoto size={34} />
            </span>
          </Button>
        </>
      }
    >
      {nav.map((x) => (
        <RailItem
          key={x.id}
          icon={x.icon}
          label={x.label}
          active={activeId === x.id}
          fillWhenActive
          onClick={() => onNav(x.id)}
        />
      ))}
    </Rail>
  );
}
