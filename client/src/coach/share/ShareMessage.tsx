import { ChatBubble } from '../../components/ui/ChatBubble';
import { ShareCardView, useWords } from './ShareCardView';
import { useResolvedShare } from './useShare';
import type { ShareSourcePort } from './port';
import './ShareMessage.css';
import type { ShareRef, ShareView, Viewer } from './types';

export interface ShareMessageProps {
  share: ShareRef;
  caption?: string;
  mine: boolean;
  /** Sender's first name for "Oleh shared . workout day". */
  senderFirst: string;
  /** Owner's first name for reasons ("Oleh has not shared sets"). */
  ownerFirst: string;
  viewer: Viewer;
  onOpen?: (v: ShareView) => void;
  port?: ShareSourcePort;
}

/**
 * A share inside the thread: the bubble header says who shared what, the card is resolved NOW from the reader's access
 * (never copied into the message), a caption sits under it. Loading shows the skeleton card; nothing blocks the thread.
 */
export function ShareMessage(p: ShareMessageProps) {
  const w = useWords();
  const { view } = useResolvedShare(p.share, p.viewer, p.port);
  const kind = w.sh.kindLower[p.share.kind];
  return (
    <ChatBubble
      side={p.mine ? 'me' : 'them'}
      tone="share"
      kind={{
        icon: 'share-network',
        label: p.mine ? w.sh.youShared(kind) : w.sh.theyShared(p.senderFirst, kind),
      }}
    >
      <ShareCardView view={view} who={p.ownerFirst} onOpen={p.onOpen} />
      {p.caption && <span className="shx-cap">{p.caption}</span>}
    </ChatBubble>
  );
}
