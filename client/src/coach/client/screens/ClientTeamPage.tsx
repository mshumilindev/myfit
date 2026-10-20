import { EmptyState } from '../../../components/ui/EmptyState';
import { FailedState } from '../../../components/ui/FailedState';
import { GroupedList, ListRow } from '../../../components/ui/GroupedList';
import { IconTile } from '../../../components/ui/IconTile';
import { Notice } from '../../../components/ui/Notice';
import { SkeletonRows } from '../../../components/ui/Skeleton';
import { Tag } from '../../../components/ui/Tag';
import { useChatT } from '../../../i18n/coachChat';
import { useClientT } from '../../../i18n/coachClient';
import { ClientAvatar } from '../../ClientAvatar';
import { clock, dayLabel } from '../../chat/format';
import type { ClientCoachPort } from '../data/port';
import { PushedPage } from './PushedPage';
import { useClientTeam } from './useClientTeam';

/**
 * "Your trainer's team" (SPO-205, board C2): who works with the trainer, what they can and cannot see, and what managers did
 * with this client's schedule. Names and roles only. Built from standard parts.
 */
export function ClientTeamPage({ port, onBack }: { port: ClientCoachPort; onBack: () => void }) {
  const { cc, locale } = useClientT();
  const { ch } = useChatT();
  const { team, failed, retry } = useClientTeam(port);
  const now = port.now();
  return (
    <PushedPage title={cc.tmgTitle} backLabel={cc.ccBack} onBack={onBack}>
      {!team && failed && (
        <FailedState title={cc.tmgFailed} retryLabel={cc.ccRetry} onRetry={retry} />
      )}
      {!team && !failed && <SkeletonRows rows={4} label={cc.ccLoading} />}
      {team && (
        <>
          <Notice tone="rest" icon="shield-check" aligned>
            {cc.tmgCan} {cc.tmgCannot}
          </Notice>
          <GroupedList header={cc.tmgPeople}>
            {team.members.map((m) => (
              <ListRow
                key={`${m.role}-${m.name}`}
                icon={<ClientAvatar id={m.name} name={m.name} size={40} hasPhoto={false} />}
                label={m.name}
                strong
                trailing={
                  <Tag tone={m.role === 'manager' ? 'accent' : 'neutral'}>
                    {m.role === 'manager' ? cc.tmgRoleManager : cc.tmgRoleTrainer}
                  </Tag>
                }
              />
            ))}
          </GroupedList>
          <GroupedList header={cc.tmgActionsHead}>
            {team.actions.length === 0 ? (
              <ListRow label={cc.tmgActionsNone} />
            ) : (
              team.actions.map((a) => (
                <ListRow
                  key={a.id}
                  icon={<IconTile tone="neutral" size={30} icon="calendar-dots" />}
                  label={cc.tmgKind[a.kind] ?? a.kind}
                  sub={a.actorName}
                  value={`${dayLabel(a.ts, now, ch, locale)} ${clock(a.ts)}`}
                />
              ))
            )}
          </GroupedList>
        </>
      )}
      {team && team.members.length === 0 && (
        <EmptyState titleAs="h2" icon="users" title={cc.tmgActionsNone} body={cc.tmgCannot} />
      )}
    </PushedPage>
  );
}
