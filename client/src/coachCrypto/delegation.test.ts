// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PURPOSES, newConversationKeyBytes, ringFromBytes } from './conversationKey';
import { createDelegation, isDelegation, openDelegation } from './delegation';
import { openEnvelope, sealEnvelope } from './envelope';
import { CID, CID2, trainer } from './testHelpers';

const ctx = (over = {}) => ({
  cid: CID,
  epoch: 1,
  messageId: 's1',
  fromUid: 'u-client',
  at: 1_700_000_000_000,
  kind: 'schedule',
  ...over,
});

async function setup() {
  const manager = await trainer(); // a manager has the same kind of key record as a trainer
  const raw = newConversationKeyBytes();
  const d = await createDelegation(raw, CID, 1, manager.rec.pub, 1_700_000_000_000);
  const client = await ringFromBytes(CID, 1, raw.slice());
  return { manager, raw, d, client };
}

describe('key delegation to a manager', () => {
  it('the manager reads what the client sealed for schedule and requests, and can write back', async () => {
    const { manager, d, client } = await setup();
    const ring = await openDelegation(d, CID, manager.rec, manager.key);
    for (const p of ['schedule', 'requests'] as const) {
      const env = await sealEnvelope(await client.key(p), ctx(), { p });
      expect(await openEnvelope(await ring.key(p), ctx(), env)).toEqual({ p });
      const back = await sealEnvelope(await ring.key(p), ctx({ fromUid: 'u-m' }), { ok: 1 });
      expect(await openEnvelope(await client.key(p), ctx({ fromUid: 'u-m' }), back)).toEqual({
        ok: 1,
      });
    }
  });

  it('the manager gets NO other purpose: chat, notes, plan and live stay closed', async () => {
    const { manager, d, client } = await setup();
    const ring = await openDelegation(d, CID, manager.rec, manager.key);
    for (const p of PURPOSES.filter((x) => x !== 'schedule' && x !== 'requests')) {
      await expect(ring.key(p)).rejects.toThrow('not-delegated');
      // and the schedule key cannot open a chat envelope
      const env = await sealEnvelope(await client.key(p), ctx(), { secret: 1 });
      await expect(openEnvelope(await ring.key('schedule'), ctx(), env)).rejects.toThrow();
    }
    expect(JSON.stringify(d)).not.toContain('"chat"');
  });

  it('refuses a wrap made for another manager key, another conversation, epoch or purpose', async () => {
    const { manager, d } = await setup();
    const other = await trainer();
    await expect(openDelegation(d, CID, other.rec, other.key)).rejects.toThrow(
      'fingerprint-mismatch',
    );
    await expect(openDelegation(d, CID2, manager.rec, manager.key)).rejects.toThrow();
    await expect(
      openDelegation({ ...d, epoch: 2 }, CID, manager.rec, manager.key),
    ).rejects.toThrow();
    await expect(
      openDelegation(
        { ...d, schedule: d.requests, requests: d.schedule },
        CID,
        manager.rec,
        manager.key,
      ),
    ).rejects.toThrow();
  });

  it('refuses a tampered wrap and a malformed document', async () => {
    const { manager, d } = await setup();
    const bad = {
      ...d,
      schedule: { ...d.schedule, ct: d.schedule.ct.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')) },
    };
    await expect(openDelegation(bad, CID, manager.rec, manager.key)).rejects.toThrow();
    expect(isDelegation(d)).toBe(true);
    expect(isDelegation({ ...d, requests: null })).toBe(false);
    expect(isDelegation(null)).toBe(false);
    await expect(openDelegation({} as never, CID, manager.rec, manager.key)).rejects.toThrow(
      'bad-delegation',
    );
  });

  it('a delegation of one epoch gives nothing for another (rotation locks a removed manager out)', async () => {
    const manager = await trainer();
    const raw1 = newConversationKeyBytes();
    const d1 = await createDelegation(raw1, CID, 1, manager.rec.pub, 1);
    const raw2 = newConversationKeyBytes();
    const client2 = await ringFromBytes(CID, 2, raw2.slice());
    const ring1 = await openDelegation(d1, CID, manager.rec, manager.key);
    const env = await sealEnvelope(await client2.key('schedule'), ctx({ epoch: 2 }), { x: 1 });
    await expect(
      openEnvelope(await ring1.key('schedule'), ctx({ epoch: 2 }), env),
    ).rejects.toThrow();
  });

  it("does not zero or keep the caller's CK, and never exposes the root", async () => {
    const { raw, d } = await setup();
    expect(raw.some((b) => b !== 0)).toBe(true);
    expect(Object.keys(d).sort()).toEqual(['at', 'epoch', 'fp', 'requests', 'schedule']);
  });
});
