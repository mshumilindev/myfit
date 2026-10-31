import { useEffect, useState } from 'react';
import { Button } from '../../src/components/ui/Button';
import { ChatBubble } from '../../src/components/ui/ChatBubble';
import { askedIds, ClientRequestForm, TRAINER, ResultTag, ar, catOf, resultOf } from './lab';

/** Replaces `AskCard` in both chats: one card for a request with several categories and the client's answer. */
const CLIENT = 'Oleh';
export function AskCard({ side, mine, onOpenSharing }: { kind: string; side: 'trainer' | 'client'; mine: boolean; onOpenSharing?: () => void }) {
  void onOpenSharing;
  const s = ar();
  const r = resultOf(s);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (side === 'client' && s.startsWith('client-form')) setOpen(true);
  }, [side, s]);
  const ids = askedIds();
  const names = ids.length === 10 ? ['Everything you can share (10)'] : ids.map((i) => catOf(i).label);
  const body =
    side === 'trainer' ? (
      <>
        <span className="ar-c-h">You asked {CLIENT} for access</span>
        <span className="ar-c-l">{names.join(', ')}</span>
      </>
    ) : (
      <>
        <span className="ar-c-h">{TRAINER} asks for access</span>
        <span className="ar-c-l">{names.join(', ')}</span>
      </>
    );
  return (
    <>
      <ChatBubble side={mine ? 'me' : 'them'} tone="share" kind={{ icon: 'lock-simple', label: 'Access request' }}>
        <span className="ar-c">
          {body}
          <span className="ar-c-s">
            <ResultTag r={side === 'trainer' && r === 'pending' ? 'pending' : r} />
            {side === 'client' && r === 'pending' && (
              <Button variant="secondary" size="sm" iconTrailing="caret-right" onClick={() => setOpen(true)}>
                Review request
              </Button>
            )}
            {side === 'client' && r === 'expired' && <span className="ar-c-n">Ask {TRAINER} to send it again.</span>}
            {side === 'trainer' && r === 'declined' && <span className="ar-c-n">You can ask again in 7 days.</span>}
            {side === 'trainer' && r === 'pending' && <span className="ar-c-n">{CLIENT} has not answered yet.</span>}
          </span>
        </span>
      </ChatBubble>
      {open && <ClientRequestForm onClose={() => setOpen(false)} />}
    </>
  );
}
