import { describe, expect, it } from 'vitest';
import { startAtlasHistory, type HistoryPorts } from './chatSyncService';
import type { ChatEdit, ChatMsg } from './chatLog';

const m = (id: string, at: number, over: Partial<ChatMsg> = {}): ChatMsg => ({
  id,
  at,
  from: 'me',
  text: id,
  ...over,
});

const noop = () => undefined;
function rig(local: ChatMsg[] = []) {
  const s = {
    local,
    puts: [] as string[],
    dels: [] as string[],
    wipes: 0,
    state: [] as { clearedAt: number; withdrawnAt: number | null }[],
    errors: [] as unknown[],
    docs: noop as HistoryPorts extends { watchDocs(a: infer A): unknown } ? A : never,
    clear: noop as HistoryPorts extends { watchState(a: infer A): unknown } ? A : never,
    edit: noop as (e: ChatEdit) => void,
    offs: 0,
    t: 1000,
  };
  const ports: HistoryPorts = {
    watchDocs: (a) => ((s.docs = a), () => void s.offs++),
    watchState: (a) => ((s.clear = a), () => void s.offs++),
    put: async (x) => void s.puts.push(x.id),
    del: async (id) => void s.dels.push(id),
    deleteAll: async () => void s.wipes++,
    putState: async (x) => void s.state.push(x),
    getLocal: () => s.local,
    replaceLocal: (n) => void (s.local = n),
    onLocalEdit: (f) => ((s.edit = f), () => void s.offs++),
    now: () => s.t,
    onError: (e) => void s.errors.push(e),
  };
  return { s, ports };
}
const edit = (o: Partial<ChatEdit>): ChatEdit => ({
  upsert: [],
  removed: [],
  cleared: false,
  ...o,
});

describe('Atlas chat sync controller (SPO-392)', () => {
  it('shows nothing from the account before the first snapshot, then merges it with this device', () => {
    const { s, ports } = rig([m('a', 1)]);
    startAtlasHistory(ports);
    s.clear({ clearedAt: 0, withdrawnAt: null }, { locked: 0 });
    expect(s.local.map((x) => x.id)).toEqual(['a']);
    s.docs([m('b', 2)], { locked: 0 });
    expect(s.local.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('a local edit is written, a removal is deleted', () => {
    const { s, ports } = rig();
    startAtlasHistory(ports);
    s.edit(edit({ upsert: [m('a', 1)], removed: ['z'] }));
    expect(s.puts).toEqual(['a']);
    expect(s.dels).toEqual(['z']);
  });

  it('clearing sets the watermark, deletes the account copy and hides what a stale device still has', () => {
    const { s, ports } = rig([m('a', 400), m('b', 500)]);
    startAtlasHistory(ports);
    s.edit(edit({ cleared: true }));
    expect(s.state).toEqual([{ clearedAt: 500, withdrawnAt: null }]); // the newest message, not the device clock
    expect(s.wipes).toBe(1);
    // a document written before the clear arrives late
    s.local = [];
    s.docs([m('old', 500)], { locked: 0 });
    expect(s.local).toEqual([]);
  });

  it('a watermark from another device clears this device too', () => {
    const { s, ports } = rig([m('a', 5), m('b', 50)]);
    startAtlasHistory(ports);
    s.docs([], { locked: 0 });
    s.clear({ clearedAt: 10, withdrawnAt: null }, { locked: 0 });
    expect(s.local.map((x) => x.id)).toEqual(['b']);
  });

  it('trims the account to 100 only when the vault is open', () => {
    const many = Array.from({ length: 102 }, (_, i) => m(`r${i}`, i + 1));
    const a = rig();
    startAtlasHistory(a.ports);
    a.s.docs(many, { locked: 3 });
    expect(a.s.dels).toEqual([]);
    a.s.docs(many, { locked: 0 });
    expect(a.s.dels).toEqual(['r0', 'r1']);
  });

  it('upload sends only what the account lacks; stop detaches everything', async () => {
    const { s, ports } = rig([m('a', 1), m('b', 2), m('p', 3, { pending: true })]);
    const h = startAtlasHistory(ports);
    s.docs([m('a', 1)], { locked: 0 });
    expect(await h.uploadLocal()).toBe(1);
    expect(s.puts).toEqual(['b']);
    h.stop();
    expect(s.offs).toBe(3);
    s.edit(edit({ upsert: [m('c', 9)] }));
    expect(s.puts).toEqual(['b']);
  });

  it('a failed write goes to onError, never throws into the chat', async () => {
    const { s, ports } = rig();
    ports.put = () => Promise.reject(new Error('offline'));
    startAtlasHistory(ports);
    s.edit(edit({ upsert: [m('a', 1)] }));
    await Promise.resolve();
    await Promise.resolve();
    expect(s.errors).toHaveLength(1);
  });

  it('an upload waits for the first full read of the account, so it never re-sends what the account has', async () => {
    const { s, ports } = rig([m('a', 1), m('b', 2)]);
    const h = startAtlasHistory(ports);
    const up = h.uploadLocal();
    await Promise.resolve();
    expect(s.puts).toEqual([]);
    s.docs([m('a', 1)], { locked: 0 });
    expect(await up).toBe(1);
    expect(s.puts).toEqual(['b']);
  });
  it('an upload that was waiting when the sync stops sends nothing', async () => {
    const { s, ports } = rig([m('a', 1)]);
    const h = startAtlasHistory(ports);
    const up = h.uploadLocal();
    h.stop();
    expect(await up).toBe(0);
    expect(s.puts).toEqual([]);
  });

  it('turning the consent back on within the kept time removes the withdrawal mark and brings the chat back', () => {
    const { s, ports } = rig();
    startAtlasHistory(ports);
    s.docs([m('a', 5)], { locked: 0 });
    s.clear({ clearedAt: 0, withdrawnAt: 777 }, { locked: 0 });
    expect(s.state).toEqual([{ clearedAt: 0, withdrawnAt: null }]);
    expect(s.local.map((x) => x.id)).toEqual(['a']);
  });
  it('the withdrawal mark is not removed while the vault is locked (a locked read is not a real one)', () => {
    const { s, ports } = rig();
    startAtlasHistory(ports);
    s.clear({ clearedAt: 0, withdrawnAt: 777 }, { locked: 1 });
    expect(s.state).toEqual([]);
  });

  it('clearing an empty chat writes no watermark (a clock that runs ahead cannot hide later messages)', () => {
    const { s, ports } = rig();
    startAtlasHistory(ports);
    s.edit(edit({ cleared: true }));
    expect(s.state).toEqual([]);
    expect(s.wipes).toBe(1);
  });
});
