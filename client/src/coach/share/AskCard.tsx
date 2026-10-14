import { Button } from '../../components/ui/Button';
import { ChatBubble } from '../../components/ui/ChatBubble';
import { useShareT } from '../../i18n/coachShare';
import { useSafeT } from '../../i18n/coachSafe';
import type { ShareKind } from './types';

export interface AskCardProps {
  kind: ShareKind;
  /** `trainer` drew it in the trainer app, `client` in the client's chat. */
  side: 'trainer' | 'client';
  /** Who sent it (a client sees it on the trainer's side of the thread). */
  mine: boolean;
  /** Client side only: opens the sharing settings. */
  onOpenSharing?: () => void;
}

/** The "please share" request as a card in the thread (the sealed body carries only the kind). */
export function AskCard({ kind, side, mine, onOpenSharing }: AskCardProps) {
  const { sh } = useShareT();
  const { sf } = useSafeT();
  const what = sh.kindPlural[kind];
  return (
    <ChatBubble
      side={mine ? 'me' : 'them'}
      tone="share"
      kind={{ icon: 'lock-simple', label: sf.askCardKind }}
    >
      {side === 'trainer' ? sf.askCardMine(what) : sf.askCardTheirs(what)}
      {side === 'client' && onOpenSharing && (
        <Button variant="link" inline size="sm" iconTrailing="caret-right" onClick={onOpenSharing}>
          {sf.askCardOpen}
        </Button>
      )}
    </ChatBubble>
  );
}
