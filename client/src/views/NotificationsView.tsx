/**
 * Notifications inbox — the milestone feed (standards, PRs, achievements,
 * trends, streaks, weekly volume goal), grouped by recency, with unread rows
 * highlighted. Opened from the header bell; "Mark all read" clears the badge.
 * Rows with a target are tappable (they route via the URL hash). The list is
 * rendered incrementally — more rows load as a bottom sentinel scrolls into
 * view — so a long history never mounts all at once. Works full-screen on
 * mobile and inside the desktop content column.
 */
import { useEffect, useRef, useState } from 'react';
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

const PAGE = 24;

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
  const [limit, setLimit] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);

  // Load more as the bottom sentinel scrolls near the viewport.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setLimit((l) => l + PAGE);
      },
      { rootMargin: '400px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const shown = notifs.slice(0, limit);
  const groups = group(shown, now);
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
                  const cls = `notif-row nkind-${n.kind}${unread ? ' unread' : ''}${
                    n.nav ? ' linked' : ''
                  }`;
                  const inner = (
                    <>
                      {unread && <span className="notif-dot" />}
                      <span className="notif-ic">
                        <Icon name={KIND_ICON[n.kind]} weight="fill" />
                      </span>
                      <div className="notif-main">
                        <div className="notif-title">{n.title}</div>
                        <div className="notif-sub">{n.subtitle}</div>
                      </div>
                      <span className="notif-time">{notifTime(n.ts, now, t, locale)}</span>
                      {n.nav && <Icon name="caret-right" className="notif-go" />}
                    </>
                  );
                  return n.nav ? (
                    <button
                      key={n.id}
                      className={cls}
                      onClick={() => {
                        window.location.hash = n.nav as string;
                      }}
                    >
                      {inner}
                    </button>
                  ) : (
                    <div key={n.id} className={cls}>
                      {inner}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div ref={sentinel} aria-hidden />
        </div>
      )}
    </div>
  );
}
