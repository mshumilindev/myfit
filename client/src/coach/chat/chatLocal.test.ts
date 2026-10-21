import { describe, expect, it, vi } from 'vitest';
import { readyVault, unsetVault } from '../../testVault';
import { createChatStore } from './chatStore';
import { withLocalCache } from './cachedPort';
import { createDraftStore } from './chatDrafts';
import { createFixturesChatPort } from './__fixtures__/fixtures';
import type { ChatPort } from './port';
import { createSealedLocal, memoryBackend, wipeOnLock } from './sealedLocal';
import type { ChatMessage } from './types';

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

describe('sealed on-device storage', () => {
  it('stores only ciphertext and reads it back with the same vault', async () => {
    const vault = await readyVault();
    const backend = memoryBackend();
    const l = createSealedLocal({ vault, backend });
    expect(await l.set('draft:c1', 'my knee hurts a lot')).toBe(true);
    const raw = JSON.stringify(await backend.get('draft:c1'));
    expect(raw).not.toContain('knee');
    expect(await l.get('draft:c1')).toBe('my knee hurts a lot');
    // another account's vault cannot read it, and the useless row is dropped
    const other = createSealedLocal({ vault: await readyVault(), backend });
    expect(await other.get('draft:c1')).toBeNull();
    expect(await backend.keys()).toEqual([]);
  });

  it('stores nothing while the vault is locked (no plaintext fallback)', async () => {
    const backend = memoryBackend();
    const l = createSealedLocal({ vault: await unsetVault(), backend });
    expect(l.ready()).toBe(false);
    expect(await l.set('draft:c1', 'secret')).toBe(false);
    expect(await backend.keys()).toEqual([]);
    expect(await l.get('draft:c1')).toBeNull();
  });

  it('sweeps entries idle for 30 days, wipes one conversation, wipes all on lock', async () => {
    const vault = await readyVault();
    let t = 1_000_000;
    const backend = memoryBackend();
    const l = createSealedLocal({ vault, backend, now: () => t });
    await l.set('msgs:cidA', [1]);
    await l.set('msgs:cidB', [2]);
    t += 29 * 86_400_000;
    await l.set('draft:cidA', 'x');
    t += 2 * 86_400_000; // msgs are 31 days old, the draft 2
    expect(await l.sweep()).toBe(2);
    expect(await l.keys()).toEqual(['draft:cidA']);
    await l.set('msgs:cidA', [1]);
    await l.set('msgs:cidB', [2]);
    await l.wipeCid('cidA');
    expect((await l.keys()).sort()).toEqual(['msgs:cidB']);
    const off = wipeOnLock(vault, l);
    await vault.lock();
    await tick();
    expect(await backend.keys()).toEqual([]);
    off();
  });
});

describe('sealed outbox', () => {
  it('survives a reload and is sent once the vault has a key', async () => {
    const vault = await readyVault();
    const backend = memoryBackend();
    const local = createSealedLocal({ vault, backend });
    const down = createFixturesChatPort();
    let fail = true;
    const flaky: ChatPort = {
      ...down,
      send: (cid, d) => (fail ? Promise.reject(new Error('offline')) : down.send(cid, d)),
    };
    const s1 = createChatStore(flaky);
    s1.attachLocal(local);
    const id = s1.send('cid-c1', 'will do tonight');
    await tick(5);
    expect(s1.getState().outbox['cid-c1']?.[0].state).toBe('failed');
    expect(JSON.stringify(await backend.get('outbox:cid-c1'))).not.toContain('tonight');
    // the page is closed and reopened; the network is back
    fail = false;
    const s2 = createChatStore(flaky);
    s2.attachLocal(local);
    // the resend is async (vault unseal -> send -> ack): wait for it instead of a fixed number of ticks (flaky on a loaded CI core)
    await vi.waitFor(() => expect(down.dump('cid-c1').some((m) => m.id === id)).toBe(true), {
      timeout: 5000,
    });
    await vi.waitFor(() => expect(s2.getState().outbox['cid-c1'] ?? []).toHaveLength(0), {
      timeout: 5000,
    });
    expect(await backend.keys()).toEqual([]);
  });
});

describe('message cache + drafts', () => {
  it('replays cached messages first and then the live ones', async () => {
    const vault = await readyVault();
    const local = createSealedLocal({ vault, backend: memoryBackend() });
    const port = createFixturesChatPort();
    const cached = withLocalCache(port, local);
    const seen: number[] = [];
    const off = cached.subscribeMessages('cid-c3', (m) => seen.push(m.length), vi.fn());
    await tick(500);
    off();
    expect(await local.keys('msgs:')).toEqual(['msgs:cid-c3']);
    // second start: network down - the cache still answers
    const dead: ChatPort = {
      ...port,
      subscribeMessages: () => () => undefined,
    };
    const got: ChatMessage[][] = [];
    withLocalCache(dead, local).subscribeMessages('cid-c3', (m) => got.push(m), vi.fn());
    await tick(20);
    expect(got[0]?.length).toBe(2);
  });

  it('keeps a draft sealed, restores it, and removes it when emptied', async () => {
    const vault = await readyVault();
    const backend = memoryBackend();
    const local = createSealedLocal({ vault, backend });
    const a = createDraftStore();
    a.attach(local);
    a.set('cid-c1', 'half a thought');
    await tick(700);
    expect(JSON.stringify(await backend.get('draft:cid-c1'))).not.toContain('thought');
    const b = createDraftStore();
    b.attach(local);
    await b.load('cid-c1');
    expect(b.get('cid-c1')).toBe('half a thought');
    b.set('cid-c1', '');
    await tick(700);
    expect(await backend.keys()).toEqual([]);
  });
});

describe('paging (fixtures port)', () => {
  it('delivers the newest window and asks for older pages', async () => {
    const port = createFixturesChatPort({ history: { 'cid-c2': 120 } });
    let last: { n: number; more: boolean } = { n: 0, more: false };
    const sub = (limit: number) =>
      port.subscribeMessages(
        'cid-c2',
        (m, meta) => (last = { n: m.length, more: !!meta?.hasMore }),
        vi.fn(),
        { limit },
      );
    let off = sub(50);
    expect(last).toEqual({ n: 50, more: true });
    off();
    off = sub(100);
    expect(last).toEqual({ n: 100, more: true });
    off();
    off = sub(200);
    expect(last.more).toBe(false);
    off();
  });
});
