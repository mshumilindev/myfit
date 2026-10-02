import { describe, expect, it, vi } from 'vitest';

vi.mock('../../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  deleteField: () => '__delete__',
}));

import {
  activitiesLocked,
  activityFields,
  openActivities,
  sealActivitiesInDoc,
} from './activitiesVault';
import { readyVault, unsetVault } from '../../testVault';
import { createAutoVault } from '../../autoVault';
import type { ProgramActivity } from './model';

const list: ProgramActivity[] = [
  { id: 'a', day: 6, type: 'padel', minutes: 75, effort: 'moderate', when: 'any' },
];

describe('planned activities are sealed with the vault key', () => {
  it('ready vault: only an envelope is stored, and it opens back to the list', async () => {
    const v = await readyVault();
    const stored = await sealActivitiesInDoc({ name: 'P', activities: list }, v);
    expect(stored.activities).toBeUndefined();
    expect(stored.name).toBe('P');
    expect(JSON.stringify(stored)).not.toContain('padel');
    const opened = await openActivities(stored as { activities?: unknown }, v);
    expect(opened.activities).toEqual(list);
  });

  it('vault not ready: rejects instead of writing plaintext', async () => {
    const v = await unsetVault();
    await expect(sealActivitiesInDoc({ name: 'P', activities: list }, v)).rejects.toThrow(
      'Vault key is not ready',
    );
  });

  it('merge fields clear the other form', async () => {
    const f = await activityFields(list, await readyVault());
    expect(f.activities).toBe('__delete__');
    expect(f.activitiesEnc).toBeTruthy();
    await expect(activityFields(list, await unsetVault())).rejects.toThrow(
      'Vault key is not ready',
    );
  });

  it('a sealed list that cannot be opened stays locked and is carried through, never dropped', async () => {
    const stored = (await sealActivitiesInDoc({ activities: list }, await readyVault())) as {
      activitiesEnc: never;
    };
    const locked = createAutoVault({
      fetchKey: () => Promise.reject(new Error('offline')),
      cache: { get: async () => null, set: async () => undefined, clear: async () => undefined },
    });
    const opened = await openActivities(
      stored as never as { activities?: unknown; activitiesEnc?: unknown },
      locked,
    );
    expect(opened.activities).toBeUndefined();
    expect(activitiesLocked(opened)).toBe(true);
    const again = await sealActivitiesInDoc(opened as never, locked);
    expect(again.activitiesEnc).toEqual(stored.activitiesEnc);
  });

  it('no list and no envelope: nothing stored', async () => {
    expect(await sealActivitiesInDoc({ name: 'P' } as never, await readyVault())).toEqual({
      name: 'P',
    });
    expect(await sealActivitiesInDoc({ activities: [] } as never, await readyVault())).toEqual({});
  });
});
