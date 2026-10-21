import { useState } from 'react';
import { navigateHash } from '../../../navigateHash';
import { Button } from '../../../components/ui/Button';
import { useSafeT } from '../../../i18n/coachSafe';
import { useReauthGuard } from '../../security/useReauthGuard';
import { SecurityCodeDialog } from '../../security/SecurityCodeDialog';
import { useSecurity } from '../../security/useSecurity';
import { Card } from '../../../components/ui/Card';
import { GroupedList, ListRow } from '../../../components/ui/GroupedList';
import { IconTile } from '../../../components/ui/IconTile';
import { ConfirmDialog } from '../../../components/ui/Overlays';
import { SkeletonRows } from '../../../components/ui/Skeleton';
import { Notice } from '../../../components/ui/Notice';
import { Tag } from '../../../components/ui/Tag';
import { sinceDate } from '../labels';
import { useChatT } from '../../../i18n/coachChat';
import { useClientT } from '../../../i18n/coachClient';
import { ClientAvatar } from '../../ClientAvatar';
import { dayLabel } from '../../chat/format';
import { NotesHost } from '../../notes/NotesHost';
import { useClientNotes } from '../../notes/useNotes';
import { firstName } from '../../screens/format';
import type { ClientCoachPort } from '../data/port';
import { useClientCoach } from '../data/useClientCoach';
import type { SchedulePort } from '../../schedule/port';
import { ClientRescheduleSheet, UpcomingSessions, useMySessions } from './ClientSchedule';
import { TrainerUnavailable } from './TrainerUnavailable';
import { NoTrainerPage } from './NoTrainerPage';
import { ClientTeamPage } from './ClientTeamPage';
import { ClientMoveRequests } from './ClientMoveRequests';
import { ClientSpotterRow } from '../spotter/ClientSpotterRow';
import { useClientTeam } from './useClientTeam';
import { PushedPage } from './PushedPage';
import type { RescheduleRequest, ScheduleSlot } from '../../schedule/types';

export interface MyTrainerPageProps {
  port?: ClientCoachPort;
  schedulePort?: SchedulePort;
  onBack: () => void;
  onChat: () => void;
  /** the pinned Spotter row above the chat (default: the hash route) */
  onSpotter?: () => void;
  onSharing: () => void;
  onProgram: () => void;
  /** after leaving: back to Today */
  onLeft: () => void;
}

/** "My trainer" (a pushed page): who, chat and sharing, upcoming sessions with Move, the program, shared notes, leave. */
export function MyTrainerPage(p: MyTrainerPageProps) {
  const { cc, locale } = useClientT();
  const { ch } = useChatT();
  const { sf } = useSafeT();
  const { snapshot, store, status, problem: snapshotProblem } = useClientCoach(p.port);
  const link = snapshot?.link;
  const my = useMySessions(p.schedulePort);
  const notes = useClientNotes(link?.clientId ?? null);
  const security = useSecurity(link?.trainer?.id ?? null, link?.cid ?? link?.clientId ?? null);
  const [codeOpen, setCodeOpen] = useState(false);
  const { ask, dialog: reauthDialog } = useReauthGuard();
  const [leave, setLeave] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [move, setMove] = useState<{ slot?: ScheduleSlot; counterOf?: RescheduleRequest } | null>(
    null,
  );
  const [teamOpen, setTeamOpen] = useState(false);
  const teamInfo = useClientTeam(store.port);

  const trainer = link?.trainer;
  // Three different answers, never one eternal skeleton (.claude/rules/client-architecture.md: loading / empty / error):
  //   no snapshot yet  -> skeleton, or a FailedState with Retry when the subscription failed
  //   snapshot, no trainer link  -> the "no trainer" empty state with a way out
  if (!snapshot || !link)
    return (
      <PushedPage title={cc.mtTitle} backLabel={cc.ccBack} onBack={p.onBack}>
        {status === 'error' ? (
          <TrainerUnavailable
            problem={snapshotProblem ?? 'unknown'}
            onRetry={store.retry}
            onSharing={p.onSharing}
          />
        ) : (
          <SkeletonRows rows={4} label={cc.ccLoading} />
        )}
      </PushedPage>
    );
  if (link.state === 'none' || !trainer) return <NoTrainerPage onBack={p.onBack} />;
  const first = firstName(trainer.name);
  const prog = snapshot.program;
  const shared = notes.notes.filter((n) => n.vis === 'shared');
  const now = store.port.now();
  if (teamOpen) return <ClientTeamPage port={store.port} onBack={() => setTeamOpen(false)} />;

  return (
    <PushedPage title={cc.mtTitle} backLabel={cc.ccBack} onBack={p.onBack}>
      <ClientSpotterRow onOpen={p.onSpotter ?? (() => navigateHash('#/trainer/spotter'))} />
      <Card emphasis="hero" pad="lg" className="cc-hero">
        <ClientAvatar id={trainer.id} name={trainer.name} size={56} hasPhoto={trainer.hasPhoto} />
        <div className="cc-hero-t">
          <h2 className="cc-h2">{trainer.name}</h2>
          <span>{cc.invInviterAt(trainer.org)}</span>
          <span>{cc.mtSince(sinceDate(trainer.since, locale))}</span>
        </div>
        <div className="cc-hero-b">
          <Button variant="primary" size="md" icon="envelope" onClick={p.onChat}>
            {cc.mtChat}
          </Button>
          <Button variant="secondary" size="md" icon="eye" onClick={p.onSharing}>
            {cc.mtSharing}
          </Button>
        </div>
      </Card>

      {link.migrated && (
        <Notice
          tone="accent"
          icon="shield-check"
          aligned
          below={
            <Button variant="secondary" size="md" fullWidth onClick={p.onSharing}>
              {cc.mtSharing}
            </Button>
          }
        >
          {cc.mtMigratedNote(first)}
        </Notice>
      )}

      {my && (
        <ClientMoveRequests
          my={my}
          trainerFirst={first}
          onPropose={(r) => setMove({ counterOf: r })}
        />
      )}

      {my && <UpcomingSessions my={my} onMove={(s) => setMove({ slot: s })} />}

      {prog && (
        <GroupedList header={cc.mtProgramHead(first)}>
          <ListRow
            icon={<IconTile tone="accent" size={30} icon="copy" />}
            label={cc.mtProgramSub(`v${prog.version}`)}
            sub={`${dayLabel(prog.updatedAt, now, ch, locale)} · ${prog.summary}`}
            trailing={!prog.acked ? <Tag tone="accent">{cc.mtProgramNew}</Tag> : undefined}
            chevron
            strong
            onClick={p.onProgram}
          />
        </GroupedList>
      )}

      <GroupedList header={cc.mtNotesHead} footer={cc.mtNotesFoot(first)}>
        {shared.length === 0 ? (
          <ListRow label={cc.mtNotesNone} />
        ) : (
          shared
            .slice(0, 3)
            .map((n) => (
              <ListRow
                key={n.id}
                icon={<IconTile tone="people" size={30} icon="pencil-simple" />}
                label={n.text.split('\n')[0]}
                value={dayLabel(n.at, now, ch, locale)}
                chevron
                onClick={() => setNotesOpen(true)}
              />
            ))
        )}
        {shared.length > 0 && (
          <ListRow action tone="accent" label={cc.mtNotesOpen} onClick={() => setNotesOpen(true)} />
        )}
      </GroupedList>

      {teamInfo.team && teamInfo.team.members.length > 0 && (
        <GroupedList>
          <ListRow
            icon={<IconTile tone="people" size={30} icon="users" />}
            label={cc.mtTeamRow}
            sub={cc.mtTeamRowSub}
            chevron
            onClick={() => setTeamOpen(true)}
          />
        </GroupedList>
      )}

      <GroupedList>
        <ListRow
          icon={<IconTile tone="ok" size={30} icon="shield-check" />}
          label={cc.mtPrivacy}
          sub={cc.mtPrivacySub(first)}
          chevron
          onClick={p.onSharing}
        />
        <ListRow
          icon={<IconTile tone="accent" size={30} icon="shield-check" />}
          label={sf.scMenu}
          sub={
            security.verified ? sf.scVerified : security.changed ? sf.scChangedReviewSub : undefined
          }
          chevron
          onClick={() => setCodeOpen(true)}
        />
        <ListRow action tone="danger" label={cc.mtLeave} onClick={() => setLeave(true)} />
      </GroupedList>

      {reauthDialog}
      {codeOpen && (
        <SecurityCodeDialog
          security={security}
          side="client"
          name={first}
          onClose={() => setCodeOpen(false)}
        />
      )}
      {leave && (
        <ConfirmDialog
          title={cc.mtLeaveTitle(first)}
          body={cc.mtLeaveBody(first)}
          confirmLabel={cc.mtLeaveConfirm}
          cancelLabel={cc.mtLeaveKeep}
          danger
          icon="sign-out"
          onCancel={() => setLeave(false)}
          onConfirm={() => {
            setLeave(false);
            // ending the relationship asks for the password first (plan 2.7)
            void ask('end').then((yes) => yes && store.leave().then((ok) => ok && p.onLeft()));
          }}
        />
      )}
      <NotesHost
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        clientId={link.clientId}
        first=""
        coachFirst={first}
        side="client"
      />
      {my && move && (
        <ClientRescheduleSheet
          my={my}
          slot={move.slot}
          counterOf={move.counterOf}
          onClose={() => setMove(null)}
          onOpenChat={p.onChat}
        />
      )}
    </PushedPage>
  );
}
