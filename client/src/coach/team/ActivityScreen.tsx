import { useEffect, useMemo, useState } from 'react';
import { BackButton } from '../../components/ui/BackButton';
import { EmptyState } from '../../components/ui/EmptyState';
import { FailedState } from '../../components/ui/FailedState';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { IconTile } from '../../components/ui/IconTile';
import { Segmented } from '../../components/ui/Segmented';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { SkeletonRows } from '../../components/ui/Skeleton';
import type { Tone } from '../../components/ui/tones';
import { Tag } from '../../components/ui/Tag';
import { useTeamT } from '../../i18n/coachTeam';
import { coachClock, coachDayMonth } from '../format';
import { Header, Page } from '../layout/Layout';
import type { CoachRoute } from '../routes';
import type { TeamPort } from './port';
import type { ActivityRow, TeamActivity } from './types';
import { getTeamPort, useTeam } from './useTeam';
import './ActivityScreen.css';

const ALL = 'all';
const DAY = 86_400_000;

/** "Irina M." */
const shortName = (full: string): string => {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[1]![0]}.` : full;
};

const startOfDay = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const KIND_ICON: Record<ActivityRow['kind'], string> = {
  'move-request': 'swap',
  'move-cancel': 'x-circle',
  'removal-request': 'minus-circle',
  'removal-approved': 'check-circle',
  'removal-declined': 'x-circle',
  'removal-cancelled': 'arrow-counter-clockwise',
  'session-done': 'check-circle',
  'session-missed': 'warning-circle',
  'session-cancelled': 'x-circle',
  'session-edited': 'calendar-dots',
  'member-added': 'users',
  'member-removed': 'minus-circle',
  'member-left': 'sign-out',
  'client-invite': 'envelope',
};

const STATUS_TONE: Record<string, Tone> = {
  pending: 'warmup',
  accepted: 'ok',
  approved: 'ok',
  done: 'ok',
};

/**
 * Activity log (SPO-203 / SPO-238, boards D18 / D19 / D20): who did what, by day. The owner trainer reads everything; a manager
 * reads their own actions, or the whole team's once the owner allowed it. Metadata only: no client content is ever in a row.
 */
export function ActivityScreen({
  onNavigate,
  port,
  now,
}: {
  onNavigate: (r: CoachRoute) => void;
  port?: TeamPort;
  /** tests / stories pin the clock; the app uses the real one */
  now?: number;
}) {
  const { tm, locale } = useTeamT();
  const p = port ?? getTeamPort();
  const { state } = useTeam(port);
  const [log, setLog] = useState<TeamActivity | null>(null);
  const [failed, setFailed] = useState(false);
  const [who, setWho] = useState<string>(ALL);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    p.activity().then(
      (a) => live && setLog(a),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [p, attempt]);

  const [clock] = useState(() => now ?? p.now?.() ?? Date.now());
  const ownerName = state.data?.ownerName ?? '';

  const viewerUid = state.data?.me.uid;
  const actors = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of log?.entries ?? []) m.set(e.actorUid, e.actorName);
    // the viewer's own chip comes last (board D18)
    return [...m.entries()].sort(([a], [b]) => Number(a === viewerUid) - Number(b === viewerUid));
  }, [log, viewerUid]);

  const back = (
    <BackButton
      text={tm.tmTitle}
      label={tm.tmTitle}
      onClick={() => onNavigate({ screen: 'team' })}
    />
  );

  if (!log) {
    return (
      <Page>
        <Header eyebrow={back} title={tm.actTitle} slots={false} />
        {failed ? (
          <FailedState
            title={tm.actFailed}
            retryLabel={tm.tmRetry}
            onRetry={() => {
              setFailed(false);
              setAttempt((n) => n + 1);
            }}
          />
        ) : (
          <SkeletonRows rows={6} />
        )}
      </Page>
    );
  }

  const scope = log.scope;
  const subtitle =
    scope === 'owner'
      ? tm.actSubOwner
      : scope === 'all'
        ? tm.actSubAll
        : `${tm.actSubOwn} ${tm.actSubOwnHint(shortName(ownerName))}`;
  const filterable = scope !== 'own';
  const mine = (uid: string) => uid === viewerUid;
  const options = [
    { value: ALL, label: scope === 'owner' ? tm.actEveryone : tm.actEveryone },
    ...actors.map(([uid, name]) => ({
      value: uid,
      label: mine(uid) ? (scope === 'owner' ? tm.actMe : tm.actMine) : shortName(name),
    })),
  ];
  const visible = log.entries
    .filter((e) => who === ALL || e.actorUid === who)
    .sort((a, b) => b.ts - a.ts);

  const today = startOfDay(clock);
  const groups: { key: number; label: string; rows: ActivityRow[] }[] = [];
  for (const e of visible) {
    const day = startOfDay(e.ts);
    let g = groups[groups.length - 1];
    if (!g || g.key !== day) {
      g = {
        key: day,
        label:
          day === today
            ? tm.actToday
            : day === today - DAY
              ? tm.actYesterday
              : coachDayMonth(day, locale),
        rows: [],
      };
      groups.push(g);
    }
    g.rows.push(e);
  }

  return (
    <Page>
      <Header eyebrow={back} title={tm.actTitle} slots={false} subtitle={subtitle} />
      {filterable && actors.length > 1 && (
        <Segmented
          label={tm.actFilterLabel}
          variant="track"
          hug
          scroll
          options={options}
          value={who}
          onChange={setWho}
        />
      )}
      {groups.length === 0 ? (
        <EmptyState
          icon="clock-counter-clockwise"
          title={tm.actEmptyTitle}
          body={tm.actEmptyBody}
        />
      ) : (
        groups.map((g) => (
          <section key={g.key} aria-label={g.label} className="act-day">
            <SectionLabel role="heading" aria-level={2}>
              {g.label}
            </SectionLabel>
            <GroupedList list label={`${tm.actListLabel}: ${g.label}`}>
              {g.rows.map((e) => (
                <li key={e.id}>
                  <ListRow
                    strong
                    icon={
                      <IconTile
                        tone={e.role === 'manager' ? 'accent' : 'neutral'}
                        size={40}
                        icon={KIND_ICON[e.kind]}
                      />
                    }
                    label={tm.actKind[e.kind] ?? e.kind}
                    sub={[shortName(e.actorName), e.subjectName, coachClock(e.ts)].join(' · ')}
                    trailing={
                      e.liveStatus ? (
                        <Tag tone={STATUS_TONE[e.liveStatus] ?? 'neutral'}>
                          {tm.actStatus[e.liveStatus] ?? e.liveStatus}
                        </Tag>
                      ) : undefined
                    }
                  />
                </li>
              ))}
            </GroupedList>
          </section>
        ))
      )}
    </Page>
  );
}
