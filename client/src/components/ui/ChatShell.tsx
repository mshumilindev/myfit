import type { CSSProperties, ReactNode } from 'react';
import { Card } from './Card';
import { useFillViewport } from './useFillViewport';
import '../../coach/chat/Chat.css'; // the chat's shared list/bar/scroll rules: every chat draws them
import './ChatShell.css';

export interface ChatShellProps {
  /** The bar at the top (back, who, actions). */
  head: ReactNode;
  /** Everything between the bar and the composer: notices, the scrolling list. */
  children: ReactNode;
  /** The composer (kit `ChatComposer`). */
  foot?: ReactNode;
  /** Dialogs, menus and sheets that belong to the chat; drawn inside so they share its theme variables. */
  overlays?: ReactNode;
  /** Theme hook: a class that sets the `--chat-*` variables (accent, glow). The only thing that differs between chats. */
  className?: string;
  style?: CSSProperties;
}

/**
 * THE chat frame (kit group `Coach/Chat`): the one layout every conversation uses (the trainer's, the client's and
 * Atlas's). Bar on top, a body that takes the rest and scrolls inside, the composer at the bottom. On a phone it is
 * the page itself: edge to edge, no card, safe-area padding under the composer. From 720 px it is a card. It fills
 * what is left of the screen (`--chs-avail`, measured), so nothing is clipped by a frame shorter than the window.
 *
 * Designs change here (ChatShell.css, ChatBubble.css, ChatComposer.css); a chat only sets the `--chat-*` colours.
 */
export function ChatShell({ head, children, foot, overlays, className, style }: ChatShellProps) {
  const ref = useFillViewport();
  return (
    <div className="chs-wrap" ref={ref}>
      <Card pad="none" className={['chs', className].filter(Boolean).join(' ')} style={style}>
        <div className="chs-head">{head}</div>
        <div className="chs-body">{children}</div>
        {foot && <div className="chs-foot">{foot}</div>}
        {overlays}
      </Card>
    </div>
  );
}
