import { Button } from '../../components/ui/Button';
import { ChatBubble } from '../../components/ui/ChatBubble';
import { Tag } from '../../components/ui/Tag';
import type { Tone } from '../../components/ui/tones';
import { useT } from '../../i18n';
import { useClientT, type ClientStrings } from '../../i18n/coachClient';
import { shareRowMeta } from '../client/shareLabels';
import { SHARE_IDS } from '../client/shareModel';
import type { AccessAsk, AskStatus } from './accessAsk';

export interface AccessAskCardProps {
  ask: AccessAsk;
  status: AskStatus;
  /** `trainer` = drawn in the trainer app, `client` = in the client's chat. */
  side: 'trainer' | 'client';
  mine: boolean;
  /** The other person's first name. */
  first: string;
  /** Client side: opens the form (only while the ask is waiting). */
  onReview?: () => void;
}

const STATUS_TONE: Record<AskStatus, Tone> = {
  waiting: 'neutral',
  allowed: 'ok',
  partial: 'rest',
  declined: 'neutral',
  expired: 'neutral',
};

export const statusWord = (cc: ClientStrings, s: AskStatus): string =>
  s === 'waiting'
    ? cc.raWaiting
    : s === 'allowed'
      ? cc.raAllowed
      : s === 'partial'
        ? cc.raPartial
        : s === 'declined'
          ? cc.raDeclined
          : cc.raExpired;

/** The access request as one card in both chats: what was asked, and the client's answer as a neutral status (no reasons). */
export function AccessAskCard({ ask, status, side, mine, first, onReview }: AccessAskCardProps) {
  const { cc } = useClientT();
  const { t } = useT();
  const what =
    ask.cats.length === SHARE_IDS.length
      ? cc.raCardAll(ask.cats.length)
      : ask.cats.map((id) => shareRowMeta(id, cc, t).title).join(', ');
  return (
    <ChatBubble
      side={mine ? 'me' : 'them'}
      tone="share"
      kind={{ icon: 'lock-simple', label: cc.raKind }}
    >
      <div className="ul-flex ul-col ug-8">
        <b>{side === 'trainer' ? cc.raCardMine(first) : cc.raCardTheirs(first)}</b>
        <span>{what}</span>
        <div className="ul-flex ua-center ug-8">
          <Tag tone={STATUS_TONE[status]}>{statusWord(cc, status)}</Tag>
          {side === 'client' && status === 'waiting' && onReview && (
            <Button variant="secondary" size="sm" iconTrailing="caret-right" onClick={onReview}>
              {cc.raReview}
            </Button>
          )}
        </div>
        {side === 'trainer' && status === 'waiting' && (
          <span className="ut-sm ut-muted">{cc.raNoAnswer(first)}</span>
        )}
        {side === 'trainer' && status === 'declined' && (
          <span className="ut-sm ut-muted">{cc.raAgainIn7}</span>
        )}
        {side === 'client' && status === 'expired' && (
          <span className="ut-sm ut-muted">{cc.raAskAgain(first)}</span>
        )}
      </div>
    </ChatBubble>
  );
}
