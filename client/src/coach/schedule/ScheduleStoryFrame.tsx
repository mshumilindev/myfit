import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CoachShell } from '../CoachApp';
import { createFixturesChatPort } from '../chat/__fixtures__/fixtures';
import { ChatStoryFrame } from '../chat/ChatStoryFrame';
import { configureCoachData } from '../data/config';
import { createFixturesPort } from '../data/__fixtures__/fixtures';
import { parseCoachHash, type CoachRoute } from '../routes';
import type { ChatMessage } from '../chat/types';
import type { SchedulePort } from './port';
import { configureSchedule } from './useSchedule';
import { replaceHash } from '../../route';

/**
 * Stories: the real shell around a schedule route with a chosen schedule port (the world is the lab fixtures). The
 * port is created per mount so every story starts from its own calendar. `hash` carries the view state
 * (`#/c/schedule?view=month`, `?form=plan`, `?open=<slot>`).
 */
export function ScheduleStoryFrame({
  makePort,
  hash,
}: {
  makePort: () => SchedulePort;
  hash: string;
}): ReactNode {
  const [route, setRoute] = useState<CoachRoute>(() => parseCoachHash(hash));
  useMemo(() => {
    configureCoachData({
      world: createFixturesPort({ warm: true }),
      chat: createFixturesChatPort(),
      uid: 'trainer-iryna',
    });
    configureSchedule(makePort());
  }, [makePort]);
  useEffect(() => {
    replaceHash(hash);
  }, [hash]);
  return (
    <CoachShell
      role="trainer"
      name="Iryna Melnyk"
      route={route}
      onNavigate={setRoute}
      onExitToWorkouts={() => undefined}
      onOpenProfile={() => undefined}
      onOpenShell={() => undefined}
    />
  );
}

/** The chat with request cards for the given request ids posted into one conversation. */
export function ScheduleChatFrame({
  makePort,
  clientId,
  reqIds,
  fromClient = [],
}: {
  makePort: () => SchedulePort;
  clientId: string;
  reqIds: readonly string[];
  /** request ids the client asked for: their messages sit on the client's side of the thread */
  fromClient?: readonly string[];
}): ReactNode {
  const makeChat = useMemo(
    () => () => {
      const chat = createFixturesChatPort({ withClients: [clientId] });
      reqIds.forEach((id, i) => {
        void chat.send(`cid-${clientId}`, {
          id: `msg-${id}`,
          text: '',
          at: chat.now() + i,
          body: { kind: 'request', reqId: id },
        });
      });
      const incoming = new Set(fromClient.map((id) => `msg-${id}`));
      return {
        ...chat,
        subscribeMessages: (
          cid: string,
          on: Parameters<typeof chat.subscribeMessages>[1],
          err: Parameters<typeof chat.subscribeMessages>[2],
          ...rest: unknown[]
        ) =>
          (chat.subscribeMessages as (...a: unknown[]) => () => void)(
            cid,
            (msgs: ChatMessage[]) =>
              on(msgs.map((m) => (incoming.has(m.id) ? { ...m, from: 'client' as const } : m))),
            err,
            ...rest,
          ),
      };
    },
    [clientId, reqIds, fromClient],
  );
  useMemo(() => configureSchedule(makePort()), [makePort]);
  return <ChatStoryFrame makePort={makeChat} hash={`#/c/chat?with=${clientId}`} />;
}
