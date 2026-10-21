/** The draft store behind the editor and the check: cache first, edits never lost, optimistic concurrency, honest save states. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setRowMode } from './ops';
import { createDraftStore, type DraftStore } from './draftStore';
import { buildFixtureWorld } from '../data/__fixtures__/fixtures';
import { buildBundle, fixtureWorldLite } from './__fixtures__/fixtures';
import type { ProgramPort } from './port';
import { ProgramPortError, type ProgramBundle } from './types';

const NOW = Date.UTC(2026, 9, 7, 9, 5);
const cid = 'c1';
const oleh = buildFixtureWorld().clients.find((c) => c.id === cid)!;
const bundle = (over: Partial<ProgramBundle> = {}): ProgramBundle => ({
  ...buildBundle(oleh, fixtureWorldLite()),
  ...over,
});

interface Script {
  port: ProgramPort;
  load: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  copy: ReturnType<typeof vi.fn>;
  signals: AbortSignal[];
}
/** A port whose every call is scripted by the test (the Firestore adapter is what is faked, never the store). */
function script(o: { cached?: ProgramBundle | null; first?: ProgramBundle | Error } = {}): Script {
  const signals: AbortSignal[] = [];
  const load = vi.fn(async (_c: string, opts: { signal: AbortSignal }) => {
    signals.push(opts.signal);
    const r = o.first ?? bundle();
    if (r instanceof Error || r instanceof DOMException) throw r;
    return r;
  });
  const save = vi.fn(async (_c: string, i: { baseRev: number }) => ({ rev: i.baseRev + 1 }));
  const send = vi.fn(async (_c: string, i: { baseRev: number }) => ({
    version: 6,
    rev: i.baseRev + 1,
  }));
  const copy = vi.fn(async () => undefined);
  const port: ProgramPort = {
    peek: () => o.cached ?? null,
    load,
    saveDraft: save,
    send,
    library: () => [],
    copyTo: copy,
  };
  return { port, load, save, send, copy, signals };
}

const flush = () => new Promise((r) => setTimeout(r, 0));
async function started(s: Script): Promise<DraftStore> {
  const st = createDraftStore(s.port, cid);
  st.start();
  await flush();
  return st;
}
const someRow = (st: DraftStore) => st.getState().draft!.items.find((i) => i.kind === 'strength')!;

beforeEach(() => vi.useFakeTimers({ toFake: ['Date'], now: NOW }));
afterEach(() => vi.useRealTimers());

describe('loading', () => {
  it('a cold start is loading, then adopts the server bundle with its trainer days', async () => {
    const st = createDraftStore(script().port, cid);
    expect(st.getState()).toMatchObject({ loading: true, bundle: null, draft: null });
    st.start();
    await flush();
    const s = st.getState();
    expect(s.loading).toBe(false);
    expect(s.bundle!.clientId).toBe(cid);
    expect(s.draft).toBe(s.bundle!.draft);
    expect(s.trainerDays).toEqual(s.bundle!.trainerDays);
    expect(s.dirty).toBe(false);
  });

  it('a warm cache shows at once and a second start() does not load again', async () => {
    const sc = script({ cached: bundle() });
    const st = createDraftStore(sc.port, cid);
    st.start();
    expect(st.getState().draft).not.toBeNull();
    expect(st.getState().loading).toBe(false);
    await flush();
    st.start();
    await flush();
    expect(sc.load).toHaveBeenCalledTimes(1);
  });

  it.each([
    [new ProgramPortError('offline'), 'offline'],
    [new ProgramPortError('forbidden'), 'forbidden'],
    [new ProgramPortError('conflict'), 'unavailable'],
    [new ProgramPortError('vault-locked'), 'unavailable'],
    [new Error('boom'), 'unavailable'],
  ] as const)('a first load failing with %s is shown as "%s"', async (err, shown) => {
    const st = await started(script({ first: err }));
    expect(st.getState()).toMatchObject({ loading: false, bundle: null, error: shown });
  });

  it('retry from an error goes back to loading and then adopts what the server now has', async () => {
    const sc = script({ first: new ProgramPortError('offline') });
    const st = await started(sc);
    expect(st.getState().error).toBe('offline');
    sc.load.mockImplementationOnce(async () => {
      expect(st.getState()).toMatchObject({ loading: true, error: null });
      return bundle({ rev: 9 });
    });
    st.retry();
    await flush();
    expect(st.getState()).toMatchObject({ loading: false, error: null });
    expect(st.getState().bundle!.rev).toBe(9);
  });

  it('a failed background refresh keeps the cached bundle and shows no error', async () => {
    const sc = script({ cached: bundle(), first: new ProgramPortError('offline') });
    const st = createDraftStore(sc.port, cid);
    st.start();
    await flush();
    expect(st.getState().error).toBeNull();
    expect(st.getState().bundle).not.toBeNull();
  });

  it('an aborted load is silent, and stop() aborts the one in flight', async () => {
    const sc = script({ first: new DOMException('aborted', 'AbortError') });
    const st = createDraftStore(sc.port, cid);
    st.start();
    await flush();
    expect(st.getState()).toMatchObject({ loading: true, error: null });
    st.stop();
    expect(sc.signals.at(-1)!.aborted).toBe(true);
  });

  it('a newer load aborts the previous one', async () => {
    const sc = script();
    const st = await started(sc);
    st.retry();
    expect(sc.signals).toHaveLength(2);
    expect(sc.signals[0].aborted).toBe(true);
    expect(sc.signals[1].aborted).toBe(false);
  });

  it("a refresh never replaces edits in progress; the base revision moves to the server's", async () => {
    const sc = script({ cached: bundle({ rev: 1 }), first: bundle({ rev: 4 }) });
    const st = createDraftStore(sc.port, cid);
    st.start();
    st.edit((d) => setRowMode(d, someRow(st).id, true));
    const mine = st.getState().draft;
    await flush();
    expect(st.getState().draft).toBe(mine);
    expect(st.getState().dirty).toBe(true);
    expect(st.getState().bundle!.rev).toBe(4);
    await st.saveDraft();
    expect(sc.save.mock.calls[0][1].baseRev).toBe(4);
  });
});

describe('editing', () => {
  it('edit before anything is loaded does nothing; an edit that changes nothing is not dirty', async () => {
    const sc = script();
    const st = createDraftStore(sc.port, cid);
    st.edit((d) => ({ ...d, name: 'x' }));
    expect(st.getState().draft).toBeNull();
    st.start();
    await flush();
    st.edit((d) => d);
    expect(st.getState().dirty).toBe(false);
  });

  it('undo steps back through labelled edits only, keeps the last five, and does nothing on an empty stack', async () => {
    const st = await started(script());
    st.undo();
    expect(st.getState().dirty).toBe(false);
    const original = st.getState().draft!;
    for (let i = 1; i <= 7; i++) st.edit((d) => ({ ...d, name: `v${i}` }), `step ${i}`);
    st.edit((d) => ({ ...d, name: 'unlabelled' }));
    expect(st.getState().undo.map((u) => u.label)).toEqual([
      'step 3',
      'step 4',
      'step 5',
      'step 6',
      'step 7',
    ]);
    st.undo();
    // each step stores the draft from BEFORE its edit: undoing step 7 brings back v6
    expect(st.getState().draft!.name).toBe('v6');
    expect(st.getState().undo).toHaveLength(4);
    expect(st.getState().dirty).toBe(true);
    for (let i = 0; i < 6; i++) st.undo();
    expect(st.getState().draft!.name).toBe('v2');
    expect(st.getState().draft).not.toBe(original);
  });

  it('changing the trainer days marks the draft dirty and clears a previous "saved"', async () => {
    const st = await started(script());
    await st.saveDraft();
    expect(st.getState().save.kind).toBe('saved');
    st.setTrainerDays(['Tue']);
    expect(st.getState()).toMatchObject({
      trainerDays: ['Tue'],
      dirty: true,
      save: { kind: 'idle' },
    });
  });
});

describe('saving', () => {
  it('sends the draft, the days and the base revision; success records the new revision and the time', async () => {
    const sc = script({ first: bundle({ rev: 3 }) });
    const st = await started(sc);
    st.setTrainerDays(['Mon', 'Thu']);
    st.edit((d) => ({ ...d, name: 'Block 4' }));
    await st.saveDraft();
    expect(sc.save).toHaveBeenCalledTimes(1);
    const [c, input] = sc.save.mock.calls[0];
    expect(c).toBe(cid);
    expect(input).toMatchObject({ trainerDays: ['Mon', 'Thu'], baseRev: 3 });
    expect(input.draft.name).toBe('Block 4');
    const s = st.getState();
    expect(s.dirty).toBe(false);
    expect(s.save).toEqual({ kind: 'saved', at: NOW });
    expect(s.bundle!.rev).toBe(4);
    expect(s.bundle!.draft.name).toBe('Block 4');
  });

  it('a second save while one is running is ignored (idempotent double tap)', async () => {
    const sc = script();
    const st = await started(sc);
    let release!: () => void;
    sc.save.mockImplementationOnce(() => new Promise((res) => (release = () => res({ rev: 2 }))));
    const first = st.saveDraft();
    expect(st.getState().save.kind).toBe('saving');
    await st.saveDraft();
    release();
    await first;
    expect(sc.save).toHaveBeenCalledTimes(1);
  });

  it.each([
    [new ProgramPortError('conflict'), 'conflict'],
    [new ProgramPortError('vault-locked'), 'vault-locked'],
    [new ProgramPortError('forbidden'), 'forbidden'],
    [new Error('boom'), 'unavailable'],
  ] as const)('a save failing with %s keeps the edits and reports "%s"', async (err, code) => {
    const sc = script();
    const st = await started(sc);
    st.edit((d) => ({ ...d, name: 'mine' }));
    sc.save.mockRejectedValueOnce(err);
    await st.saveDraft();
    expect(st.getState().save).toEqual({ kind: 'error', code, during: 'save' });
    expect(st.getState().dirty).toBe(true);
    expect(st.getState().draft!.name).toBe('mine');
  });

  it('saving or sending before anything is loaded does nothing', async () => {
    const sc = script();
    const st = createDraftStore(sc.port, cid);
    await st.saveDraft();
    await st.send();
    await st.copyTo('c2');
    expect(sc.save).not.toHaveBeenCalled();
    expect(sc.send).not.toHaveBeenCalled();
    expect(sc.copy).not.toHaveBeenCalled();
  });
});

describe('sending', () => {
  it('the draft becomes live: versions move on, the undo stack is dropped, "sent" is stamped', async () => {
    const sc = script({ first: bundle({ rev: 2, liveVersion: 4, draftVersion: 5 }) });
    const st = await started(sc);
    st.edit((d) => ({ ...d, name: 'Go' }), 'rename');
    await st.send();
    const s = st.getState();
    expect(sc.send.mock.calls[0][1].baseRev).toBe(2);
    expect(s.save).toEqual({ kind: 'sent', version: 6 });
    expect(s.bundle).toMatchObject({
      rev: 3,
      liveVersion: 6,
      draftVersion: 7,
      sentAt: NOW,
      seen: null,
    });
    expect(s.bundle!.live.name).toBe('Go');
    expect(s.undo).toEqual([]);
    expect(s.dirty).toBe(false);
  });

  it('a second send while one is running is ignored; a failed send is reported as a send failure', async () => {
    const sc = script();
    const st = await started(sc);
    let release!: () => void;
    sc.send.mockImplementationOnce(
      () => new Promise((res) => (release = () => res({ version: 6, rev: 2 }))),
    );
    const first = st.send();
    await st.send();
    release();
    await first;
    expect(sc.send).toHaveBeenCalledTimes(1);
    sc.send.mockRejectedValueOnce(new ProgramPortError('offline'));
    await st.send();
    expect(st.getState().save).toEqual({ kind: 'error', code: 'offline', during: 'send' });
  });
});

describe('copying to another client', () => {
  it('saves a dirty draft first, copies, and marks that client as on the draft version', async () => {
    const sc = script();
    const st = await started(sc);
    const other = st.getState().bundle!.sharedWith[0];
    st.edit((d) => ({ ...d, name: 'Shared' }));
    await st.copyTo(other.clientId);
    expect(sc.save).toHaveBeenCalledTimes(1);
    expect(sc.copy).toHaveBeenCalledWith(cid, other.clientId);
    const b = st.getState().bundle!;
    expect(b.sharedWith.find((s) => s.clientId === other.clientId)!.version).toBe(b.draftVersion);
    expect(
      b.sharedWith
        .filter((s) => s.clientId !== other.clientId)
        .every((s) => s.version === other.version),
    ).toBe(true);
  });

  it('a clean draft is copied without a save', async () => {
    const sc = script();
    const st = await started(sc);
    await st.copyTo(st.getState().bundle!.sharedWith[0].clientId);
    expect(sc.save).not.toHaveBeenCalled();
    expect(sc.copy).toHaveBeenCalledTimes(1);
  });

  it('when the save before the copy fails, nothing is copied (the other client never gets an unsaved draft)', async () => {
    const sc = script();
    const st = await started(sc);
    st.edit((d) => ({ ...d, name: 'Unsaved' }));
    sc.save.mockRejectedValueOnce(new ProgramPortError('conflict'));
    await st.copyTo(st.getState().bundle!.sharedWith[0].clientId);
    expect(sc.copy).not.toHaveBeenCalled();
    expect(st.getState().save).toMatchObject({ kind: 'error', code: 'conflict' });
  });
});

describe('reload after a conflict', () => {
  it("drops the local edits and takes the server's draft", async () => {
    const sc = script({ first: bundle({ rev: 1 }) });
    const st = await started(sc);
    st.edit((d) => ({ ...d, name: 'Mine' }), 'rename');
    sc.save.mockRejectedValueOnce(new ProgramPortError('conflict'));
    await st.saveDraft();
    sc.load.mockResolvedValueOnce(bundle({ rev: 2 }));
    st.reload();
    await flush();
    const s = st.getState();
    expect(s).toMatchObject({ dirty: false, save: { kind: 'idle' }, undo: [] });
    expect(s.draft!.name).not.toBe('Mine');
    expect(s.bundle!.rev).toBe(2);
  });
});
