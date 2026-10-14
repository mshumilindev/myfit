// @vitest-environment node
/**
 * One sealed document per client must hold a long schedule (the old 8000-byte chat cap made `too-large` the end of a
 * busy trainer's calendar), still obeys its own cap, and keeps opening after a key rotation.
 */
import { describe, expect, it } from 'vitest';
import { SCHEDULE_MAX_BYTES } from '../../coachCrypto/newCollections';
import { newConversationKeyBytes, ringFromBytes } from '../../coachCrypto/conversationKey';
import { CID, pairedRings, trainer } from '../../coachCrypto/testHelpers';
import { readyVault } from '../../testVault';
import { createMemoryDocStore } from './memoryDocStore';
import { createSealedSchedulePort } from './sealedPort';
import { SchedulePortError } from './port';
import { emptyDoc, type OneOffDoc, type ScheduleDoc } from './types';

const DAY = 86_400_000;
const oneOffs = (n: number, from = 20_000): OneOffDoc[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `oo-${i.toString().padStart(5, '0')}`,
    day: from + i,
    start: '18:00',
    dur: 60,
    gymId: 'iron-yard',
    note: 'Heavy day, check the left knee',
  }));
const docWith = (n: number): ScheduleDoc => ({ ...emptyDoc('c1'), oneOffs: oneOffs(n) });

async function setup() {
  const vault = await readyVault();
  const t = await trainer();
  const rings = await pairedRings(t);
  const store = createMemoryDocStore();
  const port = createSealedSchedulePort({
    store,
    vault,
    ringFor: () => rings.trainer,
    uid: 't1',
    now: () => 1_800_000_000_000,
  });
  return { vault, t, rings, store, port };
}

describe('large schedules', () => {
  it('a schedule well over the chat cap (8000 bytes) seals, stays inside the rules cap and round-trips', async () => {
    const { port, store } = await setup();
    const big = docWith(300); // about 35 KB of JSON
    expect(JSON.stringify(big).length).toBeGreaterThan(8000);
    const saved = await port.saveDoc(big);
    expect(saved.rev).toBe(1);
    const raw = store.raw().schedules[0] as { enc: { ct: string } };
    // what the rules accept (sealedCkSchedule): ct below 165000 chars
    expect(raw.enc.ct.length).toBeLessThan(165_000);
    expect(store.dumpText()).not.toContain('left knee');
    let got: ScheduleDoc | undefined;
    const off = port.subscribe(
      (d) => (got = d.docs[0]),
      () => undefined,
    );
    await new Promise((r) => setTimeout(r, 20));
    off();
    expect(got?.oneOffs).toHaveLength(300);
  });

  it('the schedule cap holds: more than SCHEDULE_MAX_BYTES is refused before anything is written', async () => {
    const { port, store } = await setup();
    const n = Math.ceil(SCHEDULE_MAX_BYTES / 60) + 100; // far beyond the cap
    await expect(port.saveDoc(docWith(n))).rejects.toThrow('too-large');
    expect(store.raw().schedules).toHaveLength(0);
  });

  it('a schedule sealed before a key rotation opens through the ring of its epoch, and is dropped without it', async () => {
    const { vault, t, rings, store } = await setup();
    const sealer = createSealedSchedulePort({
      store,
      vault,
      ringFor: () => rings.trainer,
      uid: 't1',
      now: () => 1_800_000_000_000,
    });
    await sealer.saveDoc({ ...emptyDoc('c1'), oneOffs: oneOffs(3) });
    // epoch 2: the trainer now holds a different current ring
    const next = await ringFromBytes(CID, 2, newConversationKeyBytes());
    const read = (ringForEpoch?: (c: string, e: number) => typeof next | null) =>
      new Promise<ScheduleDoc[]>((res) => {
        const p = createSealedSchedulePort({
          store,
          vault,
          ringFor: () => next,
          ringForEpoch,
          uid: 't1',
          now: () => 1_800_000_000_000,
        });
        const off = p.subscribe(
          (d) => {
            off();
            res(d.docs);
          },
          () => res([]),
        );
      });
    expect(await read()).toHaveLength(0); // no past ring: never shown, never partial
    const docs = await read((_c, e) => (e === 1 ? rings.trainer : null));
    expect(docs).toHaveLength(1);
    expect(docs[0].oneOffs).toHaveLength(3);
    // a write goes out under the CURRENT epoch
    const writer = createSealedSchedulePort({
      store,
      vault,
      ringFor: () => next,
      uid: 't1',
      now: () => 1_800_000_000_000 + DAY,
    });
    await writer.saveDoc({ ...docs[0] });
    expect((store.raw().schedules[0] as { keyEpoch: number }).keyEpoch).toBe(2);
    void t;
  });

  it('a conflict is still a conflict for a large document', async () => {
    const { port } = await setup();
    await port.saveDoc(docWith(100));
    await expect(port.saveDoc(docWith(100))).rejects.toBeInstanceOf(SchedulePortError);
  });
});
