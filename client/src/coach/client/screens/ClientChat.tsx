import { useSafeT } from '../../../i18n/coachSafe';
import { KeyChangeBanner } from '../../security/KeyChangeBanner';
import { SecurityCodeDialog } from '../../security/SecurityCodeDialog';
import { useSecurity } from '../../security/useSecurity';
import { useEffect, useMemo, useRef, useState } from 'react';
import { IconButton } from '../../../components/ui/Button';
import { ChatShell } from '../../../components/ui/ChatShell';
import { type MessageMenuItem } from '../../../components/ui/MessageMenu';
import { NoteCard } from '../../../components/ui/NoteCard';
import { Notice } from '../../../components/ui/Notice';
import { SkeletonRows } from '../../../components/ui/Skeleton';
import { useChatT } from '../../../i18n/coachChat';
import { useClientT } from '../../../i18n/coachClient';
import { useNotesT } from '../../../i18n/coachNotes';
import { useScheduleT } from '../../../i18n/coachSchedule';
import { ClientAvatar } from '../../ClientAvatar';
import { clock } from '../../chat/format';
import {
  ClearChatDialog,
  DeleteMessageDialog,
  ThreadBody,
  ThreadComposer,
  ThreadMenu,
  buildThreadRows,
  firstNewIdOf,
  messageMenuItems,
  useFlash,
  useMarkRead,
  useMenuState,
  useThreadScroll,
  type ThreadConfirm,
} from '../../chat/core';
import { NotesHost } from '../../notes/NotesHost';
import { noteTime } from '../../notes/labels';
import { useClientNotes } from '../../notes/useNotes';
import { ShareCardView, useWords as useShareWords } from '../../share/ShareCardView';
import { SharePicker } from '../../share/SharePicker';
import type { ShareSourcePort } from '../../share/port';
import { resolveShare } from '../../share/resolve';
import { rememberShare, type Filter } from '../../share/search';
import { parseShareRef, type ShareRef, type ShareView } from '../../share/types';
import { useShareSource } from '../../share/useShare';
import type { People } from '../../schedule/people';
import type { SchedulePort } from '../../schedule/port';
import { firstName } from '../../screens/format';
import type { ClientChatPort } from '../data/chatPort';
import type { ClientCoachPort } from '../data/port';
import { useClientThread } from '../data/useClientChat';
import { useClientCoach } from '../data/useClientCoach';
import { PushedPage } from './PushedPage';
import { TrainerUnavailable } from './TrainerUnavailable';
import { ClientChatBar } from './clientChat/ClientChatBar';
import { renderClientBody } from './clientChat/renderClientBody';
import { ClientRescheduleSheet, useMySessions } from './ClientSchedule';
import '../../chat/Chat.css';
import '../ClientCoach.css';
import { useOnline } from './clientChat/useOnline';

export interface ClientChatProps {
  port?: ClientCoachPort;
  chatPort?: ClientChatPort;
  schedulePort?: SchedulePort;
  onBack: () => void;
  onOpenSharing: () => void;
  onOpenTrainer?: () => void;
  onOpenProgram?: () => void;
  /** Stories: open the notes drawer / the reschedule form at mount. */
  initial?: {
    notes?: boolean;
    reschedule?: boolean;
    picker?: { q?: string; filter?: Filter };
    pending?: ShareRef;
  };
  /** The share source (fixtures until the real adapter). */
  sharePort?: ShareSourcePort;
}

/**
 * Chat with my trainer (S-35, R-KIT-10). The trainer's thread seen from the other side: "me" is `from: 'client'`.
 * Bubbles / composer / confirm / undo are the shared kit pieces. Header: What they see (eye), Notes from my trainer
 * (pencil with the count), menu (Clear chat, My trainer). Shared notes sit between the messages by time, read-only.
 * The "New messages" line is fixed when the thread opens and its count equals the Today tile badge (one source).
 */
export function ClientChat(p: ClientChatProps) {
  const { cc } = useClientT();
  const shw = useShareWords();
  const { ch, locale } = useChatT();
  const { nt } = useNotesT();
  const { s: sc } = useScheduleT();
  const {
    snapshot,
    status: linkStatus,
    problem: linkProblem,
    store: linkStore,
  } = useClientCoach(p.port);
  const link = snapshot?.link ?? null;
  const cid = link?.cid ?? null;
  const trainer = link?.trainer ?? null;
  const first = firstName(trainer?.name ?? '');
  const online = useOnline();
  const th = useClientThread(cid, p.chatPort);
  const { store, messages, status, unread: unreadAtOpenRaw } = th;
  const my = useMySessions(p.schedulePort);
  const notes = useClientNotes(link?.clientId ?? null);
  const sharedNotes = useMemo(() => notes.notes.filter((n) => n.vis === 'shared'), [notes.notes]);
  const now = store.port.now();

  const [draft, setDraft] = useState('');
  const { menu, setMenu, anchor, openMenu } = useMenuState();
  const [confirm, setConfirm] = useState<ThreadConfirm>(null);
  const { flash, setFlash, copy } = useFlash(ch);
  // Security code of the trainer's key: a change shows the banner in the thread and a one-time toast
  const { sf } = useSafeT();
  const [codeOpen, setCodeOpen] = useState(false);
  const security = useSecurity(trainer?.id ?? null, cid, {
    onChange: () => setFlash(sf.scChangedToast(first)),
  });
  const [notesOpen, setNotesOpen] = useState(p.initial?.notes ?? false);
  const [form, setForm] = useState(p.initial?.reschedule ?? false);
  const [counterId, setCounterId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(!!p.initial?.picker);
  const [queued, setQueued] = useState<ShareRef | null>(p.initial?.pending ?? null);
  const shareAnchor = useRef<HTMLElement | null>(null);
  const viewer = useMemo(
    () => ({ side: 'client' as const, clientId: link?.clientId ?? '' }),
    [link?.clientId],
  );
  const { source: shareSource } = useShareSource(viewer.clientId, p.sharePort);
  const pendingView = useMemo<ShareView | null>(
    () => (queued && shareSource ? resolveShare(queued, viewer, shareSource) : null),
    [queued, shareSource, viewer],
  );
  const inChat = useMemo(
    () =>
      messages
        .filter((m) => !m.deleted && m.body.kind === 'share')
        .map((m) => (m.body.kind === 'share' ? parseShareRef(m.body.share) : null))
        .filter((r): r is ShareRef => !!r)
        .reverse(),
    [messages],
  );

  // the unread number of the moment the thread opened fixes the line
  const [openedWith, setOpenedWith] = useState<number | null>(null);
  if (status === 'ready' && openedWith === null) setOpenedWith(unreadAtOpenRaw);
  const firstNewId = firstNewIdOf(messages, 'trainer', openedWith ?? 0);

  useMarkRead(
    status,
    store,
    cid,
    messages.filter((m) => m.from === 'trainer' && !m.deleted).length,
  );
  useEffect(() => () => store.settle(), [store]);
  const { scroller } = useThreadScroll({
    status,
    ready: openedWith !== null,
    messages,
    firstNewId,
    mineFrom: 'client',
  });

  // the schedule card talks about the trainer, never about other people
  const people: People = useMemo(
    () => ({
      list: [],
      byId: new Map(),
      name: () => trainer?.name ?? '',
      first: () => first,
      loading: false,
    }),
    [trainer?.name, first],
  );

  const menuMsg = menu && menu !== 'head' ? messages.find((m) => m.id === menu) : undefined;
  const menuData = menuMsg
    ? messageMenuItems({
        m: menuMsg,
        mine: menuMsg.from === 'client',
        first,
        ch,
        copy,
        askDelete: (id) => setConfirm({ kind: 'msg', id }),
      })
    : null;
  const delTarget = confirm?.kind === 'msg' ? messages.find((m) => m.id === confirm.id) : undefined;

  const rows = useMemo(
    () =>
      buildThreadRows({
        ch,
        locale,
        now,
        messages,
        notes: sharedNotes,
        firstNewId,
        mineFrom: 'client',
        first,
        them: (
          <>
            <ClientAvatar
              id={trainer?.id}
              name={trainer?.name ?? ''}
              size={24}
              hasPhoto={trainer?.hasPhoto}
            />
            {first}
          </>
        ),
        openMenuId: menu,
        openMenu,
        onRetry: (m) => store.retry(m.id),
        noteSide: 'them',
        noteLabel: (n) => `${cc.chNoteFrom(first)}, ${clock(n.at)}`,
        renderNote: (n) => (
          <NoteCard
            vis="shared"
            visLabel={nt.nFrom(first)}
            time={noteTime(ch, nt, locale, n, now)}
            text={n.text}
            expandLabel={nt.nExpand}
            collapseLabel={nt.nCollapse}
          />
        ),
        renderOther: (m, mine) =>
          renderClientBody(
            {
              ch,
              cc,
              shw,
              first,
              viewer,
              people,
              sharePort: p.sharePort,
              schedulePort: p.schedulePort,
              onOpenProgram: p.onOpenProgram,
              onOpenSharing: p.onOpenSharing,
              onCounter: (reqId) => {
                setCounterId(reqId);
                setForm(true);
              },
            },
            m,
            mine,
          ),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      messages,
      sharedNotes,
      firstNewId,
      menu,
      ch,
      cc,
      nt,
      locale,
      first,
      trainer,
      now,
      store,
      people,
      p.schedulePort,
      p.sharePort,
      p.onOpenProgram,
      p.onOpenSharing,
      viewer,
      shw,
    ],
  );

  const pending = th.state.pending;
  const toast = pending && pending.cid === cid ? pending : null;
  const cleared = status === 'ready' && messages.length === 0 && toast?.kind === 'chat';
  const empty = status === 'ready' && messages.length === 0 && sharedNotes.length === 0;

  // No link yet: the same page shell as every client coach screen (title, back, paddings), a short skeleton or a plain error
  if (!link || !trainer)
    return (
      <PushedPage title={cc.mtTitle} backLabel={cc.ccBack} onBack={p.onBack}>
        {linkStatus === 'error' ? (
          <TrainerUnavailable
            problem={linkProblem ?? 'unknown'}
            onRetry={linkStore.retry}
            onSharing={p.onOpenSharing}
          />
        ) : (
          <SkeletonRows rows={4} label={ch.chMessagesLabel} />
        )}
      </PushedPage>
    );

  return (
    <div className="cc-chat-page">
      <ChatShell
        head={
          <ClientChatBar
            cc={cc}
            ch={ch}
            trainer={trainer}
            lastSeenAt={link.lastSeenAt}
            first={first}
            notesCount={sharedNotes.length}
            notesOpen={notesOpen}
            menuOpen={menu === 'head'}
            onBack={p.onBack}
            onOpenSharing={p.onOpenSharing}
            onOpenNotes={() => setNotesOpen(true)}
            onOpenMenu={(el) => openMenu('head', el)}
          />
        }
        foot={
          <ThreadComposer
            ch={ch}
            value={draft}
            onChange={setDraft}
            onSend={() => {
              if ((!draft.trim() && !queued) || !cid) return;
              store.send(
                cid,
                draft,
                queued
                  ? { kind: 'share', share: queued, text: draft.trim() || undefined }
                  : undefined,
              );
              if (queued) rememberShare(queued);
              setQueued(null);
              setDraft('');
            }}
            allowEmpty={!!queued}
            lead={
              <IconButton
                icon="share-network"
                variant="secondary"
                shape="round"
                label={shw.sh.pickAria}
                aria-haspopup="dialog"
                aria-expanded={pickerOpen}
                onClick={(e) => {
                  shareAnchor.current = e.currentTarget;
                  setPickerOpen(true);
                }}
              />
            }
            placeholder={queued ? shw.sh.pendingPlaceholder : cc.chPlaceholder(first)}
            chips={
              pendingView || (my && my.upcoming.length > 0) ? (
                <>
                  {pendingView && (
                    <div className="cc-pend">
                      <ShareCardView view={pendingView} who={first} density="dock" />
                      <IconButton
                        icon="x"
                        label={shw.sh.pendingRemove}
                        onClick={() => setQueued(null)}
                      />
                    </div>
                  )}
                  {my && my.upcoming.length > 0 && (
                    <IconButton
                      icon="swap"
                      variant="secondary"
                      shape="round"
                      label={sc.rcChipAria}
                      title={sc.rcChip}
                      onClick={() => setForm(true)}
                    />
                  )}
                </>
              ) : undefined
            }
          />
        }
        overlays={
          <>
            <SharePicker
              open={pickerOpen}
              onClose={() => setPickerOpen(false)}
              anchorRef={shareAnchor}
              viewer={viewer}
              who={first}
              inChat={inChat}
              port={p.sharePort}
              initialQuery={p.initial?.picker?.q}
              initialFilter={p.initial?.picker?.filter}
              onPick={(r) => {
                setQueued(r);
                setPickerOpen(false);
              }}
            />

            <ThreadMenu
              ch={ch}
              menu={menu}
              anchor={anchor}
              onClose={() => setMenu(null)}
              msg={menuMsg}
              data={menuData}
              headItems={[
                ...(p.onOpenTrainer
                  ? [
                      {
                        id: 'trainer',
                        icon: 'user',
                        label: cc.chMenuTrainer,
                        onSelect: () => p.onOpenTrainer?.(),
                      } as MessageMenuItem,
                    ]
                  : []),
                {
                  id: 'code',
                  icon: 'shield-check',
                  label: sf.scMenu,
                  onSelect: () => setCodeOpen(true),
                } as MessageMenuItem,
                {
                  id: 'clear',
                  icon: 'trash',
                  label: ch.chClear,
                  danger: true,
                  hint: ch.chClearHint,
                  onSelect: () => setConfirm({ kind: 'chat' }),
                },
              ]}
            />

            {confirm?.kind === 'msg' && delTarget && delTarget.body.kind === 'text' && cid && (
              <DeleteMessageDialog
                ch={ch}
                first={first}
                quote={delTarget.body.text}
                onCancel={() => setConfirm(null)}
                onConfirm={() => {
                  store.deleteMessage(cid, delTarget.id);
                  setConfirm(null);
                }}
              />
            )}
            {confirm?.kind === 'chat' && cid && (
              <ClearChatDialog
                ch={ch}
                first={first}
                count={messages.filter((m) => !m.deleted).length}
                onCancel={() => setConfirm(null)}
                onConfirm={() => {
                  store.clearChat(cid);
                  setConfirm(null);
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
            {my && form && (
              <ClientRescheduleSheet
                my={my}
                counterOf={counterId ? my.requests.find((r) => r.id === counterId) : undefined}
                onClose={() => {
                  setForm(false);
                  setCounterId(null);
                }}
                onOpenChat={() => {
                  setForm(false);
                  setCounterId(null);
                }}
              />
            )}
          </>
        }
      >
        {!online && (
          <Notice tone="note" icon="cloud-slash" className="ch-note">
            {ch.chOffline}
          </Notice>
        )}
        {security.changed && (
          <KeyChangeBanner
            className="ch-note"
            name={first}
            onReview={() => {
              security.acknowledge();
              setCodeOpen(true);
            }}
          />
        )}
        {codeOpen && (
          <SecurityCodeDialog
            security={security}
            side="client"
            name={first}
            onClose={() => setCodeOpen(false)}
          />
        )}

        <ThreadBody
          ch={ch}
          scroller={scroller}
          status={status}
          messageCount={messages.length}
          online={online}
          onRetryLoad={th.retry}
          empty={empty}
          cleared={cleared}
          first={first}
          showLog={rows.length > 0}
          logLabel={ch.chThreadLabel(trainer.name)}
          rows={rows}
          toast={toast}
          flash={flash}
          onUndo={() => store.undo()}
        />
      </ChatShell>
    </div>
  );
}
