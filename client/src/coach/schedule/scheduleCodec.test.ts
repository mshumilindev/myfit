// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CID2, pairedRings, trainer } from '../../coachCrypto/testHelpers';
import { readyVault, unsetVault } from '../../testVault';
import { createSealedSchedulePort } from './sealedPort';
import { createMemoryDocStore } from './memoryDocStore';
import { SchedulePortError } from './port';
import { openRequest, openSchedule, sealRequest, sealSchedule, withStatus } from './scheduleCodec';
import { scheduleSeed } from './__fixtures__/fixtures';
import type { RescheduleRequest, ScheduleDoc } from './types';

const AT = 1_791_364_800_123;
const req: RescheduleRequest = {
  id: 'rq1',
  clientId: 'c1',
  from: 'client',
  slotKey: 'sk_0123456789abcdef',
  fromStart: AT + 86_400_000,
  toStart: AT + 3 * 86_400_000,
  note: 'Work trip, back on Saturday.',
  status: 'pending',
  createdAt: AT,
  expiresAt: AT + 72 * 3_600_000,
  scope: 'one',
  groupKey: 'gk',
};
const doc: ScheduleDoc = {
  clientId: 'c1',
  rev: 3,
  patterns: [
    {
      id: 'p',
      fromDay: 20000,
      weeks: 4,
      rows: [{ id: 'r', dow: 4, start: '18:00', dur: 60, gymId: 'iron-yard', dayLabel: 'Upper B' }],
    },
  ],
  oneOffs: [
    {
      id: 'o',
      day: 20003,
      start: '17:00',
      dur: 45,
      gymId: 'iron-yard',
      note: 'Technique check, squat',
    },
  ],
  exceptions: [{ slotKey: 'r:20004', status: 'missed' }],
  cancelled: ['r:20011'],
};

async function setup() {
  const vault = await readyVault();
  const rings = await pairedRings(await trainer());
  return { vault, rings };
}

describe('request codec (Part C: requester seals, the other side changes only the open status)', () => {
  it('round-trips between the two parties and stores no plaintext', async () => {
    const { vault, rings } = await setup();
    const raw = await sealRequest({ vault, ring: rings.client }, req);
    const text = JSON.stringify(raw);
    expect(text).not.toContain('Work trip');
    expect(Object.keys(raw).sort()).toEqual([
      'createdAt',
      'enc',
      'expiresAt',
      'from',
      'id',
      'keyEpoch',
      'slotKey',
      'status',
    ]);
    const opened = await openRequest({ vault, ring: rings.trainer }, 'rq1', raw);
    expect(opened).toEqual({ ...req, createdAt: Math.floor(AT / 1000) * 1000 });
  });
  it('the other party can move only the status and the request still opens', async () => {
    const { vault, rings } = await setup();
    const raw = await sealRequest({ vault, ring: rings.client }, req);
    const patched = withStatus(raw, 'accepted', AT + 5000);
    const opened = await openRequest({ vault, ring: rings.trainer }, 'rq1', patched);
    expect(opened).toMatchObject({ status: 'accepted', decidedAt: AT + 5000, note: req.note });
  });
  it('refuses a ciphertext moved to another id, requester or time, or copied to another conversation', async () => {
    const { vault, rings } = await setup();
    const other = await pairedRings(await trainer(), CID2);
    const raw = await sealRequest({ vault, ring: rings.client }, req);
    await expect(
      openRequest({ vault, ring: rings.trainer }, 'rq2', { ...raw, id: 'rq2' }),
    ).rejects.toThrow();
    await expect(
      openRequest({ vault, ring: rings.trainer }, 'rq1', { ...raw, from: 'trainer' }),
    ).rejects.toThrow();
    await expect(
      openRequest({ vault, ring: rings.trainer }, 'rq1', {
        ...raw,
        createdAt: (raw.createdAt as number) + 1000,
      }),
    ).rejects.toThrow();
    await expect(openRequest({ vault, ring: other.trainer }, 'rq1', raw)).rejects.toThrow();
  });
  it('throws vault-locked instead of writing plaintext', async () => {
    const { rings } = await setup();
    const locked = await unsetVault();
    await expect(sealRequest({ vault: locked, ring: rings.client }, req)).rejects.toThrow(
      /vault-locked/,
    );
  });
});

describe('schedule codec', () => {
  it('round-trips; times, notes and day labels are not in the stored document', async () => {
    const { vault, rings } = await setup();
    const raw = await sealSchedule({ vault, ring: rings.trainer }, doc, 'trainer-uid', AT);
    const text = JSON.stringify(raw);
    for (const s of ['Technique', 'Upper B', '18:00', 'iron-yard']) expect(text).not.toContain(s);
    expect(Object.keys(raw).sort()).toEqual([
      'clientId',
      'enc',
      'keyEpoch',
      'rev',
      'trainerId',
      'updatedAt',
    ]);
    expect(await openSchedule({ vault, ring: rings.client }, 'c1', raw)).toEqual(doc);
  });
  it('refuses a document copied to another client id or with a changed rev', async () => {
    const { vault, rings } = await setup();
    const raw = await sealSchedule({ vault, ring: rings.trainer }, doc, 'trainer-uid', AT);
    await expect(
      openSchedule({ vault, ring: rings.client }, 'c2', { ...raw, clientId: 'c2' }),
    ).rejects.toThrow();
    // the open rev is not in the AAD (it is the concurrency counter), but time and author are
    await expect(
      openSchedule({ vault, ring: rings.client }, 'c1', { ...raw, trainerId: 'someone' }),
    ).rejects.toThrow();
    await expect(
      openSchedule({ vault, ring: rings.client }, 'c1', {
        ...raw,
        updatedAt: (raw.updatedAt as number) + 1000,
      }),
    ).rejects.toThrow();
  });
});

describe('sealed port over a raw document store', () => {
  it('writes only sealed documents, reads them back, and a lost race is a conflict', async () => {
    const { vault, rings } = await setup();
    const store = createMemoryDocStore();
    const port = createSealedSchedulePort({
      store,
      vault,
      ringFor: () => rings.trainer,
      uid: 'trainer-uid',
      now: () => AT,
    });
    let seen = null as null | { docs: ScheduleDoc[]; requests: RescheduleRequest[] };
    const off = port.subscribe(
      (d) => (seen = d),
      () => undefined,
    );
    const saved = await port.saveDoc({ ...doc, rev: 0 });
    expect(saved.rev).toBe(1);
    await port.createRequest(req);
    await new Promise((r) => setTimeout(r, 20));
    expect(store.dumpText()).not.toContain('Technique');
    expect(store.dumpText()).not.toContain('Work trip');
    expect(seen!.docs[0].oneOffs[0].note).toBe('Technique check, squat');
    expect(seen!.requests[0].note).toBe('Work trip, back on Saturday.');
    await port.setStatus(req, 'accepted', AT + 1000);
    await new Promise((r) => setTimeout(r, 20));
    expect(seen!.requests[0].status).toBe('accepted');
    await expect(port.saveDoc({ ...doc, rev: 0 })).rejects.toBeInstanceOf(SchedulePortError);
    off();
  });
  it('never calls the store when the vault is locked or the key is missing', async () => {
    const { vault, rings } = await setup();
    const store = createMemoryDocStore();
    const locked = createSealedSchedulePort({
      store,
      vault: await unsetVault(),
      ringFor: () => rings.trainer,
      uid: 'u',
    });
    await expect(locked.saveDoc({ ...doc, rev: 0 })).rejects.toThrow(/vault-locked/);
    const noRing = createSealedSchedulePort({ store, vault, ringFor: () => null, uid: 'u' });
    await expect(noRing.createRequest(req)).rejects.toBeInstanceOf(SchedulePortError);
    expect(store.dumpText()).toBe('{"schedules":[],"requests":[]}');
  });
  it('the seed fixtures fit the document limits', () => {
    const s = scheduleSeed();
    for (const d of s.docs)
      expect(d.patterns.reduce((n, p) => n + p.rows.length, 0)).toBeLessThanOrEqual(8);
  });
});
