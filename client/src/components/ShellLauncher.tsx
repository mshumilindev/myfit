/**
 * Shell — the suite launcher. A bottom sheet, opened from the header app icon,
 * that switches between the Spotter apps: Gym (the tracker), Apex (gamification)
 * and Nutrition (coming soon). Silver, neutral chrome — the apps supply the
 * colour. One account, one training history.
 */
import { useState } from 'react';
import { useT } from '../i18n';
import { Card } from './ui/Card';
import { IconTile } from './ui/IconTile';
import { ConfirmDialog, Icon, Sheet } from '../ui';
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
  onNutrition,
  nutritionEnabled,
  onLearn,
  onSignOut,
  onClose,
}: {
  store: StoreState;
  now: number;
  current: 'gym' | 'apex' | 'roster' | 'nutrition' | 'learn';
  peopleLabel: string;
  peopleDesc: string;
  activeChallenges: number;
  notifUnread: number;
  onGym: () => void;
  onApex: () => void;
  onRoster: () => void;
  onNutrition: () => void;
  nutritionEnabled: boolean;
  onLearn: () => void;
  onSignOut: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const sessionsWeek = store.workouts.filter(
    (w) => w.finishedAt !== null && w.startedAt >= now - 7 * DAY,
  ).length;
  const streak = consistencyStreak(now);

  return (
    <Sheet onClose={onClose} className="shell-sheet">
      <div className="shell-head">{t.shellSwitch}</div>
      <div className="shell-tiles">
        <Card
          as="button"
          pad="none"
          tone={current === 'gym' ? 'accent' : 'neutral'}
          emphasis={current === 'gym' ? 'hero' : 'card'}
          className={`shell-tile${current === 'gym' ? ' current' : ''}`}
          onClick={onGym}
          disabled={current === 'gym'}
        >
          <IconTile tone="gym" size={48} icon="barbell" />
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
        </Card>

        <Card
          as="button"
          pad="none"
          tone={current === 'apex' ? 'accent' : 'neutral'}
          emphasis={current === 'apex' ? 'hero' : 'card'}
          className={`shell-tile${current === 'apex' ? ' current' : ''}`}
          onClick={onApex}
          disabled={current === 'apex'}
        >
          <IconTile tone="apex" size={48} icon="trophy" />
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
        </Card>

        <Card
          as="button"
          pad="none"
          tone={current === 'nutrition' ? 'accent' : 'neutral'}
          emphasis={current === 'nutrition' ? 'hero' : 'card'}
          className={`shell-tile${current === 'nutrition' ? ' current' : ''}${
            nutritionEnabled ? '' : ' locked'
          }`}
          onClick={nutritionEnabled ? onNutrition : undefined}
          disabled={!nutritionEnabled || current === 'nutrition'}
        >
          <IconTile tone="kcal" size={48} icon="fork-knife" />
          <div className="shell-tile-main">
            <div className="shell-tile-name">{t.shellNutrition}</div>
            {nutritionEnabled ? (
              <div className="shell-tile-sub">{t.shellNutritionDesc}</div>
            ) : (
              <div className="shell-tile-sub soon">
                <Icon name="clock" /> {t.shellComingSoon}
              </div>
            )}
          </div>
          {nutritionEnabled ? (
            current === 'nutrition' ? (
              <span className="shell-current">{t.shellCurrent}</span>
            ) : (
              <Icon name="caret-right" className="shell-go" />
            )
          ) : null}
        </Card>

        <Card
          as="button"
          pad="none"
          tone={current === 'roster' ? 'accent' : 'neutral'}
          emphasis={current === 'roster' ? 'hero' : 'card'}
          className={`shell-tile${current === 'roster' ? ' current' : ''}`}
          onClick={onRoster}
          disabled={current === 'roster'}
        >
          <IconTile tone="people" size={48} icon="user-focus" />
          <div className="shell-tile-main">
            <div className="shell-tile-name">{peopleLabel}</div>
            <div className="shell-tile-sub">{peopleDesc}</div>
          </div>
          {current === 'roster' ? (
            <span className="shell-current">{t.shellCurrent}</span>
          ) : (
            <Icon name="caret-right" className="shell-go" />
          )}
        </Card>

        <Card
          as="button"
          pad="none"
          tone={current === 'learn' ? 'accent' : 'neutral'}
          emphasis={current === 'learn' ? 'hero' : 'card'}
          className={`shell-tile${current === 'learn' ? ' current' : ''}`}
          onClick={onLearn}
          disabled={current === 'learn'}
        >
          <IconTile tone="learn" size={48} icon="graduation-cap" />
          <div className="shell-tile-main">
            <div className="shell-tile-name">{t.shellLearn}</div>
            <div className="shell-tile-sub">{t.shellLearnDesc}</div>
          </div>
          {current === 'learn' ? (
            <span className="shell-current">{t.shellCurrent}</span>
          ) : (
            <Icon name="caret-right" className="shell-go" />
          )}
        </Card>
      </div>
      <Card
        as="button"
        pad="none"
        tone="danger"
        className="shell-signout"
        onClick={() => setConfirmSignOut(true)}
      >
        <Icon name="sign-out" />
        <span>{t.signOut}</span>
      </Card>
      <div className="shell-note">{t.shellNote}</div>
      {confirmSignOut && (
        <ConfirmDialog
          title={t.signOutTitle}
          body={
            store.queue.length > 0 ? t.signOutQueueBody(store.queue.length) : t.signOutCleanBody
          }
          confirmLabel={t.signOut}
          cancelLabel={t.cancel}
          danger
          onCancel={() => setConfirmSignOut(false)}
          onConfirm={() => {
            setConfirmSignOut(false);
            onSignOut();
          }}
        />
      )}
    </Sheet>
  );
}
