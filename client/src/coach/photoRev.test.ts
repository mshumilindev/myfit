import { describe, expect, it } from 'vitest';
import { pendingClient, toCoachClient, type RosterClient } from './data/firestore/worldMap';
import { photoRevOf, rememberPhotoRevs } from './photoRev';
import { ALL_OFF } from './domain/consent';

const row = (over: Partial<RosterClient> = {}): RosterClient => ({
  clientId: 'c1',
  name: 'Oleh',
  status: 'active',
  mode: 'hybrid',
  consent: ALL_OFF,
  consentVersion: 1,
  keyEpoch: 1,
  cid: 'cid',
  ...over,
});

describe('coach client photo flag', () => {
  it('has a photo only when the server says the client uploaded one', () => {
    expect(toCoachClient(row({ avatar: true, avatarRev: 77 }), null).hasPhoto).toBe(true);
    expect(toCoachClient(row({ avatar: true, avatarRev: 77 }), null).photoRev).toBe(77);
    expect(toCoachClient(row({ avatar: false }), null).hasPhoto).toBe(false);
    expect(toCoachClient(row(), null).hasPhoto).toBe(false);
    expect(toCoachClient(row(), null).photoRev).toBeUndefined();
  });

  it('a client without the app (invite only) never has a photo', () => {
    const p = pendingClient({
      inviteId: 'i1',
      name: 'Maria',
      mode: 'program',
      sentAt: 1,
      expiresAt: 2,
    });
    expect(p.hasPhoto).toBeFalsy();
    expect(p.photoRev).toBeUndefined();
  });

  it('remembers the revision for the shared avatar and forgets it when the photo is gone', () => {
    rememberPhotoRevs([{ id: 'c1', photoRev: 5 }]);
    expect(photoRevOf('c1')).toBe(5);
    rememberPhotoRevs([{ id: 'c1', photoRev: 6 }]);
    expect(photoRevOf('c1')).toBe(6);
    rememberPhotoRevs([{ id: 'c1' }]);
    expect(photoRevOf('c1')).toBe(0);
    expect(photoRevOf(undefined)).toBe(0);
  });
});
