import { type ReactNode } from 'react';
import { Button } from '../../../../components/ui/Button';
import { ChatBubble } from '../../../../components/ui/ChatBubble';
import { ScheduleRequestCard } from '../../../schedule/ScheduleRequestCard';
import { useWords as useShareWords } from '../../../share/ShareCardView';
import { AskCard } from '../../../share/AskCard';
import { parseAskReqId } from '../../../share/askShare';
import { ShareMessage } from '../../../share/ShareMessage';
import type { ShareSourcePort } from '../../../share/port';
import { parseShareRef } from '../../../share/types';
import type { People } from '../../../schedule/people';
import type { SchedulePort } from '../../../schedule/port';
import type { ClientStrings } from '../../../../i18n/coachClient';
import type { ChatStrings } from '../../../../i18n/coachChat';
import type { ChatMessage as Msg } from '../../../chat/types';

/** What the client-side renderer of the non-text bodies needs from the chat screen. */
export interface ClientBodyCtx {
  ch: ChatStrings;
  cc: ClientStrings;
  shw: ReturnType<typeof useShareWords>;
  first: string;
  viewer: { side: 'client'; clientId: string };
  people: People;
  sharePort?: ShareSourcePort;
  schedulePort?: SchedulePort;
  onOpenProgram?: () => void;
  onOpenSharing: () => void;
  onCounter: (reqId: string) => void;
}

/** Bodies the client chat draws beyond plain text: system lines, share cards, Ask and reschedule cards. */
export function renderClientBody(
  x: ClientBodyCtx,
  m: Msg,
  mine: boolean,
): { body: ReactNode; withMenu: boolean } {
  const noMenu = (body: ReactNode) => ({ body, withMenu: false });
  if (m.body.kind === 'system') {
    return noMenu(
      <ChatBubble
        system
        kind={{
          icon: 'list-checks',
          label: m.body.type === 'program-updated' ? x.cc.chProgramUpdated : x.ch.chSystem,
        }}
      >
        {m.body.text ?? ''}
        {m.body.type === 'program-updated' && x.onOpenProgram && (
          <Button
            variant="link"
            inline
            size="sm"
            iconTrailing="caret-right"
            onClick={x.onOpenProgram}
          >
            {x.cc.chOpenProgram}
          </Button>
        )}
      </ChatBubble>,
    );
  }
  if (m.body.kind === 'share') {
    const ref = parseShareRef(m.body.share);
    return noMenu(
      ref ? (
        <ShareMessage
          share={ref}
          caption={m.body.text}
          mine={mine}
          senderFirst={x.first}
          ownerFirst={x.ch.chYou}
          viewer={x.viewer}
          port={x.sharePort}
        />
      ) : (
        <ChatBubble side={mine ? 'me' : 'them'} muted icon="info">
          {x.shw.sh.unsupportedShare}
        </ChatBubble>
      ),
    );
  }
  if (m.body.kind === 'request' && parseAskReqId(m.body.reqId)) {
    return noMenu(
      <AskCard
        kind={parseAskReqId(m.body.reqId)!}
        side="client"
        mine={mine}
        onOpenSharing={mine ? undefined : x.onOpenSharing}
      />,
    );
  }
  if (m.body.kind === 'request') {
    return noMenu(
      <ScheduleRequestCard
        reqId={m.body.reqId}
        people={x.people}
        port={x.schedulePort}
        side="client"
        onCounter={x.onCounter}
        onOpenCalendar={() => undefined}
      />,
    );
  }
  return noMenu(
    <ChatBubble side={mine ? 'me' : 'them'} muted icon="info">
      {x.ch.chUnsupported}
    </ChatBubble>,
  );
}
