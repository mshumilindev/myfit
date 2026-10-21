/**
 * Shell — the suite launcher. A bottom sheet, opened from the header app icon,
 * that switches between the Spotter apps: Gym (the tracker), Apex (gamification),
 * Nutrition, People, Learn and Coach. Silver, neutral chrome — the apps supply the
 * colour: every tile wears its own app's accent (IconTile, caret, and the outline + tint + check
 * of the current tile).
 */
import type { ReactNode } from 'react';
import { useT } from '../i18n';
import { useCoachT } from '../i18n/coach';
import { coachEntryHash } from '../coach/routes';
import { useCoachAccess } from '../coach/useCoachAccess';
import { Card } from './ui/Card';
import { IconTile } from './ui/IconTile';
import { SUITE_TONE } from './suite/suiteTone';
import { toneClass, type Tone } from './ui/tones';
import { Icon, Sheet } from '../ui';
import { consistencyStreak, type StoreState } from '../store';
import { setHash } from '../route';
import { getRole } from '../api';
import { canUsePeople } from '../views/rosterAccess';

const DAY = 24 * 3600 * 1000;

/** One launcher row. `tone` is the app's fixed identity family (gold, amethyst, lazurite,
 *  silver, tourmaline, rubellite); it colours the IconTile, the caret and the current tile. */
function AppTile({
  tone,
  icon,
  name,
  badge,
  sub,
  current,
  locked,
  onSelect,
  currentLabel,
  soon,
}: {
  tone: Tone;
  icon: string;
  name: ReactNode;
  badge?: ReactNode;
  sub: ReactNode;
  current: boolean;
  locked?: boolean;
  onSelect?: () => void;
  currentLabel: string;
  /** Locked tiles show no caret and no current mark. */
  soon?: boolean;
}) {
  return (
    <Card
      as="button"
      pad="none"
      className={['shell-tile', toneClass(tone), current ? 'current' : '', locked ? 'locked' : '']
        .filter(Boolean)
        .join(' ')}
      selected={current}
      aria-current={current ? 'true' : undefined}
      onClick={locked ? undefined : onSelect}
      disabled={locked || current}
    >
      <IconTile tone={tone} size={48} icon={icon} />
      <div className="shell-tile-main">
        <div className="shell-tile-name">
          {name}
          {badge}
        </div>
        <div className={`shell-tile-sub${soon ? ' soon' : ''}`}>{sub}</div>
      </div>
      {locked ? null : current ? (
        <span className="shell-current">
          <Icon name="check-circle" />
          {currentLabel}
        </span>
      ) : (
        <Icon name="caret-right" className="shell-go" />
      )}
    </Card>
  );
}

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
  onClose,
}: {
  store: StoreState;
  now: number;
  /** `me` = the own-account screen (People chrome, but not the Users app: no tile is current). */
  current: 'gym' | 'apex' | 'roster' | 'me' | 'nutrition' | 'learn' | 'coach';
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
  onClose: () => void;
}) {
  const { t } = useT();
  const { c } = useCoachT();
  // Coach dashboard entry: trainer or admin, flag on (coach/access.ts). Hidden otherwise.
  const coachEnabled = useCoachAccess();
  const peopleEnabled = canUsePeople(getRole());
  const sessionsWeek = store.workouts.filter(
    (w) => w.finishedAt !== null && w.startedAt >= now - 7 * DAY,
  ).length;
  const streak = consistencyStreak(now);

  return (
    <Sheet
      onClose={onClose}
      className="shell-sheet"
      tone={SUITE_TONE[current === 'me' ? 'roster' : current]}
      label={t.shellSwitch}
    >
      <div className="shell-head">{t.shellSwitch}</div>
      <div className="shell-tiles">
        <AppTile
          tone="gym"
          icon="barbell"
          name={t.shellGym}
          sub={`${t.shellSessionsWeek(sessionsWeek)} · ${t.shellDayStreak(streak)}`}
          current={current === 'gym'}
          onSelect={onGym}
          currentLabel={t.shellCurrent}
        />
        <AppTile
          tone="apex"
          icon="trophy"
          name={t.apexName}
          badge={
            notifUnread > 0 ? (
              <span className="shell-badge">{notifUnread > 9 ? '9+' : notifUnread}</span>
            ) : undefined
          }
          sub={t.shellActiveNew(activeChallenges, notifUnread)}
          current={current === 'apex'}
          onSelect={onApex}
          currentLabel={t.shellCurrent}
        />
        <AppTile
          tone="kcal"
          icon="fork-knife"
          name={t.shellNutrition}
          sub={
            nutritionEnabled ? (
              t.shellNutritionDesc
            ) : (
              <>
                <Icon name="clock" /> {t.shellComingSoon}
              </>
            )
          }
          soon={!nutritionEnabled}
          locked={!nutritionEnabled}
          current={current === 'nutrition'}
          onSelect={onNutrition}
          currentLabel={t.shellCurrent}
        />
        {/* Users (user management) is admin-only; Me is reached from the avatar, not from a tile. */}
        {(peopleEnabled || current === 'roster') && (
          <AppTile
            tone="people"
            icon="user-focus"
            name={peopleLabel}
            sub={peopleDesc}
            current={current === 'roster'}
            onSelect={onRoster}
            currentLabel={t.shellCurrent}
          />
        )}
        {(coachEnabled || current === 'coach') && (
          <AppTile
            tone="coach"
            icon="chalkboard-teacher"
            name={c.modeCoach}
            sub={c.shellDesc}
            current={current === 'coach'}
            onSelect={() => {
              setHash(coachEntryHash());
              onClose();
            }}
            currentLabel={t.shellCurrent}
          />
        )}
        <AppTile
          tone="learn"
          icon="graduation-cap"
          name={t.shellLearn}
          sub={t.shellLearnDesc}
          current={current === 'learn'}
          onSelect={onLearn}
          currentLabel={t.shellCurrent}
        />
      </div>
    </Sheet>
  );
}
