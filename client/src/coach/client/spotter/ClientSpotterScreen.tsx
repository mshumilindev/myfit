import { useEffect, useMemo, useState } from 'react';
import { BackButton } from '../../../components/ui/BackButton';
import { ChatBubble, ChatDay, ChatMessage } from '../../../components/ui/ChatBubble';
import { ChatPage, ChatShell } from '../../../components/ui/ChatShell';
import { EmptyState } from '../../../components/ui/EmptyState';
import { FailedState } from '../../../components/ui/FailedState';
import { IconTile } from '../../../components/ui/IconTile';
import { Notice } from '../../../components/ui/Notice';
import { SkeletonRows } from '../../../components/ui/Skeleton';
import { useChatT } from '../../../i18n/coachChat';
import { useClientT, type ClientStrings } from '../../../i18n/coachClient';
import { clock, dayLabel } from '../../chat/format';
import type { SchedulePort } from '../../schedule/port';
import { ScheduleRequestCard } from '../../schedule/ScheduleRequestCard';
import { ClientRescheduleSheet, myPeople, useMySessions } from '../screens/ClientSchedule';
import type { RescheduleRequest } from '../../schedule/types';
import type { ClientSpotterItem, ClientSpotterKind, ClientSpotterPort } from './clientSpotterPort';
import { useClientSpotter } from './useClientSpotter';
import '../ClientCoach.css';

const ICON: Record<ClientSpotterKind, string> = {
  'move-request': 'swap',
  'move-answer': 'check-circle',
  'session-done': 'check-circle',
  'session-missed': 'warning-circle',
  'session-cancelled': 'x-circle',
  team: 'users',
  access: 'shield-check',
  reminder: 'clock',
  summary: 'chart-line',
};

/** The words of one message. `who` is the name the server stored; a missing one reads as "your trainer". */
export function spotterText(cc: ClientStrings, i: ClientSpotterItem): string {
  const who = i.who || cc.ccTrainer;
  switch (i.kind) {
    case 'move-request':
      return cc.mtReqAnswer;
    case 'move-answer':
      return cc.spMoveAnswer(who, i.status === 'accepted');
    case 'session-done':
      return cc.spDone(who);
    case 'session-missed':
      return cc.spMissed(who);
    case 'session-cancelled':
      return cc.spCancelled(who);
    case 'team':
      return cc.spTeam(who);
    case 'access':
      return cc.spAccess;
    case 'reminder':
      return cc.spReminder;
    default:
      return cc.spSummary;
  }
}

/**
 * Spotter for the client (SPO-236, board C5): the pinned service chat, read-only. Built from the chat kit
 * (`ChatShell` + `ChatBubble`); the composer is replaced by a Notice. A move request is the live schedule card, so
 * Accept / Decline / Propose another are the same calls as in My trainer. Opening the screen marks the messages read
 * (the read state is on the notices, so it follows the person to every device).
 */
export function ClientSpotterScreen({
  onBack,
  port,
  schedulePort,
}: {
  onBack: () => void;
  port?: ClientSpotterPort;
  schedulePort?: SchedulePort;
}) {
  const { cc, locale } = useClientT();
  const { ch } = useChatT();
  const { feed, failed, retry, markRead } = useClientSpotter(port);
  const my = useMySessions(schedulePort);
  const [counter, setCounter] = useState<RescheduleRequest | null>(null);
  const people = useMemo(() => (my ? myPeople(my.myId, my.first) : null), [my]);
  const unread = feed?.unread ?? 0;
  const unreadIds = feed?.items.filter((i) => i.unread).map((i) => i.id) ?? [];
  const unreadKey = unreadIds.join(',');
  useEffect(() => {
    if (unreadKey) markRead(unreadKey.split(','));
  }, [unreadKey, markRead]);
  const [opened] = useState(() => Date.now());

  const head = (
    <div className="ch-bar ctl-row--md">
      <BackButton label={cc.ccBack} onClick={onBack} />
      <IconTile tone="accent" size={36} icon="envelope" />
      <div className="ch-bar-id">
        <b>{cc.spTitle}</b>
        <small>{unread > 0 ? `${cc.spBarSub} · ${cc.spUnread(unread)}` : cc.spBarSub}</small>
      </div>
    </div>
  );
  const foot = (
    <Notice icon="lock" tone="neutral" role="note">
      {cc.spReadOnly}
    </Notice>
  );

  let body;
  if (!feed) {
    body = (
      <div className="ch-scroll">
        {failed ? (
          <FailedState title={cc.spFailed} retryLabel={cc.ccRetry} onRetry={retry} />
        ) : (
          <SkeletonRows rows={4} label={cc.ccLoading} />
        )}
      </div>
    );
  } else if (feed.items.length === 0) {
    body = (
      <div className="ch-scroll">
        <EmptyState icon="envelope" title={cc.spEmptyTitle} body={cc.spEmptyBody} />
      </div>
    );
  } else {
    const now = my?.now ?? opened;
    // newest first in the feed; a chat reads oldest first
    const chrono = [...feed.items].reverse();
    const dayOf = (i: ClientSpotterItem) => dayLabel(i.createdAt, now, ch, locale);
    const rows = chrono.flatMap((i, n) => {
      const day = dayOf(i);
      const out = [];
      if (n === 0 || day !== dayOf(chrono[n - 1]!))
        out.push(<ChatDay key={`d-${i.id}`}>{day}</ChatDay>);
      out.push(
        <ChatMessage key={i.id} side="them" time={clock(i.createdAt)} label={spotterText(cc, i)}>
          {i.kind === 'move-request' && i.refId && people ? (
            <ScheduleRequestCard
              reqId={i.refId}
              people={people}
              port={schedulePort}
              side="client"
              onCounter={(id) => setCounter(my?.requests.find((r) => r.id === id) ?? null)}
              onOpenCalendar={() => undefined}
            />
          ) : (
            <ChatBubble side="them" icon={ICON[i.kind]}>
              {spotterText(cc, i)}
            </ChatBubble>
          )}
        </ChatMessage>,
      );
      return out;
    });
    body = (
      <div className="ch-scroll">
        <ol className="ch-list-m" aria-label={cc.spListLabel}>
          {rows}
        </ol>
      </div>
    );
  }

  return (
    <ChatPage className="cc-chat-page">
      <ChatShell
        head={head}
        foot={foot}
        overlays={
          counter && my ? (
            <ClientRescheduleSheet my={my} counterOf={counter} onClose={() => setCounter(null)} />
          ) : undefined
        }
      >
        {body}
      </ChatShell>
    </ChatPage>
  );
}
