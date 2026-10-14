import { describe, expect, it } from 'vitest';
import { sealEnvelope } from '../../coachCrypto/envelope';
import { C, T, makeWorld } from '../data/firestore/testWorld';
import { olehDraft } from './__fixtures__/fixtures';
import {
  emptyOverlay,
  openPlan,
  openVersion,
  overlayOf,
  planProgramId,
  sealPlan,
  sealVersion,
} from './planCodec';

async function ctx() {
  const w = await makeWorld();
  await w.publishKey();
  w.trainerBook.start();
  await w.trainerBook.ready();
  for (let i = 0; i < 50 && !w.trainerBook.ringFor(C); i++)
    await new Promise((r) => setTimeout(r, 0));
  return { src: { vault: w.tv, ring: w.trainerBook.ringFor(C)! } };
}

const planOf = (rev = 1) => ({
  clientId: C,
  trainerId: T,
  programId: planProgramId(C),
  liveVersion: 0,
  rev,
  updatedAt: 1_800_000_000_000,
  ...overlayOf(olehDraft(T), ['Tue']),
});

describe('plan codec', () => {
  it('round-trips a plan and keeps the open side to the registered fields', async () => {
    const { src } = await ctx();
    const raw = await sealPlan(src, planOf());
    expect(Object.keys(raw).sort()).toEqual(
      ['clientId', 'enc', 'keyEpoch', 'programId', 'rev', 'trainerId', 'updatedAt'].sort(),
    );
    const back = await openPlan(src, C, raw);
    expect(back.trainerDays).toEqual(['Tue']);
    expect(Object.keys(back.targets).length).toBeGreaterThan(0);
  });

  it('still opens after the publish function changed liveVersion, rev and updatedAt (they are not in the AAD)', async () => {
    const { src } = await ctx();
    const raw = await sealPlan(src, planOf());
    const flipped = { ...raw, liveVersion: 3, rev: 9, updatedAt: 1_800_000_999_000 };
    const back = await openPlan(src, C, flipped);
    expect(back.liveVersion).toBe(3);
    expect(back.rev).toBe(9);
  });

  it('a plan presented for another client, author or with another ciphertext does not open', async () => {
    const { src } = await ctx();
    const raw = await sealPlan(src, planOf());
    await expect(openPlan(src, 'client-2', { ...raw, clientId: 'client-2' })).rejects.toThrow();
    await expect(openPlan(src, C, { ...raw, trainerId: 'someone-else' })).rejects.toThrow();
    const other = await sealPlan(src, { ...planOf(), ...emptyOverlay() });
    await expect(
      openPlan(src, C, {
        ...raw,
        enc: { ...(raw.enc as object), ct: (other.enc as { ct: string }).ct },
      }),
    ).rejects.toThrow();
  });

  it('a version keeps opening after its state flips; it does not open under another number or class', async () => {
    const { src } = await ctx();
    const v = {
      n: 2,
      programId: planProgramId(C),
      state: 'draft' as const,
      createdAt: 1_800_000_000_000,
      publishedAt: null,
      reason: '',
      summary: 'Adds paused bench',
      diff: [],
      program: olehDraft(T),
      trainerDays: ['Tue' as const],
    };
    const raw = await sealVersion(src, C, T, v);
    expect(Object.keys(raw).sort()).toEqual(
      ['createdAt', 'enc', 'keyEpoch', 'n', 'programId', 'state'].sort(),
    );
    const live = await openVersion(src, C, T, {
      ...raw,
      state: 'live',
      publishedAt: 1_800_000_500_000,
    });
    expect(live.summary).toBe('Adds paused bench');
    expect(live.state).toBe('live');
    expect(live.program.items.length).toBe(v.program.items.length);
    await expect(openVersion(src, C, T, { ...raw, n: 3 })).rejects.toThrow();
    await expect(openVersion(src, C, 'someone-else', raw)).rejects.toThrow();
    // a plan envelope is not a version (document class is in the AAD)
    const plan = await sealPlan(src, planOf());
    await expect(openVersion(src, C, T, { ...raw, enc: plan.enc })).rejects.toThrow();
  });

  it('the chat cap still applies to ordinary documents; only plan documents get the larger cap', async () => {
    const { src } = await ctx();
    const key = await src.ring.key('plan');
    const big = { text: 'x'.repeat(9000) };
    const c = {
      cid: src.ring.cid,
      epoch: src.ring.epoch,
      messageId: 'm',
      fromUid: T,
      at: 1,
      kind: 'message',
    };
    await expect(sealEnvelope(key, c, big)).rejects.toThrow('too-large');
    await expect(sealEnvelope(key, c, big, 180_000)).resolves.toBeTruthy();
  });
});
