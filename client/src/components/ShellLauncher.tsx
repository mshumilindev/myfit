/**
 * Shell — the suite launcher. A bottom sheet, opened from the header app icon,
 * that switches between the Spotter apps: Gym (the tracker), Apex (gamification)
 * and Nutrition (coming soon). Silver, neutral chrome — the apps supply the
 * colour. One account, one training history.
 */
import { useT } from '../i18n';
import { Icon, Sheet } from '../ui';
import { consistencyStreak, type StoreState } from '../store';

const DAY = 24 * 3600 * 1000;

export function ShellLauncher({
  store,
  now,
  current,
  peopleLabel,
  peopleDesc,
  activeChallenges,
  notifUnread,
  onGym,
  onApex,
  onRoster,
  onClose,
}: {
  store: StoreState;
  now: number;
  current: 'gym' | 'apex' | 'roster';
  peopleLabel: string;
  peopleDesc: string;
  activeChallenges: number;
  notifUnread: number;
  onGym: () => void;
  onApex: () => void;
  onRoster: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const sessionsWeek = store.workouts.filter(
    (w) => w.finishedAt !== null && w.startedAt >= now - 7 * DAY,
  ).length;
  const streak = consistencyStreak(now);

  return (
    <Sheet onClose={onClose} className="shell-sheet">
      <div className="shell-head">{t.shellSwitch}</div>
      <div className="shell-tiles">
        <button
          className={`shell-tile${current === 'gym' ? ' current' : ''}`}
          onClick={onGym}
          disabled={current === 'gym'}
        >
          <span className="shell-ic shell-ic-gym">
            <Icon name="barbell" weight="fill" />
          </span>
          <div className="shell-tile-main">
            <div className="shell-tile-name">{t.shellGym}</div>
            <div className="shell-tile-sub">
              {t.shellSessionsWeek(sessionsWeek)} · {t.shellDayStreak(streak)}
            </div>
          </div>
          {current === 'gym' ? (
            <span className="shell-current">{t.shellCurrent}</span>
          ) : (
            <Icon name="caret-right" className="shell-go" />
          )}
        </button>

        <button
          className={`shell-tile${current === 'apex' ? ' current' : ''}`}
          onClick={onApex}
          disabled={current === 'apex'}
        >
          <span className="shell-ic shell-ic-apex">
            <Icon name="trophy" weight="fill" />
          </span>
          <div className="shell-tile-main">
            <div className="shell-tile-name">
              {t.apexName}
              {notifUnread > 0 && (
                <span className="shell-badge">{notifUnread > 9 ? '9+' : notifUnread}</span>
              )}
            </div>
            <div className="shell-tile-sub">{t.shellActiveNew(activeChallenges, notifUnread)}</div>
          </div>
          {current === 'apex' ? (
            <span className="shell-current">{t.shellCurrent}</span>
          ) : (
            <Icon name="caret-right" className="shell-go" />
          )}
        </button>

        <button
          className={`shell-tile${current === 'roster' ? ' current' : ''}`}
          onClick={onRoster}
          disabled={current === 'roster'}
        >
          <span className="shell-ic shell-ic-people">
            <Icon name="user-focus" weight="fill" />
          </span>
          <div className="shell-tile-main">
            <div className="shell-tile-name">{peopleLabel}</div>
            <div className="shell-tile-sub">{peopleDesc}</div>
          </div>
          {current === 'roster' ? (
            <span className="shell-current">{t.shellCurrent}</span>
          ) : (
            <Icon name="caret-right" className="shell-go" />
          )}
        </button>

        <div className="shell-tile locked" aria-disabled="true">
          <span className="shell-ic shell-ic-nut">
            <Icon name="fork-knife" />
          </span>
          <div className="shell-tile-main">
            <div className="shell-tile-name">{t.shellNutrition}</div>
            <div className="shell-tile-sub soon">
              <Icon name="lock-simple" />
              {t.shellComingSoon}
            </div>
          </div>
        </div>
      </div>
      <div className="shell-note">{t.shellNote}</div>
    </Sheet>
  );
}
