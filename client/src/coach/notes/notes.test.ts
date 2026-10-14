// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { pairedRings, trainer, CID, CID2 } from '../../coachCrypto/testHelpers';
import { readyVault, unsetVault } from '../../testVault';
import {
  createFixturesNotesPort,
  createMemoryNotesDocStore,
  seedNotes,
} from './__fixtures__/fixtures';
import { openPrivateNote, openSharedNote, sealPrivateNote, sealSharedNote } from './noteCodec';
import { createNotesStore } from './notesStore';
import { createSealedNotesPort } from './sealedPort';
import { MAX_NOTE, parseAnchor, type Note } from './types';

const AT = 1_791_364_800_123;
const note: Note = {
  id: 'n1',
  clientId: 'c1',
  text: 'left shoulder clicks on the way down',
  vis: 'private',
  anchor: { kind: 'decision', id: 's1', text: 'Bench stalled' },
  at: AT,
  updatedAt: AT,
};

async function setup() {
  const vault = await readyVault();
  const rings = await pairedRings(await trainer());
  return { vault, rings };
}

describe('note codec (Part C: sub-key notes)', () => {
  it('a private note round-trips with the vault key; the stored doc has no plaintext', async () => {
    const { vault } = await setup();
    const doc = await sealPrivateNote({ vault }, note);
    expect(JSON.stringify(doc)).not.toMatch(/shoulder|Bench/);
    expect(Object.keys(doc).sort()).toEqual(['at', 'clientId', 'enc', 'id', 'updatedAt']);
    const back = await openPrivateNote({ vault }, 'n1', doc);
    expect(back).toMatchObject({
      id: 'n1',
      clientId: 'c1',
      vis: 'private',
      text: note.text,
      anchor: note.anchor,
    });
  });

  it('a shared note is sealed with the conversation key: both parties open it, no plaintext, AAD-bound', async () => {
    const { vault, rings } = await setup();
    const doc = await sealSharedNote({ vault, ring: rings.trainer }, note, 'trainer-uid');
    expect(JSON.stringify(doc)).not.toMatch(/shoulder|Bench/);
    expect(Object.keys(doc).sort()).toEqual(['at', 'by', 'enc', 'id', 'keyEpoch', 'updatedAt']);
    expect(doc.at).toBe(Math.floor(AT / 1000) * 1000);
    const read = await openSharedNote({ vault, ring: rings.client }, 'n1', doc, 'c1');
    expect(read).toMatchObject({ text: note.text, vis: 'shared' });
    // copied to another note id, author, time or conversation: refused
    await expect(
      openSharedNote({ vault, ring: rings.client }, 'n2', { ...doc, id: 'n2' }, 'c1'),
    ).rejects.toThrow();
    await expect(
      openSharedNote({ vault, ring: rings.client }, 'n1', { ...doc, by: 'someone' }, 'c1'),
    ).rejects.toThrow();
    await expect(
      openSharedNote(
        { vault, ring: rings.client },
        'n1',
        { ...doc, at: (doc.at as number) + 1000 },
        'c1',
      ),
    ).rejects.toThrow();
    const other = await pairedRings(await trainer(), CID2);
    expect(rings.client.cid).toBe(CID);
    await expect(openSharedNote({ vault, ring: other.trainer }, 'n1', doc, 'c1')).rejects.toThrow();
  });

  it('a locked vault throws and never produces a document', async () => {
    const vault = await unsetVault();
    await expect(sealPrivateNote({ vault }, note)).rejects.toThrow(/vault-locked/);
  });

  it('refuses empty and over-long text before sealing', async () => {
    const { vault } = await setup();
    await expect(sealPrivateNote({ vault }, { ...note, text: '   ' })).rejects.toThrow(
      'empty-note',
    );
    await expect(
      sealPrivateNote({ vault }, { ...note, text: 'x'.repeat(MAX_NOTE + 1) }),
    ).rejects.toThrow('too-long');
  });

  it('a tampered ciphertext does not open', async () => {
    const { vault } = await setup();
    const doc = await sealPrivateNote({ vault }, note);
    const enc = { ...(doc.enc as Record<string, unknown>) };
    const ct = String(enc.ct ?? enc.c ?? '');
    const key = 'ct' in enc ? 'ct' : 'c';
    enc[key] = ct.slice(0, -4) + (ct.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    await expect(openPrivateNote({ vault }, 'n1', { ...doc, enc })).rejects.toThrow();
  });

  it('parseAnchor makes an untrusted anchor safe', () => {
    expect(parseAnchor({ kind: 'evil', id: 1 })).toEqual({ kind: 'none' });
    expect(parseAnchor({ kind: 'day', id: 'a:0', text: 'Upper A', x: 1 })).toEqual({
      kind: 'day',
      id: 'a:0',
      text: 'Upper A',
    });
    expect(parseAnchor(null)).toEqual({ kind: 'none' });
  });
});

describe('sealed notes port (private <-> shared moves are one batch)', () => {
  async function build() {
    const { vault, rings } = await setup();
    const store = createMemoryNotesDocStore();
    const port = createSealedNotesPort({
      store,
      vault,
      ringFor: () => rings.trainer,
      uid: 'trainer-uid',
      now: () => AT,
    });
    return { vault, rings, store, port };
  }
  const snapshot = (port: ReturnType<typeof createSealedNotesPort>) =>
    new Promise<Note[]>((res) => {
      const off = port.subscribe(
        'c1',
        (n) => (off(), res(n)),
        () => undefined,
      );
    });

  it('add private -> sits in clientNotes, sealed; the port reads it back', async () => {
    const { store, port } = await build();
    const n = await port.add({
      clientId: 'c1',
      text: 'private words',
      vis: 'private',
      anchor: { kind: 'none' },
    });
    const raw = store.raw();
    expect(raw.clientNotes).toHaveLength(1);
    expect(raw.notes).toHaveLength(0);
    expect(JSON.stringify(raw)).not.toContain('private words');
    const list = await snapshot(port);
    expect(list.map((x) => x.id)).toEqual([n.id]);
    expect(list[0].text).toBe('private words');
  });

  it('share moves the note to the conversation collection in one write; make private moves it back', async () => {
    const { store, port } = await build();
    const n = await port.add({
      clientId: 'c1',
      text: 'to share',
      vis: 'private',
      anchor: { kind: 'none' },
    });
    await snapshot(port); // fills the cache
    const spy = vi.spyOn(store, 'write');
    await port.setVis('c1', n.id, 'shared');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toHaveLength(2);
    expect(store.raw().clientNotes).toHaveLength(0);
    expect(store.raw().notes).toHaveLength(1);
    expect(JSON.stringify(store.raw())).not.toContain('to share');
    await port.setVis('c1', n.id, 'private');
    expect(store.raw().clientNotes).toHaveLength(1);
    expect(store.raw().notes).toHaveLength(0);
  });

  it('a locked vault: add throws and nothing is written', async () => {
    const vault = await unsetVault();
    const store = createMemoryNotesDocStore();
    const write = vi.spyOn(store, 'write');
    const port = createSealedNotesPort({ store, vault, ringFor: () => null, uid: 'u' });
    await expect(
      port.add({ clientId: 'c1', text: 'x', vis: 'private', anchor: { kind: 'none' } }),
    ).rejects.toThrow();
    expect(write).not.toHaveBeenCalled();
  });

  it('without a conversation key a shared note cannot be written', async () => {
    const { vault } = await setup();
    const store = createMemoryNotesDocStore();
    const port = createSealedNotesPort({ store, vault, ringFor: () => null, uid: 'u' });
    await expect(
      port.add({ clientId: 'c1', text: 'x', vis: 'shared', anchor: { kind: 'none' } }),
    ).rejects.toThrow(/chat-key-missing/);
  });

  it('a document that does not open is dropped from the list, never shown', async () => {
    const { store, port } = await build();
    await port.add({ clientId: 'c1', text: 'good', vis: 'private', anchor: { kind: 'none' } });
    await store.write([
      {
        coll: 'clientNotes',
        id: 'bad',
        set: { id: 'bad', clientId: 'c1', at: 1, updatedAt: 1, enc: { v: 1, iv: 'x', ct: 'y' } },
      },
    ]);
    const list = await snapshot(port);
    expect(list.map((x) => x.text)).toEqual(['good']);
  });

  it('delete removes the document', async () => {
    const { store, port } = await build();
    const n = await port.add({
      clientId: 'c1',
      text: 'bye',
      vis: 'private',
      anchor: { kind: 'none' },
    });
    await snapshot(port);
    await port.remove('c1', n.id);
    expect(store.raw().clientNotes).toHaveLength(0);
  });
});

describe('notes store', () => {
  const flush = () => new Promise((r) => setTimeout(r, 5));
  it('lists newest first, adds, edits, and changes visibility', async () => {
    const port = createFixturesNotesPort();
    const s = createNotesStore(port);
    s.retain('c1');
    await flush();
    expect(s.getState().byClient.c1.status).toBe('ready');
    expect(s.getState().byClient.c1.notes.map((n) => n.id)).toEqual(['n1', 'n2', 'n3', 'n4', 'n5']);
    const added = await s.add({
      clientId: 'c1',
      text: ' fresh ',
      vis: 'private',
      anchor: { kind: 'none' },
    });
    expect(added?.text).toBe('fresh');
    expect(s.getState().byClient.c1.notes[0].id).toBe(added?.id);
    expect(await s.edit('c1', 'n2', 'changed')).toBe(true);
    expect(await s.setVis('c1', 'n2', 'shared')).toBe(true);
    expect(s.getState().byClient.c1.notes.find((n) => n.id === 'n2')).toMatchObject({
      text: 'changed',
      vis: 'shared',
    });
    expect(
      await s.add({ clientId: 'c1', text: '   ', vis: 'private', anchor: { kind: 'none' } }),
    ).toBeNull();
    s.release('c1');
  });

  it('delete hides at once, writes only after the window, and Undo brings it back', async () => {
    vi.useFakeTimers();
    try {
      const port = createFixturesNotesPort();
      const rm = vi.spyOn(port, 'remove');
      const s = createNotesStore(port, 8000);
      s.retain('c1');
      await vi.advanceTimersByTimeAsync(5);
      const n5 = s.getState().byClient.c1.notes.find((n) => n.id === 'n5')!;
      s.remove(n5);
      expect(s.getState().byClient.c1.notes.some((n) => n.id === 'n5')).toBe(false);
      expect(s.getState().pending?.note.id).toBe('n5');
      await vi.advanceTimersByTimeAsync(7000);
      s.undo();
      expect(s.getState().byClient.c1.notes.some((n) => n.id === 'n5')).toBe(true);
      expect(s.getState().pending).toBeNull();
      await vi.advanceTimersByTimeAsync(9000);
      expect(rm).not.toHaveBeenCalled();
      s.remove(n5);
      await vi.advanceTimersByTimeAsync(8100);
      expect(rm).toHaveBeenCalledWith('c1', 'n5');
      expect(s.getState().pending).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('leaving the screen closes the window now', async () => {
    const port = createFixturesNotesPort();
    const rm = vi.spyOn(port, 'remove');
    const s = createNotesStore(port);
    s.retain('c1');
    await flush();
    s.remove(s.getState().byClient.c1.notes[0]);
    s.release('c1');
    await flush();
    expect(rm).toHaveBeenCalled();
  });

  it('a failed write is a state, not a crash', async () => {
    const port = createFixturesNotesPort({ failWith: () => true });
    const s = createNotesStore(port);
    expect(
      await s.add({ clientId: 'c1', text: 'x', vis: 'private', anchor: { kind: 'none' } }),
    ).toBeNull();
    expect(s.getState().failed).toBe('add');
    s.clearFailed();
    expect(s.getState().failed).toBeNull();
  });

  it('the seed has two shared notes: what the client app shows', () => {
    expect(seedNotes().filter((n) => n.vis === 'shared')).toHaveLength(2);
  });
});
