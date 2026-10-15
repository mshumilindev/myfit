import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { BackButton } from '../../components/ui/BackButton';
import { IconButton } from '../../components/ui/Button';
import { ChatShell } from '../../components/ui/ChatShell';
import { ChatBubble } from '../../components/ui/ChatBubble';
import { ConfirmEffectsDialog } from '../../components/ui/ConfirmEffectsDialog';
import { Notice } from '../../components/ui/Notice';
import { COACH_BREAKPOINT, useMinWidth } from '../../components/ui/breakpoints';
import { clock } from './format';
import { useChatT } from '../../i18n/coachChat';
import { ClientAvatar } from '../ClientAvatar';
import type { CoachClient } from '../domain/types';
import { firstName } from '../screens/format';
import type { ChatState, ChatStore } from './chatStore';
import { useThreadMessages } from './useChat';
import type { ChatMessage as Msg, MsgBody } from './types';
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
} from './core';

/** What the share / notes feature (M5) adds to a thread. All optional: a thread without it is the plain M4 thread. */
export interface ThreadExtrasCtx {
  cid: string;
  clientId: string;
  first: string;
  draft: string;
  onDraft: (v: string) => void;
  messages: readonly Msg[];
  /** Sends a message with a body through the chat store (outbox, retry, sealed). */
  send: (text: string, body?: MsgBody) => string;
  /** The store clock, ms. */
  now: () => number;
}
export interface ShareDeleteCopy {
  title: string;
  body: string;
  quote?: string;
  effects: readonly { icon: string; text: string }[];
  confirmLabel: string;
}
export interface ThreadExtras {
  /** Left of the field / chips above it. */
  lead?: ReactNode;
  chips?: ReactNode;
  /** A pending non-text body (a share card): Send sends it with the field as its caption. */
  body?: MsgBody;
  allowEmpty?: boolean;
  placeholder?: string;
  /** Private-note mode: return true when the text was taken (it is then not sent as a message). */
  intercept?: (text: string) => boolean;
  /** The pending body went out. */
  sent?: () => void;
  /** Buttons in the thread bar before the menu (Notes). */
  barActions?: ReactNode;
  /** Notes drawn between the messages by time. */
  noteItems?: readonly { id: string; at: number; node: ReactNode; menu?: boolean }[];
  /** Drawn cards of share bodies. */
  card?: (m: Msg) => ReactNode | undefined;
  /** Copy for deleting an own share message; absent = shares have no delete. */
  shareDelete?: (m: Msg) => ShareDeleteCopy | undefined;
  /** Drawers, sheets and dialogs of the feature. */
  overlay?: ReactNode;
}
const NO_EXTRAS: ThreadExtras = {};
const useNoExtras = (): ThreadExtras => NO_EXTRAS;

export interface ThreadViewProps {
  store: ChatStore;
  cid: string;
  clientId: string;
  client?: CoachClient;
  outbox: ChatState['outbox'];
  pending: ChatState['pending'];
  /** unread count of this conversation when the thread opened: fixes the "New messages" line */
  unreadAtOpen: number;
  online: boolean;
  /** the draft lives in the shared draft store (memory + a sealed on-device copy, never plaintext in storage) */
  draft: string;
  onDraft: (v: string) => void;
  onOpenClient?: () => void;
  /** phone: Back to the conversation list (shown as the first control of the thread bar) */
  onBack?: () => void;
  /** M5 / M6: cards (share, reschedule request) are drawn by the owner of that kind; unknown kinds show "Unsupported" */
  renderCard?: (m: Msg) => ReactNode | undefined;
  /** M5: the Share button and chips next to the composer */
  composerLead?: ReactNode;
  composerChips?: ReactNode;
  /** M5: a hook that returns the share / notes pieces of this thread (see ThreadExtras). */
  useThreadExtras?: (c: ThreadExtrasCtx) => ThreadExtras;
}

/**
 * One conversation (S-16 thread), trainer side. A thin host over the shared thread core (`./core`): bubbles, day
 * dividers, a "New messages" line fixed at open, message menu (Copy / Delete own), delete + clear with confirm and an
 * 8 s Undo, a composer that is always there. Text is rendered as text nodes only. The thread bar shows no unread
 * number (R-FE-011).
 */
export function ThreadView({
  store,
  cid,
  clientId,
  client,
  outbox,
  pending,
  unreadAtOpen,
  online,
  draft,
  onDraft,
  onOpenClient,
  onBack,
  renderCard,
  composerLead,
  composerChips,
  useThreadExtras,
}: ThreadViewProps) {
  const { ch, locale } = useChatT();
  const desktop = useMinWidth(COACH_BREAKPOINT);
  const { messages, status, retry, hasMore, loadingMore, loadMore } = useThreadMessages(
    store,
    cid,
    outbox,
  );
  const name = client?.name ?? ch.chClient;
  const first = firstName(name);
  const now = store.port.now();
  const useExtras: (c: ThreadExtrasCtx) => ThreadExtras = useThreadExtras ?? useNoExtras;
  const x = useExtras({
    cid,
    clientId,
    first,
    draft,
    onDraft,
    messages,
    send: (text, body) => store.send(cid, text, body),
    now: () => store.port.now(),
  });
  const { noteItems, card: drawCard, shareDelete } = x;

  const { menu, setMenu, anchor, openMenu } = useMenuState();
  const [confirm, setConfirm] = useState<ThreadConfirm>(null);
  const { flash, copy } = useFlash(ch);

  // the "New messages" line: decided once, when the first snapshot of this thread arrives
  const [firstNewId, setFirstNewId] = useState<string | null | undefined>(undefined);
  if (status === 'ready' && firstNewId === undefined) {
    setFirstNewId(firstNewIdOf(messages, 'client', unreadAtOpen));
  }

  useMarkRead(status, store, cid, messages.filter((m) => m.from === 'client').length);
  const { scroller, earlier } = useThreadScroll({
    status,
    ready: firstNewId !== undefined,
    messages,
    firstNewId: firstNewId ?? null,
    mineFrom: 'trainer',
    loadMore,
  });

  const menuMsg = menu && menu !== 'head' ? messages.find((m) => m.id === menu) : undefined;
  const menuData = menuMsg
    ? messageMenuItems({
        m: menuMsg,
        mine: menuMsg.from === 'trainer',
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
        notes: noteItems ?? [],
        firstNewId,
        mineFrom: 'trainer',
        first,
        them: (
          <>
            <ClientAvatar id={clientId} name={name} size={24} hasPhoto={client?.hasPhoto} />
            {first}
          </>
        ),
        openMenuId: menu,
        openMenu,
        onRetry: (m) => store.retrySend(cid, m.id),
        noteSide: 'me',
        noteLabel: (n) => `${ch.chYou}, ${clock(n.at)}`,
        renderNote: (n) => n.node,
        renderOther: (m, mine) => {
          if (m.body.kind === 'system') {
            return {
              withMenu: false,
              body: (
                <ChatBubble system kind={{ icon: 'arrows-clockwise', label: ch.chSystem }}>
                  {m.body.text ?? ''}
                </ChatBubble>
              ),
            };
          }
          const card = drawCard?.(m) ?? renderCard?.(m);
          return {
            withMenu: m.state === 'sent' && m.body.kind === 'share' && mine && !!shareDelete?.(m),
            body: card ?? (
              <ChatBubble side={mine ? 'me' : 'them'} muted icon="info">
                {ch.chUnsupported}
              </ChatBubble>
            ),
          };
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      messages,
      firstNewId,
      menu,
      ch,
      locale,
      name,
      first,
      client?.hasPhoto,
      clientId,
      cid,
      now,
      renderCard,
      store,
      noteItems,
      drawCard,
      shareDelete,
    ],
  );

  const cleared =
    status === 'ready' && messages.length === 0 && pending?.kind === 'chat' && pending.cid === cid;
  const empty = status === 'ready' && messages.length === 0;
  const toast = pending && pending.cid === cid ? pending : null;

  return (
    <ChatShell
      breakpoint="coach"
      head={
        <div className="ch-bar ctl-row--md">
          {onBack && <BackButton label={ch.chBack} onClick={onBack} />}
          <div
            className={`ch-bar-who${onOpenClient ? ' ch-bar-who--link' : ''}`}
            {...(onOpenClient
              ? {
                  role: 'link',
                  tabIndex: 0,
                  'aria-label': `${ch.chOpenClient}: ${name}`,
                  onClick: onOpenClient,
                  onKeyDown: (e: KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenClient();
                    }
                  },
                }
              : {})}
          >
            <ClientAvatar id={clientId} name={name} size={36} hasPhoto={client?.hasPhoto} />
            <div className="ch-bar-id">
              <b>{name}</b>
              {client && <small>{client.program}</small>}
            </div>
          </div>
          {x.barActions}
          <IconButton
            icon="dots-three"
            label={ch.chMenuChat}
            aria-haspopup="menu"
            aria-expanded={menu === 'head'}
            onClick={(e) => openMenu('head', e.currentTarget)}
          />
        </div>
      }
      foot={
        <ThreadComposer
          ch={ch}
          value={draft}
          onChange={onDraft}
          onSend={() => {
            if (x.intercept?.(draft)) {
              onDraft('');
              return;
            }
            if (!draft.trim() && !x.body) return;
            store.send(cid, draft, x.body);
            x.sent?.();
            onDraft('');
          }}
          allowEmpty={!!x.body || !!x.allowEmpty}
          placeholder={x.placeholder ?? ch.chWriteTo(first)}
          lead={
            desktop ? (
              (x.lead ?? composerLead)
            ) : (
              <>
                {x.lead ?? composerLead}
                {x.chips ?? composerChips}
              </>
            )
          }
          chips={desktop ? (x.chips ?? composerChips) : undefined}
        />
      }
      overlays={
        <>
          <ThreadMenu
            ch={ch}
            menu={menu}
            anchor={anchor}
            onClose={() => setMenu(null)}
            msg={menuMsg}
            data={menuData}
            headItems={[
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

          {confirm?.kind === 'msg' && delTarget && delTarget.body.kind === 'text' && (
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
          {confirm?.kind === 'msg' &&
            delTarget &&
            delTarget.body.kind === 'share' &&
            x.shareDelete?.(delTarget) && (
              <ConfirmEffectsDialog
                {...x.shareDelete(delTarget)!}
                small={ch.chUndoSmall}
                cancelLabel={ch.chCancel}
                onCancel={() => setConfirm(null)}
                onConfirm={() => {
                  store.deleteMessage(cid, delTarget.id);
                  setConfirm(null);
                }}
              />
            )}
          {x.overlay}
          {confirm?.kind === 'chat' && (
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
        </>
      }
    >
      {!online && (
        <Notice tone="note" icon="cloud-slash" className="ch-note">
          {ch.chOffline}
          {(outbox[cid]?.length ?? 0) > 0 && ` ${ch.chQueuedNote}`}
        </Notice>
      )}

      <ThreadBody
        ch={ch}
        scroller={scroller}
        status={status}
        messageCount={messages.length}
        online={online}
        onRetryLoad={retry}
        empty={empty}
        cleared={cleared}
        first={first}
        paging={{ hasMore, loadingMore, onEarlier: earlier }}
        showLog={messages.length > 0}
        logLabel={ch.chThreadLabel(name)}
        rows={rows}
        toast={toast}
        flash={flash}
        onUndo={() => store.undo()}
      />
    </ChatShell>
  );
}
