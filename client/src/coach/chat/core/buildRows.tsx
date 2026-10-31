import type { ReactNode } from 'react';
import { IconButton } from '../../../components/ui/Button';
import {
  ChatBubble,
  ChatDay,
  ChatMessage,
  ChatNewDivider,
} from '../../../components/ui/ChatBubble';
import { clock, dayKey, dayLabel } from '../format';
import type { ChatMessage as Msg } from '../types';
import type { ChatWords } from './useThreadCore';

export interface ThreadRowsArgs<N extends { id: string; at: number }> {
  ch: ChatWords;
  locale: Parameters<typeof dayLabel>[3];
  now: number;
  messages: readonly Msg[];
  /** notes drawn between the messages by time */
  notes: readonly N[];
  firstNewId: string | null | undefined;
  /** this side's own messages */
  mineFrom: 'trainer' | 'client';
  /** the other person's first name and avatar, drawn above their first message of a run */
  first: string;
  them: ReactNode;
  /** id of the message whose menu is open (aria-expanded) */
  openMenuId: string | null;
  openMenu: (id: string, el: HTMLElement | null) => void;
  onRetry: (m: Msg) => void;
  noteSide: 'me' | 'them';
  noteLabel: (n: N) => string;
  renderNote: (n: N) => ReactNode;
  /** bodies the core does not know (system, share, request, ...): the body and whether it has a menu */
  renderOther: (m: Msg, mine: boolean) => { body: ReactNode; withMenu: boolean };
}

/**
 * The list of a thread: day dividers, the "New messages" line, notes by time, and per message the deleted /
 * unverified / text bubbles, the sender run, the "Message actions" button. Other kinds go to `renderOther`.
 */
export function buildThreadRows<N extends { id: string; at: number }>(
  a: ThreadRowsArgs<N>,
): ReactNode[] {
  const { ch, first } = a;
  const out: ReactNode[] = [];
  let day = '';
  let prevSender = '';
  type Entry = { at: number; m: Msg; n?: undefined } | { at: number; m?: undefined; n: N };
  const merged: Entry[] = [
    // the client's answer to an access request is data for the ask card (its status), not a bubble (SPO-99)
    ...a.messages
      .filter((m) => m.body.kind !== 'request-reply')
      .map((m): Entry => ({ at: m.at, m })),
    ...a.notes.map((n): Entry => ({ at: n.at, n })),
  ].sort((x, y) => x.at - y.at);
  merged.forEach((e) => {
    const k = dayKey(e.at);
    if (k !== day) {
      day = k;
      prevSender = '';
      out.push(
        <ChatDay key={`d-${e.m?.id ?? e.n?.id}`}>{dayLabel(e.at, a.now, ch, a.locale)}</ChatDay>,
      );
    }
    if (!e.m) {
      prevSender = '';
      out.push(
        <ChatMessage
          key={`n-${e.n.id}`}
          id={`note-${e.n.id}`}
          side={a.noteSide}
          time={clock(e.at)}
          label={a.noteLabel(e.n)}
        >
          {a.renderNote(e.n)}
        </ChatMessage>,
      );
      return;
    }
    const m = e.m;
    if (m.id === a.firstNewId) {
      out.push(<ChatNewDivider key="new">{ch.chNewDivider}</ChatNewDivider>);
      prevSender = '';
    }
    const mine = m.from === a.mineFrom;
    const sys = m.from === 'system';
    const side = sys ? 'center' : mine ? 'me' : 'them';
    const sender = sys || prevSender === m.from ? undefined : mine ? ch.chYou : a.them;
    prevSender = m.from;
    let body: ReactNode;
    let withMenu = false;
    if (m.deleted) {
      body = (
        <ChatBubble side={mine ? 'me' : 'them'} muted icon="trash">
          {mine ? ch.chDeletedMine : ch.chDeletedTheirs(first)}
        </ChatBubble>
      );
    } else if (m.unverified) {
      body = (
        <ChatBubble side="them" muted icon="warning-circle">
          {ch.chUnverified}
        </ChatBubble>
      );
    } else if (m.body.kind === 'text') {
      withMenu = m.state === 'sent';
      body = (
        <ChatBubble
          side={mine ? 'me' : 'them'}
          state={m.state}
          stateLabel={m.state === 'sending' ? ch.chSending : ch.chFailed}
          retryLabel={ch.chRetry}
          onRetry={() => a.onRetry(m)}
        >
          {m.body.text}
        </ChatBubble>
      );
    } else {
      ({ body, withMenu } = a.renderOther(m, mine));
    }
    const who = `${sys ? ch.chSystem : mine ? ch.chYou : first}, ${clock(m.at)}`;
    out.push(
      <ChatMessage
        key={m.id}
        id={`msg-${m.id}`}
        side={side}
        time={sys || m.deleted ? undefined : clock(m.at)}
        sender={sender}
        label={who}
        onLongPress={withMenu ? () => a.openMenu(m.id, null) : undefined}
        actions={
          withMenu && (
            <IconButton
              icon="dots-three"
              label={ch.chMenuMsgFor(who)}
              size="sm"
              aria-haspopup="menu"
              aria-expanded={a.openMenuId === m.id}
              onClick={(ev) => a.openMenu(m.id, ev.currentTarget)}
            />
          )
        }
      >
        {body}
      </ChatMessage>,
    );
  });
  return out;
}
