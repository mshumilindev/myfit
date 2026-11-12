import { beforeEach, describe, expect, it, vi } from 'vitest';

const openAthleteKey = vi.fn();
const unsealDoc = vi.fn();
vi.mock('../../../vaultGrants', () => ({
  openAthleteKey: (...a: unknown[]) => openAthleteKey(...a),
}));
vi.mock('../../../encryptedDoc', () => ({ unsealDoc: (...a: unknown[]) => unsealDoc(...a) }));

import { createFirestoreAvailabilityPort } from './availabilityPort';
import type { FsApi } from './fsApi';

const call = vi.fn();
const port = () =>
  createFirestoreAvailabilityPort({
    fs: { call } as unknown as FsApi,
    vault: {} as never,
    loadOwnCoachKey: async () => null,
  });
const GOOD = { weekly: { '0': [[480, 600]] }, unavailable: [{ fromDay: 20000, toDay: 20002 }] };

beforeEach(() => {
  call.mockReset();
  openAthleteKey.mockReset();
  unsealDoc.mockReset();
});

describe('availability port', () => {
  it('asks the server for the sealed share only, with no categories', async () => {
    call.mockResolvedValue({ coachShare: null });
    await port().read('c1');
    expect(call).toHaveBeenCalledWith('coachRead', {
      clientId: 'c1',
      categories: [],
      share: true,
      via: 'client360',
    });
  });
  it('opens the view with the grant and returns the cleaned availability', async () => {
    call.mockResolvedValue({ coachShare: { ct: 'x' }, grant: { ct: 'g' } });
    openAthleteKey.mockResolvedValue({ key: 'K', salt: 's' });
    unsealDoc.mockResolvedValue({ view: { availability: GOOD, full: [] } });
    expect(await port().read('c1')).toEqual({
      state: 'shared',
      availability: {
        weekly: { 0: [[480, 600]] },
        unavailable: [{ fromDay: 20000, toDay: 20002 }],
      },
    });
    expect(unsealDoc).toHaveBeenCalledWith({ ct: 'x' }, 'K');
  });
  it('nothing published, no grant, no key, a view that does not open, or no availability in it: not shared', async () => {
    call.mockResolvedValue({ coachShare: null });
    expect(await port().read('c1')).toEqual({ state: 'not-shared' });
    call.mockResolvedValue({ coachShare: { ct: 'x' }, grant: null });
    openAthleteKey.mockResolvedValue(null);
    expect(await port().read('c1')).toEqual({ state: 'not-shared' });
    openAthleteKey.mockResolvedValue({ key: 'K', salt: 's' });
    unsealDoc.mockRejectedValue(new Error('bad'));
    expect(await port().read('c1')).toEqual({ state: 'not-shared' });
    unsealDoc.mockResolvedValue({ view: { full: [], effects: [] } });
    expect(await port().read('c1')).toEqual({ state: 'not-shared' });
    unsealDoc.mockResolvedValue({});
    expect(await port().read('c1')).toEqual({ state: 'not-shared' });
  });
  it('a failing call is an error for the screen to retry, never "not shared"', async () => {
    call.mockRejectedValue(Object.assign(new Error('x'), { code: 'unavailable' }));
    await expect(port().read('c1')).rejects.toBeTruthy();
  });
});
