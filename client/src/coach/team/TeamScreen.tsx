import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { ConfirmEffectsDialog } from '../../components/ui/ConfirmEffectsDialog';
import { FailedState } from '../../components/ui/FailedState';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { IconTile } from '../../components/ui/IconTile';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { Tag } from '../../components/ui/Tag';
import { useTeamT } from '../../i18n/coachTeam';
import { coachDayMonth } from '../format';
import { ClientAvatar } from '../ClientAvatar';
import { Header, Inspector, Page, Split } from '../layout/Layout';
import { AddMemberSheet } from './AddMemberSheet';
import { MemberSheet } from './MemberSheet';
import type { TeamPort } from './port';
import { agoLabel, lastActiveLabel } from './teamTime';
import { canRemoveMembers, inviteeRole, type TeamMember } from './types';
import { useTeam } from './useTeam';
import './TeamScreen.css';

type Dialog = null | { kind: 'add' } | { kind: 'member'; uid: string } | { kind: 'leave' };

/**
 * Team (SPO-196): who is in the team, pending invites, the way to the activity log and the role matrix, and Leave.
 * A trainer adds managers, a manager adds trainers, nobody picks a role. Only the owner trainer opens a manager's card
 * (settings, Remove); anyone can leave on their own. Board: Design "Desktop Team" D12 / D13.
 */
export function TeamScreen({ port }: { port?: TeamPort }) {
  const { tm, locale } = useTeamT();
  const { store, state } = useTeam(port);
  const [dialog, setDialog] = useState<Dialog>(null);
  const data = state.data;

  if (!data) {
    return (
      <Page>
        <Header title={tm.tmTitle} />
        {state.status === 'failed' ? (
          <FailedState
            title={tm.tmLoadFailed}
            retryLabel={tm.tmRetry}
            onRetry={() => void store.load()}
          />
        ) : (
          <SkeletonRows rows={4} />
        )}
      </Page>
    );
  }

  const { me, members, invites, asOf } = data;
  const isOwnerTrainer = canRemoveMembers(me);
  const addLabel = me.role === 'trainer' ? tm.tmAddManager : tm.tmAddTrainer;
  const roleName = (r: TeamMember['role']) =>
    r === 'manager' ? tm.tmRoleManager : tm.tmRoleTrainer;
  const memberSub = (m: TeamMember) => {
    const last = lastActiveLabel(tm, locale, asOf, m.lastActiveAt);
    return [
      m.you ? tm.tmYou : null,
      m.role === 'manager' && !m.you && m.addedAt != null
        ? tm.tmAdded(coachDayMonth(m.addedAt, locale))
        : null,
      last,
    ]
      .filter(Boolean)
      .join(' · ');
  };
  const opened = dialog?.kind === 'member' ? members.find((m) => m.uid === dialog.uid) : undefined;
  const close = () => setDialog(null);

  return (
    <Page>
      <Header
        title={tm.tmTitle}
        slots={false}
        subtitle={
          me.role === 'trainer' ? tm.tmSubTrainer(members.length) : tm.tmSubManager(members.length)
        }
        actions={
          <Button variant="primary" icon="user-plus" onClick={() => setDialog({ kind: 'add' })}>
            {addLabel}
          </Button>
        }
      />
      <Split ratio="8-4">
        <div className="tm-main">
          <section aria-label={tm.tmMembersLabel}>
            <SectionLabel action={members.length} role="heading" aria-level={2}>
              {tm.tmMembers}
            </SectionLabel>
            <GroupedList list label={tm.tmMembersLabel}>
              {members.map((m) => {
                const openable = isOwnerTrainer && m.role === 'manager' && !m.you;
                return (
                  <li key={m.uid}>
                    <ListRow
                      strong
                      icon={<ClientAvatar id={m.uid} name={m.name} size={40} />}
                      label={m.name}
                      sub={memberSub(m)}
                      trailing={
                        <Tag tone={m.role === 'manager' ? 'accent' : 'neutral'}>
                          {roleName(m.role)}
                        </Tag>
                      }
                      chevron={openable}
                      onClick={
                        openable ? () => setDialog({ kind: 'member', uid: m.uid }) : undefined
                      }
                      aria-label={openable ? tm.tmOpenMember(m.name) : undefined}
                    />
                  </li>
                );
              })}
            </GroupedList>
          </section>
          {invites.length > 0 && (
            <section aria-label={tm.tmPendingLabel}>
              <SectionLabel action={invites.length} role="heading" aria-level={2}>
                {tm.tmPending}
              </SectionLabel>
              <GroupedList list label={tm.tmPendingLabel}>
                {invites.map((i) => (
                  <li key={i.id}>
                    <ListRow
                      strong
                      icon={<IconTile tone="neutral" size={40} icon="envelope" />}
                      label={i.email}
                      sub={tm.tmInviteSent(roleName(i.role), agoLabel(tm, asOf, i.sentAt))}
                      trailing={
                        <>
                          <Tag tone="neutral">{tm.tmPendingTag}</Tag>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={tm.tmRevokeFor(i.email)}
                            onClick={() => void store.revokeInvite(i.id)}
                          >
                            {tm.tmRevoke}
                          </Button>
                        </>
                      }
                    />
                  </li>
                ))}
              </GroupedList>
            </section>
          )}
        </div>
        <Inspector bare label={tm.tmTitle}>
          <div className="tm-side">
            <GroupedList>
              <ListRow
                icon={<IconTile tone="accent" size={30} icon="clock-counter-clockwise" />}
                label={tm.tmActivityLog}
                sub={tm.tmActivityLogSub}
                chevron
                onClick={() => undefined}
              />
              <ListRow
                icon={<IconTile tone="accent" size={30} icon="shield-check" />}
                label={tm.tmRoles}
                sub={tm.tmRolesSub}
                chevron
                onClick={() => undefined}
              />
            </GroupedList>
            <GroupedList>
              <ListRow
                action
                tone="danger"
                label={tm.tmLeave}
                onClick={() => setDialog({ kind: 'leave' })}
              />
            </GroupedList>
            <p className="tm-side-note">
              {me.role === 'trainer' ? tm.tmLeaveNoteTrainer : tm.tmLeaveNoteManager}
            </p>
          </div>
        </Inspector>
      </Split>

      {dialog?.kind === 'add' && (
        <AddMemberSheet
          role={inviteeRole(me.role)}
          onClose={close}
          onSend={(email) => store.invite(email)}
        />
      )}
      {opened && (
        <MemberSheet
          member={opened}
          onClose={close}
          onScope={(scope) => void store.setActivityScope(opened.uid, scope)}
          onRemove={async () => {
            await store.removeMember(opened.uid);
            close();
          }}
        />
      )}
      {dialog?.kind === 'leave' && (
        <ConfirmEffectsDialog
          title={
            me.role === 'trainer' ? tm.tmLeaveTrainerTitle : tm.tmLeaveManagerTitle(data.ownerName)
          }
          body={me.role === 'trainer' ? tm.tmLeaveTrainerBody : tm.tmLeaveManagerBody}
          effects={
            me.role === 'trainer'
              ? [
                  { icon: 'users', text: tm.tmLeaveTrainerEffect1 },
                  { icon: 'key', text: tm.tmLeaveTrainerEffect2 },
                  { icon: 'arrow-counter-clockwise', text: tm.tmLeaveTrainerEffect3 },
                ]
              : [
                  { icon: 'users', text: tm.tmLeaveManagerEffect1 },
                  { icon: 'arrow-counter-clockwise', text: tm.tmLeaveManagerEffect2 },
                  { icon: 'clock-counter-clockwise', text: tm.tmLeaveManagerEffect3 },
                ]
          }
          confirmLabel={tm.tmLeaveConfirm}
          cancelLabel={tm.tmLeaveStay}
          loading={state.busy}
          onConfirm={async () => {
            await store.leave();
            close();
          }}
          onCancel={close}
        />
      )}
    </Page>
  );
}
