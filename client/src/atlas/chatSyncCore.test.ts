import { describe, expect, it } from 'vitest';
import { ATLAS_WINDOW, MAX_TEXT, fromWire, mergeChat, missingRemote, toWire } from './chatSyncCore';
import type { ChatMsg } from './chatLog';

const m = (id: string, at: number, over: Partial<ChatMsg> = {}): ChatMsg => ({
  id,
  at,
  from: 'me',
  text: id,
  ...over,
});

describe('Atlas chat in the account (SPO-392)', () => {
  it('toWire drops pending and bounds the text and chips', () => {
    const w = toWire(
      m('a', 1, { pending: true, text: 'x'.repeat(MAX_TEXT + 50), chips: Array(20).fill('c') }),
    );
    expect('pending' in w).toBe(false);
    expect((w.text as string).length).toBe(MAX_TEXT);
    expect((w.chips as string[]).length).toBe(8);
  });

  it('toWire keeps the AI mark (EU AI Act Art. 50) and fromWire gives the message back', () => {
    const msg = m('a', 5, { from: 'atlas', ai: 'gemini', intent: 'sleep', q: 'hi' });
    const back = fromWire({ ...toWire(msg), updatedAt: 9, enc: { v: 1 } });
    expect(back).toEqual(msg);
  });

  it('fromWire refuses anything that is not a message', () => {
    expect(fromWire(null)).toBeNull();
    expect(fromWire({ id: 'a', at: 1, from: 'bot', text: 't' })).toBeNull();
    expect(fromWire({ id: '', at: 1, from: 'me', text: 't' })).toBeNull();
    expect(fromWire({ id: 'a', at: 'x', from: 'me', text: 't' })).toBeNull();
    expect(fromWire({ id: 'a', at: 1, from: 'me' })).toBeNull();
  });

  it('merge: union by id, oldest first, the account wins on the same id', () => {
    const out = mergeChat(
      [m('a', 1, { text: 'old' }), m('c', 3)],
      [m('a', 1, { text: 'new' }), m('b', 2)],
      0,
    );
    expect(out.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(out[0].text).toBe('new');
  });

  it('merge: nothing at or before the clear-history watermark comes back, except what is still being answered', () => {
    const out = mergeChat([m('a', 5), m('p', 4, { pending: true })], [m('b', 10), m('c', 20)], 10);
    expect(out.map((x) => x.id)).toEqual(['p', 'c']);
  });

  it('merge keeps the last 100', () => {
    const remote = Array.from({ length: 130 }, (_, i) => m(`r${i}`, i + 1));
    const out = mergeChat([], remote, 0);
    expect(out).toHaveLength(ATLAS_WINDOW);
    expect(out[0].id).toBe('r30');
    expect(out.at(-1)?.id).toBe('r129');
  });

  it('missingRemote lists local messages the account lacks, never pending ones', () => {
    const out = missingRemote([m('a', 1), m('b', 2), m('p', 3, { pending: true })], new Set(['a']));
    expect(out.map((x) => x.id)).toEqual(['b']);
  });
});
