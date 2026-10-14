import { useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { IconButton } from '../../components/ui/Button';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { useChatT } from '../../i18n/coachChat';
import { composeThreadExtras } from '../ChatWithExtras';
import { useCoachWorld } from '../data/useCoachWorld';
import { useCoachUnreadState } from '../data/useCoachUnread';
import type { CoachRoute } from '../routes';
import { conversationsFromChat } from './chatStore';
import { useDraft } from './chatDrafts';
import { dock, useDock } from './dockStore';
import { ThreadList } from './ThreadList';
import { ThreadView } from './ThreadView';
import { useChat } from './useChat';
import './ChatDock.css';

/**
 * The panel of the desktop chat dock: the conversation list, then one thread with the same ThreadView, composer and
 * extras (Share, Notes, reschedule) as the Chat screen. Lazy: it loads when the dock is first opened.
 */
export default function ChatDockPanel({ onNavigate }: { onNavigate: (r: CoachRoute) => void }) {
  const { ch } = useChatT();
  const { who } = useDock();
  const chat = useChat({});
  const world = useCoachWorld();
  const unread = useCoachUnreadState({
    port: useMemo(() => conversationsFromChat(chat.store.port), [chat.store.port]),
  });
  const extras = useMemo(() => composeThreadExtras(onNavigate), [onNavigate]);
  const clients = useMemo(
    () => new Map((world.world?.rows ?? []).map((r) => [r.client.id, r.client] as const)),
    [world.world],
  );
  const active = useMemo(() => chat.threads.filter((t) => t.active), [chat.threads]);
  const open = who ? active.find((t) => t.clientId === who) : undefined;
  const [draft, setDraft] = useDraft(open?.cid ?? null);
  const online = typeof navigator === 'undefined' ? true : navigator.onLine;

  return (
    <Card pad="none" emphasis="glass" className="cd-card">
      {open ? (
        <ThreadView
          key={open.cid}
          store={chat.store}
          cid={open.cid}
          clientId={open.clientId}
          client={clients.get(open.clientId)}
          outbox={chat.outbox}
          pending={chat.pending}
          unreadAtOpen={open.unread}
          online={online}
          draft={draft}
          onDraft={setDraft}
          onBack={() => dock.showList()}
          onOpenClient={() => onNavigate({ screen: 'client', cid: open.clientId })}
          useThreadExtras={extras}
        />
      ) : (
        <div className="cd-list">
          <div className="cd-head">
            <h2 className="cd-title">{ch.chTitle}</h2>
            <IconButton label={ch.chDockClose} icon="x" onClick={() => dock.close()} />
          </div>
          {chat.status === 'loading' && active.length === 0 ? (
            <SkeletonRows rows={4} label={ch.chListLabel} />
          ) : active.length === 0 ? (
            <EmptyState
              titleAs="h2"
              centered
              icon="envelope"
              title={ch.chEmptyH}
              body={ch.chEmptyB}
            />
          ) : (
            <ThreadList
              threads={active}
              clients={clients}
              unread={unread.byClient}
              now={chat.store.port.now()}
              onOpen={(id) => dock.open(id)}
            />
          )}
        </div>
      )}
    </Card>
  );
}
