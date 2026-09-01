/**
 * Notifications inbox — the milestone feed (standards, PRs, achievements,
 * trends, streaks, weekly volume goal), grouped by recency, with unread rows
 * highlighted. Opened from the header bell; "Mark all read" clears the badge.
 * Works as a full screen on mobile and inside the desktop content column.
 */
import { useT } from '../i18n';
import { Icon } from '../ui';
import { isUnread, notifTime, type Notif, type NotifKind } from '../notifications';

const KIND_ICON: Record<NotifKind, string> = {
  standard: 'trophy',
  pr: 'barbell',
  feat: 'star',
  trend: 'chart-line-up',
  streak: 'fire',
  volume: 'check-circle',
};

function group(
  notifs: Notif[],
  now: number,
): { label: 'today' | 'week' | 'earlier'; items: Notif[] }[] {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const dayStart = startOfDay.getTime();
  const weekStart = now - 7 * 24 * 3600 * 1000;
  const today: Notif[] = [];
  const week: Notif[] = [];
  const earlier: Notif[] = [];
  for (const n of notifs) {
    if (n.ts >= dayStart) today.push(n);
    else if (n.ts >= weekStart) week.push(n);
    else earlier.push(n);
  }
  return [
    { label: 'today' as const, items: today },
    { label: 'week' as const, items: week },
    { label: 'earlier' as const, items: earlier },
  ].filter((g) => g.items.length > 0);
}

export function NotificationsView({
  notifs,
  now,
  seenTs,
  onMarkAll,
  onClose,
}: {
  notifs: Notif[];
  now: number;
  seenTs: number | null;
  onMarkAll: () => void;
  onClose: () => void;
}) {
  const { t, locale } = useT();
  const groups = group(notifs, now);
  const hasUnread = notifs.some((n) => isUnread(n, seenTs));

  const sectionLabel = (k: 'today' | 'week' | 'earlier') =>
    k === 'today' ? t.notifToday : k === 'week' ? t.notifThisWeek : t.notifEarlier;

  return (
    <div className="screen notif-screen" style={{ gap: 'var(--space-4)' }}>
      <div className="notif-head">
        <button className="back" onClick={onClose} aria-label={t.backAction}>
          <Icon name="caret-left" />
        </button>
        <h2 className="title-26">{t.notifTitle}</h2>
        {hasUnread && (
          <button className="notif-markall" onClick={onMarkAll}>
            {t.notifMarkAll}
          </button>
        )}
      </div>

      {notifs.length === 0 ? (
        <div className="notif-empty">
          <div className="notif-empty-ic">
            <Icon name="bell" />
          </div>
          <div className="notif-empty-title">{t.notifEmptyTitle}</div>
          <div className="notif-empty-body">{t.notifEmptyBody}</div>
        </div>
      ) : (
        <div className="notif-feed">
          {groups.map((g) => (
            <div className="notif-group" key={g.label}>
              <div className="notif-group-label">{sectionLabel(g.label)}</div>
              <div className="notif-rows">
                {g.items.map((n) => {
                  const unread = isUnread(n, seenTs);
                  return (
                    <div
                      key={n.id}
                      className={`notif-row nkind-${n.kind}${unread ? ' unread' : ''}`}
                    >
                      {unread && <span className="notif-dot" />}
                      <span className="notif-ic">
                        <Icon name={KIND_ICON[n.kind]} weight="fill" />
                      </span>
                      <div className="notif-main">
                        <div className="notif-title">{n.title}</div>
                        <div className="notif-sub">{n.subtitle}</div>
                      </div>
                      <span className="notif-time">{notifTime(n.ts, now, t, locale)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
