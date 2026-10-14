import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as core from './index';
import { buildThreadRows, firstNewIdOf, messageMenuItems } from './index';
import { chatEn as en } from '../../../i18n/coachChat.en';
import type { ChatMessage } from '../types';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const trainerHost = read('../ThreadView.tsx');
const clientHost = read('../../client/screens/ClientChat.tsx');

const msg = (id: string, from: ChatMessage['from'], at: number, text = id): ChatMessage =>
  ({ id, cid: 'c', from, at, state: 'sent', body: { kind: 'text', text } }) as ChatMessage;

describe('the chat thread core is the only implementation of the thread', () => {
  it('both hosts import the core and each of its pieces', () => {
    for (const src of [trainerHost, clientHost]) {
      expect(src).toMatch(/from '(\.\/|\.\.\/\.\.\/chat\/)core'/);
      for (const name of [
        'buildThreadRows',
        'ThreadBody',
        'ThreadComposer',
        'ThreadMenu',
        'useThreadScroll',
        'useMarkRead',
        'useFlash',
        'useMenuState',
        'messageMenuItems',
        'firstNewIdOf',
        'DeleteMessageDialog',
        'ClearChatDialog',
      ]) {
        expect(src).toContain(name);
        expect((core as Record<string, unknown>)[name]).toBeDefined();
      }
    }
  });

  it('neither host re-implements the pieces the core owns', () => {
    for (const src of [trainerHost, clientHost]) {
      for (const own of [
        'ChatNewDivider',
        'role="log"',
        'ConfirmEffectsDialog title={ch.chClearTitle',
        'visibilitychange',
        'useLayoutEffect',
        '<ChatComposer',
        '<UndoToast',
        '<MessageMenu',
      ]) {
        expect(src).not.toContain(own);
      }
    }
  });
});

describe('core behaviour', () => {
  it('firstNewIdOf points at the first of the unread messages from the other side', () => {
    const ms = [
      msg('a', 'client', 1),
      msg('b', 'trainer', 2),
      msg('c', 'client', 3),
      msg('d', 'client', 4),
    ];
    expect(firstNewIdOf(ms, 'client', 2)).toBe('c');
    expect(firstNewIdOf(ms, 'client', 0)).toBeNull();
    expect(firstNewIdOf(ms, 'trainer', 1)).toBe('b');
  });

  it('message menu: own text = Copy + Delete, theirs = Copy + disabled Delete, share = Delete only', () => {
    const base = { first: 'Oleh', ch: en, copy: vi.fn(), askDelete: vi.fn() };
    const own = messageMenuItems({ ...base, m: msg('1', 'trainer', 1), mine: true });
    expect(own.items.map((i) => i.id)).toEqual(['copy', 'del']);
    expect(own.rule).toBeTruthy();
    const theirs = messageMenuItems({ ...base, m: msg('2', 'client', 2), mine: false });
    expect(theirs.items[1]?.disabled).toBe(true);
    expect(theirs.rule).toBeUndefined();
    const share = messageMenuItems({
      ...base,
      m: { ...msg('3', 'trainer', 3), body: { kind: 'share', share: 'x' } } as ChatMessage,
      mine: true,
    });
    expect(share.items.map((i) => i.id)).toEqual(['del']);
  });

  it('rows: day divider, New line, distinct "Message actions" names, other kinds go to the host', () => {
    const ms = [
      msg('a', 'client', Date.parse('2026-10-01T08:00:00Z')),
      msg('b', 'trainer', Date.parse('2026-10-01T08:05:00Z')),
    ];
    const rows = buildThreadRows({
      ch: en,
      locale: 'en' as never,
      now: Date.parse('2026-10-01T09:00:00Z'),
      messages: ms,
      notes: [] as { id: string; at: number }[],
      firstNewId: 'a',
      mineFrom: 'trainer',
      first: 'Oleh',
      them: 'Oleh',
      openMenuId: null,
      openMenu: vi.fn(),
      onRetry: vi.fn(),
      noteSide: 'me',
      noteLabel: () => '',
      renderNote: () => null,
      renderOther: () => ({ body: null, withMenu: false }),
    });
    render(<ol>{rows}</ol>);
    expect(document.querySelector('.uichat-day')).toBeTruthy();
    expect(document.querySelector('.uichat-new')).toBeTruthy();
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(names).toHaveLength(2);
    expect(new Set(names).size).toBe(2);
  });
});
