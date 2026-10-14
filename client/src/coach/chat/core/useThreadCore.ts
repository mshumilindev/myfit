import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useChatT } from '../../../i18n/coachChat';
import type { ChatMessage as Msg } from '../types';

/** The chat dictionary as the thread pieces use it. */
export type ChatWords = ReturnType<typeof useChatT>['ch'];

/** The message a thread opened with unread: the "New messages" line goes above it (null = no line). */
export function firstNewIdOf(
  messages: readonly Msg[],
  theirFrom: 'trainer' | 'client',
  unreadAtOpen: number,
): string | null {
  const theirs = messages.filter((m) => m.from === theirFrom && !m.deleted);
  return unreadAtOpen > 0 ? (theirs[theirs.length - unreadAtOpen]?.id ?? null) : null;
}

/** Reading: opening (and staying in) the thread zeroes its count. `cid` null = no conversation yet. */
export function useMarkRead(
  status: string,
  store: { markRead(cid: string): void },
  cid: string | null,
  theirCount: number,
) {
  useEffect(() => {
    if (status !== 'ready' || !cid) return;
    const mark = () => {
      if (document.visibilityState !== 'hidden') store.markRead(cid);
    };
    mark();
    document.addEventListener('visibilitychange', mark);
    return () => document.removeEventListener('visibilitychange', mark);
  }, [status, store, cid, theirCount]);
}

export interface ThreadScrollOpts {
  status: string;
  /** the "New messages" line is decided: scrolling may settle */
  ready: boolean;
  messages: readonly Msg[];
  firstNewId: string | null;
  /** whose messages follow the view to the end even when scrolled up */
  mineFrom: 'trainer' | 'client';
  /** older page (trainer side); absent = no paging */
  loadMore?: () => void;
}

/**
 * Scrolling: to the new-messages line on open, else the end; follow new messages when near the end; when an
 * older page loads the view stays on the message the user was reading.
 */
export function useThreadScroll(o: ThreadScrollOpts) {
  const scroller = useRef<HTMLDivElement>(null);
  const settled = useRef(false);
  const lastLen = useRef(0);
  const paging = useRef<{ h: number; top: number } | null>(null);
  const { status, ready, messages, firstNewId, mineFrom, loadMore } = o;
  const earlier = () => {
    const el = scroller.current;
    if (el) paging.current = { h: el.scrollHeight, top: el.scrollTop };
    loadMore?.();
  };
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || status !== 'ready' || !ready) return;
    if (paging.current && messages.length > lastLen.current) {
      el.scrollTop = el.scrollHeight - paging.current.h + paging.current.top;
      paging.current = null;
    } else if (!settled.current) {
      settled.current = true;
      const line = firstNewId ? el.querySelector<HTMLElement>('.uichat-new') : null;
      // show the day label just above the line when there is one
      const lead = line?.previousElementSibling?.classList.contains('uichat-day')
        ? (line.previousElementSibling as HTMLElement)
        : line;
      el.scrollTop = lead ? Math.max(0, lead.offsetTop - el.offsetTop - 8) : el.scrollHeight;
    } else if (messages.length > lastLen.current) {
      const near = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
      const mine = messages[messages.length - 1]?.from === mineFrom;
      if (near || mine) el.scrollTop = el.scrollHeight;
    }
    lastLen.current = messages.length;
  }, [messages, status, firstNewId, ready, mineFrom]);
  return { scroller, earlier };
}

/** The short "Copied" snackbar state and the copy action. */
export function useFlash(ch: ChatWords) {
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 2200);
    return () => window.clearTimeout(t);
  }, [flash]);
  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text).catch(() => undefined);
    setFlash(ch.chCopied);
  };
  return { flash, setFlash, copy };
}

/** Which menu is open (a message id or 'head') and the element it hangs from. */
export function useMenuState() {
  const [menu, setMenu] = useState<string | null>(null);
  const anchor = useRef<HTMLElement | null>(null);
  function openMenu(id: string, el: HTMLElement | null) {
    anchor.current = el;
    setMenu(id);
  }
  return { menu, setMenu, anchor, openMenu };
}

export type ThreadConfirm = { kind: 'msg'; id: string } | { kind: 'chat' } | null;
