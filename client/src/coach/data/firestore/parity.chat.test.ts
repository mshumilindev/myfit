/**
 * Chat, security code and key change between the two apps over the shared store with the rules enforced.
 */
import { describe, expect, it } from 'vitest';
import { observe } from '../../security/trustStore';
import { C, T } from './parity/harness';
import { latest, linkUp, settle } from './parity/flow';

type Msg = {
  id: string;
  from: string;
  state?: string;
  deleted?: unknown;
  body: { kind: string; text?: string };
};

describe('chat both ways', () => {
  it('unread, read pointer, own delete (tombstone for the other side), per-user clear and undo', async () => {
    const w = await linkUp();
    const { tr, cl, cid } = w;
    const seen: number[] = [];
    const off = cl.chatClient.subscribeUnread(cid, (n) => seen.push(n));
    for (const [i, t] of ['One', 'Two', 'Three'].entries())
      await tr.chat.send(cid, { id: `t${i}`, text: t, at: tr.fs.now() + i });
    await settle(60);
    expect(seen[seen.length - 1]).toBe(3);
    const thread = (await latest<{ messages: Msg[] }>((on, er) =>
      cl.chatClient.subscribe(cid, on as never, er),
    ))!;
    expect(thread.messages.map((m) => m.body.text)).toEqual(['Hi coach', 'One', 'Two', 'Three']);
    await cl.chatClient.markRead(cid);
    await settle(40);
    expect(seen[seen.length - 1]).toBe(0);
    off();

    await cl.chatClient.send(cid, { id: 'c-del', text: 'oops', at: cl.fs.now() });
    await settle(30);
    await cl.chatClient.softDelete(cid, 'c-del');
    await cl.chatClient.commitDelete(cid, 'c-del');
    await settle(40);
    const theirs =
      (await latest<Msg[]>((on, er) => tr.chat.subscribeMessages(cid, on as never, er))) ?? [];
    expect(theirs.find((m) => m.id === 'c-del')?.deleted).toBeTruthy();

    const prev = await cl.chatClient.clearChat(cid);
    await settle(40);
    const mine = (await latest<{ messages: Msg[] }>((on, er) =>
      cl.chatClient.subscribe(cid, on as never, er),
    ))!;
    const trainerSide =
      (await latest<Msg[]>((on, er) => tr.chat.subscribeMessages(cid, on as never, er))) ?? [];
    expect(mine.messages).toHaveLength(0);
    expect(trainerSide.length).toBeGreaterThan(0); // clearing is a view of one person only
    await cl.chatClient.undoClear(cid, prev.previous);
    await settle(30);
    const back = (await latest<{ messages: Msg[] }>((on, er) =>
      cl.chatClient.subscribe(cid, on as never, er),
    ))!;
    expect(back.messages.length).toBeGreaterThan(0);
    expect(tr.fs.denied).toEqual([]);
    expect(cl.fs.denied).toEqual([]);
  });
});

describe('security code and a changed trainer key', () => {
  it('both sides see the same code; a new trainer key raises the banner and the client device re-wraps it on its own', async () => {
    const w = await linkUp();
    const { tr, cl, s, cid } = w;
    type Trust = { code: string };
    const tc = (await latest<Trust>((on, er) => tr.trust.subscribe(T, on as never, er), 80))!;
    const cc = (await latest<Trust>((on, er) => cl.trust.subscribe(T, on as never, er), 80))!;
    expect(tc.code).toBeTruthy();
    expect(tc.code).toBe(cc.code);
    const first = observe(null, cc.code);

    await tr.rotateKey();
    await settle(700); // the client device retries until the server has signed the new key
    const cc2 = (await latest<Trust>((on, er) => cl.trust.subscribe(T, on as never, er), 80))!;
    expect(cc2.code).not.toBe(cc.code);
    expect(observe(first.rec, cc2.code).changed).toBe(true);
    // the client device wrapped the conversation key for the new trainer key WITHOUT the client sending anything
    await tr.book.refresh();
    expect((await s.fs.get(`conversations/${cid}`))?.keyStale).not.toBe(true);
    await tr.chat.send(cid, { id: 'post-rot', text: 'after rotation', at: tr.fs.now() });
    // and the client can keep writing (the stale flag must not make every send try the same re-wrap again)
    await cl.chatClient.send(cid, { id: 'c-after', text: 'still works', at: cl.fs.now() });
    // older history still opens for the trainer
    const hist =
      (await latest<Msg[]>((on, er) => tr.chat.subscribeMessages(cid, on as never, er), 100)) ?? [];
    expect(hist.every((m) => m.state !== 'unverified')).toBe(true);
    expect(C).toBe('client-1');
  });
});
