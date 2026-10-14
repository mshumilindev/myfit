import { useRef, type ReactNode } from 'react';
import { Icon } from '../../ui';
import { Button } from './Button';
import { toneClass, type Tone } from './tones';
import './ChatBubble.css';

/**
 * Chat message pieces (kit group `Coach/Chat bubbles`). Presentational: plain strings and nodes in, no
 * dictionary, no domain types, so the client chat (M7) draws the same bubbles.
 *
 *   <ChatDay>Today</ChatDay>           day divider
 *   <ChatNewDivider>New messages</ChatNewDivider>
 *   <ChatMessage side="me" time="09:05" sender={…} actions={<IconButton …/>}>
 *     <ChatBubble side="me">Text</ChatBubble>
 *   </ChatMessage>
 *
 * Message text is rendered as a React text node (pre-wrap): never HTML (plan C.4).
 */

export type BubbleSide = 'me' | 'them';
export type BubbleState = 'sent' | 'sending' | 'failed';

export interface ChatBubbleProps {
  side?: BubbleSide;
  /** Colour family for card-like bubbles (`share` blue, `note` brass); plain text bubbles omit it. */
  tone?: Tone;
  /** Quiet one-line bubble: "You deleted a message", "Couldn't verify this message". */
  muted?: boolean;
  /** System line (program updated...): centred, dashed edge. */
  system?: boolean;
  /** Small icon + word above the content ("Shared program", "Private note"). */
  kind?: { icon: string; label: string };
  icon?: string;
  state?: BubbleState;
  stateLabel?: string;
  retryLabel?: string;
  onRetry?: () => void;
  children: ReactNode;
  className?: string;
}

export function ChatBubble({
  side = 'them',
  tone,
  muted,
  system,
  kind,
  icon,
  state = 'sent',
  stateLabel,
  retryLabel,
  onRetry,
  children,
  className,
}: ChatBubbleProps) {
  const cls = [
    'uibub',
    `uibub--${side}`,
    tone ? `uibub--toned ${toneClass(tone)}` : '',
    muted ? 'uibub--muted' : '',
    system ? 'uibub--system' : '',
    state !== 'sent' ? `is-${state}` : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls}>
      {kind && (
        <span className="uibub-kind">
          <Icon name={kind.icon} />
          {kind.label}
        </span>
      )}
      <div className="uibub-body">
        {icon && <Icon name={icon} className="uibub-ic" />}
        <div className="uibub-t">{children}</div>
      </div>
      {state !== 'sent' && stateLabel && (
        <span className="uibub-state" role={state === 'failed' ? 'alert' : 'status'}>
          {state === 'failed' && <Icon name="warning-circle" />}
          {stateLabel}
          {state === 'failed' && onRetry && retryLabel && (
            <Button variant="link" inline size="sm" onClick={onRetry}>
              {retryLabel}
            </Button>
          )}
        </span>
      )}
    </div>
  );
}

export interface ChatMessageProps {
  side: BubbleSide | 'center';
  /** "09:05" under the bubble. */
  time?: string;
  /** Face + name above the first bubble of a run (a node: Avatar + word). */
  sender?: ReactNode;
  /** The "..." trigger: visible on hover / focus on desktop, always on touch (CSS). */
  actions?: ReactNode;
  highlight?: boolean;
  /** Spoken name for the row ("Oleh, 09:05"). */
  label?: string;
  children: ReactNode;
  onLongPress?: () => void;
  id?: string;
}

/** One list row of the thread: sender line, bubble + actions, time. */
export function ChatMessage({
  side,
  time,
  sender,
  actions,
  highlight,
  label,
  children,
  onLongPress,
  id,
}: ChatMessageProps) {
  const press = useLongPress(onLongPress);
  return (
    <li
      id={id}
      className={['uimsg', `uimsg--${side}`, highlight ? 'is-hl' : ''].filter(Boolean).join(' ')}
      aria-label={label}
      {...press}
    >
      {sender && <span className="uimsg-who">{sender}</span>}
      <div className="uimsg-row">
        {children}
        {actions && <span className="uimsg-act">{actions}</span>}
      </div>
      {time && <small className="uimsg-time">{time}</small>}
    </li>
  );
}

/** Long press (450 ms) and context menu both open the message menu; scrolling cancels. */
function useLongPress(cb?: () => void) {
  const t = useRef<number | undefined>(undefined);
  if (!cb) return {};
  const stop = () => window.clearTimeout(t.current);
  return {
    onTouchStart: () => {
      stop();
      t.current = window.setTimeout(cb, 450);
    },
    onTouchEnd: stop,
    onTouchMove: stop,
    onContextMenu: (e: { preventDefault: () => void }) => {
      e.preventDefault();
      cb();
    },
  };
}

export function ChatDay({ children }: { children: ReactNode }) {
  return (
    <li className="uichat-day">
      <span role="separator">{children}</span>
    </li>
  );
}

/** "New messages" line: its position is fixed when the thread opens (derived from readUpTo). */
export function ChatNewDivider({ children }: { children: ReactNode }) {
  return (
    <li className="uichat-new">
      <span role="separator" aria-label={String(children)}>
        {children}
      </span>
    </li>
  );
}
