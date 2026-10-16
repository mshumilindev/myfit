import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Notice } from '../../components/ui/Notice';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { COACH_BREAKPOINT, useMinWidth } from '../../components/ui/breakpoints';
import { useChatT } from '../../i18n/coachChat';
import { useCoachUnreadState } from '../data/useCoachUnread';
import { conversationsFromChat } from './chatStore';
import { useCoachWorld } from '../data/useCoachWorld';
import type { CoachWorldPort } from '../data/port';
import { Header, Page, Split } from '../layout/Layout';
import type { CoachRoute } from '../routes';
import { chatHash, readWith } from './format';
import type { ChatPort } from './port';
import { ThreadList } from './ThreadList';
import { ThreadView, type ThreadViewProps } from './ThreadView';
import { useDraft } from './chatDrafts';
import { useChat } from './useChat';
import './Chat.css';
import { CoachProblemState } from '../BackendNotice';
import { navigateHash } from '../../navigateHash';

export interface ChatScreenProps {
  onNavigate: (r: CoachRoute) => void;
  /** Test / story seams. */
  chatPort?: ChatPort;
  worldPort?: CoachWorldPort;
  uid?: string | null;
  /** M5 / M6 slots, forwarded to every thread. */
  renderCard?: ThreadViewProps['renderCard'];
  /** M5: share + notes pieces of every thread (see ThreadExtras). */
  useThreadExtras?: ThreadViewProps['useThreadExtras'];
}

function useOnline(): boolean {
  const [on, setOn] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOn(true);
    const down = () => setOn(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return on;
}

function useWithParam(): [string | null, (id: string | null, push: boolean) => void] {
  const [id, setId] = useState(() => readWith(window.location.hash));
  useEffect(() => {
    const f = () => setId(readWith(window.location.hash));
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  const set = useCallback((next: string | null, push: boolean) => {
    setId(next);
    const h = chatHash(next);
    if (push) navigateHash(h);
    else window.location.replace(h);
  }, []);
  return [id, set];
}

/**
 * Chat (S-16, route `#/c/chat`, deep link `?with=<clientId>`). Desktop: conversation list 5 / thread 7. Phone: the
 * list is the screen and a thread is pushed with Back. Data: the chat port (fixtures now) and the unread single
 * source; names come from the world, which never blocks the list (skeleton rows, then names).
 */
export function ChatScreen({
  onNavigate,
  chatPort,
  worldPort,
  uid,
  renderCard,
  useThreadExtras,
}: ChatScreenProps) {
  const { ch } = useChatT();
  const desktop = useMinWidth(COACH_BREAKPOINT);
  const online = useOnline();
  const chat = useChat({ port: chatPort, uid });
  const world = useCoachWorld(worldPort);
  const [withId, setWith] = useWithParam();

  // ONE unread source: the same hook the rail / tab bar badge reads, over the same chat store.
  const unread = useCoachUnreadState({
    port: useMemo(() => conversationsFromChat(chat.store.port), [chat.store.port]),
    uid,
  });

  const clients = useMemo(
    () => new Map((world.world?.rows ?? []).map((r) => [r.client.id, r.client] as const)),
    [world.world],
  );
  const threads = chat.threads;
  const active = useMemo(() => threads.filter((t) => t.active), [threads]);
  const sorted = useMemo(
    () => [...active].sort((a, b) => (b.lastAt ?? 0) - (a.lastAt ?? 0)),
    [active],
  );
  const fromHash = withId ? active.find((t) => t.clientId === withId) : undefined;
  // Desktop opens the most recent conversation once and then keeps it: the list re-sorts under the open thread
  // (a cleared chat has no last message) and the selection must not jump.
  const [auto, setAuto] = useState<string | null>(null);
  if (desktop && !fromHash && auto === null && sorted[0]) setAuto(sorted[0].clientId);
  const autoThread = auto ? active.find((t) => t.clientId === auto) : undefined;
  const open = fromHash ?? (desktop ? (autoThread ?? sorted[0]) : undefined);

  // unread count when a thread was opened: fixes its "New messages" line, never changes while it stays open
  const [arrival, setArrival] = useState<{ cid: string; n: number } | null>(null);
  if (open && arrival?.cid !== open.cid) setArrival({ cid: open.cid, n: open.unread });
  else if (!open && arrival) setArrival(null);

  // the draft lives in the shared draft store (memory + sealed on-device copy), so it survives switching
  // conversations, a reload and the Chat <-> dock hop
  const [draft, setDraft] = useDraft(open?.cid ?? null);

  const now = chat.store.port.now();
  // A thread we pushed on this visit goes back with history; a deep link replaces itself with the list.
  const pushed = useRef(false);
  const goBack = () => (pushed.current ? window.history.back() : setWith(null, false));
  const goClient = (id: string) => onNavigate({ screen: 'client', cid: id });

  const list =
    chat.status === 'loading' && threads.length === 0 ? (
      <SkeletonRows rows={5} label={ch.chListLabel} />
    ) : chat.status === 'error' && threads.length === 0 ? (
      <CoachProblemState
        inline
        problem={online ? 'unknown' : 'offline'}
        onRetry={() => chat.store.restart()}
      />
    ) : active.length === 0 ? (
      <EmptyState titleAs="h2" centered icon="envelope" title={ch.chEmptyH} body={ch.chEmptyB}>
        <Button variant="secondary" onClick={() => onNavigate({ screen: 'clients' })}>
          {ch.chGoClients}
        </Button>
      </EmptyState>
    ) : (
      <ThreadList
        threads={active}
        clients={clients}
        unread={unread.byClient}
        now={now}
        selectedId={desktop ? open?.clientId : undefined}
        onOpen={(id) => {
          pushed.current = !desktop;
          setWith(id, !desktop);
        }}
      />
    );

  const notices = (
    <>
      {chat.status === 'error' && threads.length > 0 && (
        <Notice
          tone="note"
          icon="cloud-slash"
          trail={
            <Button variant="secondary" size="sm" onClick={() => chat.store.restart()}>
              {ch.chRetry}
            </Button>
          }
        >
          {ch.chLoadFailed}
        </Notice>
      )}
    </>
  );

  const thread = open && (
    <ThreadView
      key={open.cid}
      store={chat.store}
      cid={open.cid}
      clientId={open.clientId}
      client={clients.get(open.clientId)}
      outbox={chat.outbox}
      pending={chat.pending}
      unreadAtOpen={arrival?.cid === open.cid ? arrival.n : open.unread}
      online={online}
      draft={draft}
      onDraft={setDraft}
      onOpenClient={() => goClient(open.clientId)}
      onBack={desktop ? undefined : goBack}
      renderCard={renderCard}
      useThreadExtras={useThreadExtras}
    />
  );

  // Phone with a thread open: the thread is the screen, Back returns to the list.
  if (!desktop && fromHash && thread) {
    return (
      <Page className="ch-page ch-page--thread">
        {notices}
        {thread}
      </Page>
    );
  }

  return (
    <Page className="ch-page">
      <Header
        title={ch.chTitle}
        subtitle={active.length > 0 ? ch.chSubtitle(active.length) : undefined}
      />
      {notices}
      {desktop ? (
        <Split ratio="5-7">
          <div className="ch-col">{list}</div>
          {thread || <div className="ch-col" />}
        </Split>
      ) : (
        list
      )}
    </Page>
  );
}
