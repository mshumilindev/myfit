import { useMemo } from 'react';
import { ChatScreen, type ChatScreenProps } from './chat/ChatScreen';
import type { CoachRoute } from './routes';
import { createScheduleThreadExtras } from './schedule/scheduleThreadExtras';
import { createCoachThreadExtras, getThreadExtrasOpts } from './threadExtras';

/**
 * The thread extras of the Coach chat: Share and Notes (M5) and reschedule requests (M6) composed: cards by kind
 * (share / request), lead buttons and chips side by side, overlays together. Used by the Chat screen and the desktop chat dock.
 */
export function composeThreadExtras(onNavigate: (r: CoachRoute) => void) {
  const share = createCoachThreadExtras({ ...getThreadExtrasOpts(), onNavigate });
  const resched = createScheduleThreadExtras({ onNavigate });
  return function useComposedExtras(ctx: Parameters<typeof share>[0]): ReturnType<typeof share> {
    const a = share(ctx);
    const b = resched(ctx);
    return {
      ...a,
      lead: (
        <>
          {a.lead}
          {b.lead}
        </>
      ),
      chips: (
        <>
          {a.chips}
          {b.chips}
        </>
      ),
      card: (m) => a.card?.(m) ?? b.card?.(m),
      overlay: (
        <>
          {a.overlay}
          {b.overlay}
        </>
      ),
    };
  };
}

/** The Coach chat with the extras switched on. One lazy chunk: the picker, peek, notes and the request form load with it. */
export function ChatWithExtras(
  p: Omit<ChatScreenProps, 'useThreadExtras'> & { onNavigate: (r: CoachRoute) => void },
) {
  const ext = useMemo(() => composeThreadExtras(p.onNavigate), [p.onNavigate]);
  return <ChatScreen {...p} useThreadExtras={ext} />;
}
