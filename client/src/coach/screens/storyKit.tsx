import { useMemo, useState, type ReactNode } from 'react';
import { CoachShell } from '../CoachApp';
import { configureCoachData } from '../data/config';
import type { CoachWorldPort } from '../data/port';
import type { CoachRoute } from '../routes';
import { configureLive } from './live/config';
import type { LivePort } from './live/port';

/**
 * Stories: the real shell (rail / tab bar by window width) around one route, with a chosen world port.
 * `port` is created per mount so every story starts from its own store.
 */
export function CoachStoryFrame({
  route: initial,
  makePort,
  makeLive,
}: {
  route: CoachRoute;
  makePort?: () => CoachWorldPort;
  /** Live feed of the story (default: the fixtures feed with two live, one offline, one finished). */
  makeLive?: () => LivePort;
}): ReactNode {
  const [route, setRoute] = useState<CoachRoute>(initial);
  useMemo(() => {
    configureCoachData({ world: makePort ? makePort() : null, uid: 'trainer-iryna' });
    configureLive(makeLive ? makeLive() : null);
  }, [makePort, makeLive]);
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
