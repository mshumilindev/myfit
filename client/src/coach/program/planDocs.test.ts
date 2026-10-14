import { describe, expect, it } from 'vitest';
import { NEW_COLLECTIONS } from '../../coachCrypto/newCollections';
import { setRowMode } from './ops';
import { olehDraft } from './__fixtures__/fixtures';
import { splitPlan, splitVersion, targetsOf, toPlanDoc, toVersionDoc } from './planDocs';

describe('plan documents', () => {
  const d = olehDraft();
  const doc = toPlanDoc({
    clientId: 'c1',
    trainerId: 't',
    programId: d.id,
    liveVersion: 4,
    rev: 3,
    updatedAt: 1,
    trainerDays: ['Tue', 'Fri'],
    draft: d,
  });

  it('every field is declared: nothing user-written leaves in the clear', () => {
    const { open, secret } = splitPlan(doc);
    expect(Object.keys(open).sort()).toEqual(
      NEW_COLLECTIONS.plans.open.filter((k) => k in doc).sort(),
    );
    for (const k of ['trainerDays', 'targets', 'activities', 'dayNotes'])
      expect(k in secret).toBe(true);
  });

  it('the version document seals the summary and the overlay', () => {
    const v = toVersionDoc({
      n: 5,
      programId: d.id,
      state: 'draft',
      createdAt: 1,
      publishedAt: null,
      summary: 'Added paused bench',
      draft: d,
    });
    const { open, secret } = splitVersion(v);
    expect('summary' in open).toBe(false);
    expect('summary' in secret && 'overlay' in secret).toBe(true);
  });

  it('targets carry weight, RPE, rest, note and the bare flag by item id', () => {
    const row = d.items.find((i) => i.name === 'Leg Press')!;
    const t = targetsOf(setRowMode(d, row.id, true));
    expect(t[row.id]).toEqual(expect.objectContaining({ bare: true }));
    const bench = d.items.find((i) => i.name === 'Paused bench press')!;
    expect(targetsOf(d)[bench.id]).toEqual(
      expect.objectContaining({ weight: 90, note: '2 s pause on the chest' }),
    );
  });
});
