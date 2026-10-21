import { useEffect, useState } from 'react';
import { BackButton } from '../../components/ui/BackButton';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { FailedState } from '../../components/ui/FailedState';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { IconTile } from '../../components/ui/IconTile';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { Tag } from '../../components/ui/Tag';
import { useTeamT } from '../../i18n/coachTeam';
import { coachClock, coachDayMonth } from '../format';
import { Header, Page } from '../layout/Layout';
import type { CoachRoute } from '../routes';
import type { TeamPort } from './port';
import type { SpotterItem } from './types';
import { useSpotter } from './useSpotter';
import './SpotterScreen.css';

const shortName = (full: string): string => {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[1]![0]}.` : full;
};

const ICON: Record<SpotterItem['kind'], string> = {
  'removal-request': 'minus-circle',
  'removal-answer': 'check-circle',
  'manager-move': 'swap',
  team: 'user-plus',
  unmarked: 'clock',
};

/**
 * Spotter (SPO-236): the service messages about the team, newest first. A trainer answers a manager's removal request right
 * here (the same answer as in the Agenda); everything else is read-only. Opening the page marks the messages read. Push is
 * content-free: this page is where the content lives.
 */
export function SpotterScreen({
  onNavigate,
  port,
}: {
  onNavigate: (r: CoachRoute) => void;
  port?: TeamPort;
}) {
  const { tm, locale } = useTeamT();
  const { feed, failed, reload, answer, markRead } = useSpotter(port);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState(false);
  const hasUnread = (feed?.unread ?? 0) > 0;
  useEffect(() => {
    if (hasUnread) markRead();
  }, [hasUnread, markRead]);

  const back = (
    <BackButton text={tm.spBack} label={tm.spBack} onClick={() => onNavigate({ screen: 'team' })} />
  );
  if (!feed) {
    return (
      <Page>
        <Header eyebrow={back} title={tm.spTitle} slots={false} />
        {failed ? (
          <FailedState title={tm.spFailed} retryLabel={tm.tmRetry} onRetry={reload} />
        ) : (
          <SkeletonRows rows={4} />
        )}
      </Page>
    );
  }
  const text = (i: SpotterItem): string => {
    const who = shortName(i.actorName);
    switch (i.kind) {
      case 'removal-request':
        return tm.spRemovalRequest(who, i.subjectName);
      case 'removal-answer':
        return i.status === 'approved'
          ? tm.spRemovalAnswerYes(who, i.subjectName)
          : tm.spRemovalAnswerNo(who, i.subjectName);
      case 'manager-move':
        return tm.spManagerMove(who, i.subjectName);
      case 'unmarked':
        return tm.spUnmarked(i.subjectName);
      default:
        return i.subjectName === 'trainer' ? tm.spTeamTrainer(who) : tm.spTeamManager(who);
    }
  };
  const statusTag = (i: SpotterItem) => {
    if (i.kind !== 'removal-request' || !i.status || i.status === 'pending') return null;
    const label =
      i.status === 'approved'
        ? tm.spStatusApproved
        : i.status === 'declined'
          ? tm.spStatusDeclined
          : tm.spStatusCancelled;
    return <Tag tone={i.status === 'approved' ? 'ok' : 'neutral'}>{label}</Tag>;
  };
  const decide = async (i: SpotterItem, approve: boolean) => {
    if (!i.refId) return;
    setBusy(i.id);
    setProblem(!(await answer(i.refId, approve)));
    setBusy(null);
  };
  return (
    <Page>
      <Header
        eyebrow={back}
        title={tm.spTitle}
        slots={false}
        subtitle={hasUnread ? `${tm.spSub} ${tm.spUnread(feed.unread)}` : tm.spSub}
      />
      {problem && (
        <p role="alert" className="sp-problem">
          {tm.spFailed}
        </p>
      )}
      {feed.items.length === 0 ? (
        <EmptyState icon="envelope" title={tm.spEmptyTitle} body={tm.spEmptyBody} />
      ) : (
        <GroupedList list label={tm.spListLabel}>
          {feed.items.map((i) => (
            <li key={i.id}>
              <ListRow
                strong={i.unread}
                icon={
                  <IconTile tone={i.unread ? 'accent' : 'neutral'} size={40} icon={ICON[i.kind]} />
                }
                label={text(i)}
                sub={[
                  coachDayMonth(i.createdAt, locale),
                  coachClock(i.createdAt),
                  i.kind === 'removal-request' && i.status === 'pending' ? tm.spRemovalNote : null,
                  i.kind === 'manager-move' ? tm.spManagerMoveNote : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                trailing={
                  i.kind === 'removal-request' && i.status === 'pending' ? undefined : statusTag(i)
                }
              />
              {i.kind === 'removal-request' && i.status === 'pending' && (
                <div className="sp-actions">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy === i.id}
                    onClick={() => void decide(i, false)}
                  >
                    {tm.spDecline}
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={busy === i.id}
                    onClick={() => void decide(i, true)}
                  >
                    {tm.spApprove}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </GroupedList>
      )}
    </Page>
  );
}
