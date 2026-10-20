import { useRef, useState } from 'react';
import { ConfirmEffectsDialog } from '../../components/ui/ConfirmEffectsDialog';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { InfoTable } from '../../components/ui/InfoTable';
import { ResponsivePanel } from '../../components/ui/ResponsivePanel';
import { Switch } from '../../components/ui/Switch';
import { Tag } from '../../components/ui/Tag';
import { useTeamT } from '../../i18n/coachTeam';
import { ClientAvatar } from '../ClientAvatar';
import { coachDayMonth, coachMoment } from '../format';
import type { ActivityScope, TeamMember } from './types';

/**
 * One team member's card (the owner trainer opens a manager's): role, email, when added, last seen, how many clients
 * already handed over the schedule key, the "See all team activity" switch, and Remove. Board D17 / D17b / D21.
 */
export function MemberSheet({
  member,
  onClose,
  onScope,
  onRemove,
}: {
  member: TeamMember;
  onClose: () => void;
  onScope: (scope: ActivityScope) => void;
  onRemove: () => Promise<void>;
}) {
  const { tm, locale } = useTeamT();
  const anchor = useRef<HTMLElement | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const rows = [
    {
      id: 'role',
      label: tm.tmRole,
      value: member.role === 'manager' ? tm.tmRoleManager : tm.tmRoleTrainer,
    },
    ...(member.email ? [{ id: 'email', label: tm.tmEmailRow, value: member.email }] : []),
    ...(member.addedAt != null
      ? [{ id: 'added', label: tm.tmAddedRow, value: coachDayMonth(member.addedAt, locale) }]
      : []),
    ...(member.lastActiveAt != null
      ? [{ id: 'last', label: tm.tmLastActiveRow, value: coachMoment(member.lastActiveAt, locale) }]
      : []),
    ...(member.scheduleReady
      ? [
          {
            id: 'sched',
            label: tm.tmScheduleAccess,
            value: tm.tmScheduleReady(member.scheduleReady.ready, member.scheduleReady.total),
          },
        ]
      : []),
  ];

  return (
    <>
      <ResponsivePanel
        open
        mode="sheet"
        anchorRef={anchor}
        onClose={onClose}
        label={tm.tmMemberTitle}
        title={tm.tmMemberTitle}
      >
        <div className="tm-sheet">
          <div className="tm-sheet-head">
            <ClientAvatar id={member.uid} name={member.name} size={48} />
            <div>
              <h3 className="tm-sheet-title">{member.name}</h3>
              <Tag tone={member.role === 'manager' ? 'accent' : 'neutral'}>
                {member.role === 'manager' ? tm.tmRoleManager : tm.tmRoleTrainer}
              </Tag>
            </div>
          </div>
          <InfoTable rows={rows} label={tm.tmMemberTitle} />
          {member.role === 'manager' && (
            <GroupedList header={tm.tmPermissions} surface="raised">
              <ListRow
                as="label"
                label={tm.tmSeeAll}
                sub={tm.tmSeeAllOff(member.name.split(' ')[0])}
                trailing={
                  <Switch
                    checked={member.activityScope === 'all'}
                    onChange={(on) => onScope(on ? 'all' : 'own')}
                    aria-label={tm.tmSeeAll}
                  />
                }
              />
            </GroupedList>
          )}
          <GroupedList surface="raised" footer={tm.tmRemoveNote(member.name.split(' ')[0])}>
            <ListRow
              action
              tone="danger"
              label={tm.tmRemoveFromTeam}
              onClick={() => setConfirm(true)}
            />
          </GroupedList>
        </div>
      </ResponsivePanel>
      {confirm && (
        <ConfirmEffectsDialog
          title={tm.tmRemoveTitle(member.name.split(' ')[0])}
          body={tm.tmRemoveBody(member.name.split(' ')[0])}
          effects={[
            { icon: 'lock', text: tm.tmRemoveEffect1 },
            { icon: 'key', text: tm.tmRemoveEffect2(member.name.split(' ')[0]) },
            { icon: 'clock-counter-clockwise', text: tm.tmRemoveEffect3 },
          ]}
          confirmLabel={tm.tmRemoveConfirm}
          cancelLabel={tm.tmRemoveKeep(member.name.split(' ')[0])}
          loading={busy}
          onConfirm={async () => {
            setBusy(true);
            try {
              await onRemove();
            } finally {
              setBusy(false);
            }
          }}
          onCancel={() => setConfirm(false)}
        />
      )}
    </>
  );
}
