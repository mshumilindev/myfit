import { describe, expect, it } from 'vitest';
import { sealDoc } from '../../../encryptedDoc';
import { ALL_OFF } from '../../domain/consent';
import { createMemoryFs } from './memoryFs';
import { readyVault } from '../../../testVault';
import { createFirestoreWorldPort } from './worldPort';
import { C, NOW } from './parity/harness';
import { linkUp } from './parity/flow';

const ac = () => ({ signal: new AbortController().signal });
const DAY = 86_400_000;

const workout = (id: string, startedAt: number, weight: number) => ({
  id,
  startedAt,
  finishedAt: startedAt + 3_600_000,
  autoFinished: false,
  gymId: null,
  dayName: 'PrivateDayLabel',
  exercises: [
    {
      id: `e-${id}`,
      name: 'Barbell Squat',
      kind: 'strength',
      position: 0,
      sets: [{ id: `s-${id}`, reps: 5, weight, isWarmup: false, type: 'working' }],
    },
  ],
});

describe('sets shared at "effects": the trainer sees the weekly view only', () => {
  it('the member publishes a sealed weekly view; the trainer world holds lifts, never sessions or day names', async () => {
    const w = await linkUp({ totals: 'full', sets: 'effects' });
    const workouts = [14, 21, 28, 35].map((d, i) => workout(`w${i}`, NOW - d * DAY, 100 + i * 5));
    await w.cl.publisher.sync({
      consent: { ...ALL_OFF, totals: 'full', sets: 'effects' },
      workouts: workouts as never,
    });
    const dump = w.s.fs.dump();
    expect(dump).not.toContain('Barbell Squat');
    expect(dump).not.toContain('PrivateDayLabel');
    const data = await w.tr.world.load(ac());
    const input = data.inputs.find((i) => i.clientId === C)!;
    expect(input.lifts?.map((l) => l.name)).toEqual(['Barbell Squat']);
    // effects gives aggregates: no per-session history of the member reaches the trainer
    expect(data.history?.[C]).toBeUndefined();
    expect(JSON.stringify(data)).not.toContain('PrivateDayLabel');
  });
});

describe('a sealed category the trainer cannot open', () => {
  it('without the member grant on this device the docs are skipped and the client is still listed', async () => {
    const fs = createMemoryFs(NOW);
    const roster = {
      clients: [
        {
          clientId: 'c1',
          name: 'Oleh',
          status: 'active',
          mode: 'app',
          consent: { ...ALL_OFF, sets: 'effects' },
          consentVersion: 1,
          keyEpoch: 1,
          cid: 'cid',
        },
      ],
      invites: [],
      serverTime: NOW,
    };
    fs.onCall('coachClients', () => roster);
    fs.onCall('coachRead', () => ({
      grant: null,
      results: {
        sets: {
          state: 'ok',
          level: 'effects',
          asOf: NOW,
          docs: [{ enc: { v: 1, iv: 'AA', ct: 'AA' } }],
        },
      },
    }));
    const port = createFirestoreWorldPort({
      fs,
      vault: await readyVault(),
      trainer: { id: 't', name: 'T' },
      loadOwnCoachKey: async () => null,
    });
    const data = await port.load(ac());
    expect(data.clients.map((c) => c.id)).toEqual(['c1']);
    expect(data.inputs.find((i) => i.clientId === 'c1')?.lifts ?? []).toEqual([]);
    expect(port.now?.()).toBe(NOW);
  });
});

describe('injuries reach the trainer only at "full"', () => {
  const injury = {
    id: 'i1',
    reason: 'injury',
    bodyPart: 'knee',
    side: 'right',
    muscles: ['quads'],
    stage: 'rebuild',
    startDay: 20_000,
    createdAt: NOW - 30 * DAY,
    updatedAt: NOW - DAY,
    checkins: [],
    note: 'Clicks on the way down',
    healedDay: null,
  };
  const seed = async (w: Awaited<ReturnType<typeof linkUp>>) => {
    const m = w.cl.vault.materialOrNull()!;
    await w.cl.fs.set(
      `users/${C}/injuries/i1`,
      (await sealDoc('injuries', injury as never, m.key, m.salt)) as never,
    );
    expect(w.s.fs.dump()).not.toContain('Clicks on the way down');
  };

  it('at full the trainer device opens the sealed injury', async () => {
    const w = await linkUp({ totals: 'full', sets: 'full', injury: 'full' });
    await seed(w);
    const me = (await w.tr.world.load(ac())).clients.find((c) => c.id === C)!;
    expect(me.injuries?.map((i) => ({ id: i.id, part: i.bodyPart, healed: i.healed }))).toEqual([
      { id: 'i1', part: 'knee', healed: false },
    ]);
  });

  it('at effects the trainer gets no injury list even though the member has one', async () => {
    const w = await linkUp({ totals: 'full', sets: 'full', injury: 'effects' });
    await seed(w);
    const data = await w.tr.world.load(ac());
    expect(data.clients.find((c) => c.id === C)?.injuries).toBeUndefined();
    expect(JSON.stringify(data)).not.toContain('Clicks on the way down');
  });
});
