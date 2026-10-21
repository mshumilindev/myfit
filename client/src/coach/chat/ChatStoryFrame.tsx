import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CoachShell } from '../CoachApp';
import { configureCoachData } from '../data/config';
import { createFixturesPort } from '../data/__fixtures__/fixtures';
import type { CoachRoute } from '../routes';
import { dock } from './dockStore';
import type { ChatPort } from './port';
import { navigateHash } from '../../navigateHash';

/**
 * Stories: the real shell around the chat route with a chosen chat port (the world is the lab fixtures).
 * The port is created per mount so every story starts from its own conversations.
 */
export function ChatStoryFrame({
  makePort,
  hash,
  start,
  dockOpen,
}: {
  makePort: () => ChatPort;
  /** e.g. `#/c/chat?with=c1`, so the phone story opens a thread */
  hash?: string;
  /** start on another screen (the dock stories use Today) */
  start?: CoachRoute;
  /** open the dock on mount: the list, or the thread of that client */
  dockOpen?: boolean | string;
}): ReactNode {
  const [route, setRoute] = useState<CoachRoute>(start ?? { screen: 'chat' });
  useEffect(() => {
    if (dockOpen) dock.open(typeof dockOpen === 'string' ? dockOpen : null);
    return () => dock.reset();
  }, [dockOpen]);
  useMemo(() => {
    configureCoachData({
      world: createFixturesPort({ warm: true }),
      chat: makePort(),
      uid: 'trainer-iryna',
    });
  }, [makePort]);
  const hasStart = !!start;
  useEffect(() => {
    // the screen listens to hashchange, so setting it after mount opens the thread
    navigateHash(hash ?? (hasStart ? '#/c/agenda' : '#/c/chat'));
  }, [hash, hasStart]);
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
