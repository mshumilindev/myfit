// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { OPEN_FIELDS, isSealed, sealDoc, unsealDoc } from './encryptedDoc';
import { readyVault } from './testVault';

describe('sealed documents', () => {
  it('keeps only open fields readable and leaks nothing else', async () => {
    const v = await readyVault();
    const { key, salt } = v.material();
    const w = {
      id: 'w1',
      startedAt: 1000,
      finishedAt: null,
      updatedAt: 2000,
      gymId: 'g1',
      dayName: 'Push day',
      exercises: [{ name: 'Barbell Squat', sets: [{ reps: 5, weight: 140 }] }],
    };
    const s = await sealDoc('workouts', w, key, salt);
    expect(isSealed(s)).toBe(true);
    expect(s.startedAt).toBe(1000);
    expect(s.finishedAt).toBeNull();
    const text = JSON.stringify(s);
    for (const secret of ['Barbell Squat', 'Push day', 'g1', '140'])
      expect(text).not.toContain(secret);
    expect(await unsealDoc(s, key)).toEqual(w);
  });

  it('drops undefined fields (Firestore rejects them)', async () => {
    const v = await readyVault();
    const { key, salt } = v.material();
    const s = await sealDoc(
      'gyms',
      { id: 'g', updatedAt: 1, name: 'Home', city: undefined },
      key,
      salt,
    );
    expect(await unsealDoc(s, key)).toEqual({ id: 'g', updatedAt: 1, name: 'Home' });
  });

  it('legacy documents pass through, even while locked', async () => {
    const legacy = { id: 'g', name: 'Home', updatedAt: 1 };
    expect(await unsealDoc(legacy, null)).toEqual(legacy);
  });

  it('a sealed document cannot be read while locked', async () => {
    const v = await readyVault();
    const { key, salt } = v.material();
    const s = await sealDoc('gyms', { id: 'g', updatedAt: 1, name: 'Home' }, key, salt);
    await expect(unsealDoc(s, null)).rejects.toThrow('vault-locked');
  });

  it('open-field lists never include obviously private fields', () => {
    const banned = [
      'name',
      'note',
      'notes',
      'weight',
      'exercises',
      'kind',
      'gymId',
      'dayName',
      'mood',
    ];
    for (const [c, fields] of Object.entries(OPEN_FIELDS))
      for (const f of fields)
        if (!(c === 'sleeps' && f === 'kind')) expect(banned).not.toContain(f);
  });
});

describe('conditions collections expose only their open fields', () => {
  it('lists exactly the open fields', () => {
    expect([...OPEN_FIELDS.coachShare]).toEqual(['updatedAt']);
    expect([...OPEN_FIELDS.conditionPrefs]).toEqual(['updatedAt']);
    expect([...OPEN_FIELDS.conditions]).toEqual(['id', 'updatedAt']);
  });

  it.each([
    [
      'coachShare',
      {
        view: { full: [{ key: 'asthma', severity: 2, effects: [] }], effects: [] },
        updatedAt: 9,
      },
    ],
    ['conditionPrefs', { conditionsShare: 'full', updatedAt: 9 }],
    [
      'conditions',
      {
        id: 'c1',
        key: 'asthma',
        severity: 3,
        share: 'full',
        note: 'secret note',
        createdAt: 4,
        updatedAt: 9,
      },
    ],
  ] as const)('%s: only listed open fields are readable, round-trips', async (name, doc) => {
    const v = await readyVault();
    const { key, salt } = v.material();
    const s = await sealDoc(name, { ...doc }, key, salt);
    expect(isSealed(s)).toBe(true);
    const open = new Set<string>(OPEN_FIELDS[name]);
    const { enc, ...plain } = s as Record<string, unknown>;
    expect(enc).toBeDefined();
    for (const k of Object.keys(plain)) expect(open.has(k)).toBe(true);
    const text = JSON.stringify(plain);
    for (const secret of ['asthma', 'secret note', 'full', 'severity'])
      expect(text).not.toContain(secret);
    expect(JSON.stringify(s)).not.toContain('secret note');
    expect(await unsealDoc(s, key)).toEqual(doc);
  });
});
