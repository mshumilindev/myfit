/**
 * Cloud Storage rules WITHOUT the emulator (SPO-109): the real `storage.rules` evaluated with the same interpreter as the
 * Firestore rules. A client's photo may be read by the client, an admin and the trainer the client is linked to
 * (`users/{id}.trainerId`, which the accept flow sets) and by a member for their own trainer; nobody else. Only the owner
 * writes, and only a small jpeg / png / webp.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decide, parseRules, type Doc } from './engine/rulesEngine';

const rules = parseRules(readFileSync(resolve(process.cwd(), 'storage.rules'), 'utf8'));
const ROOT = ['b', 'spotter.appspot.com', 'o'];
const db: Record<string, Doc> = {
  'users/client1': { trainerId: 'trainer1' },
  'users/client2': { trainerId: 'trainer2' },
  'users/trainer1': { role: 'trainer' },
};
const who = (uid: string | null, role = 'member') => (uid ? { uid, token: { role } } : null);
const can = (
  op: 'get' | 'create' | 'delete',
  path: string,
  auth: ReturnType<typeof who>,
  data?: Doc,
) => decide(rules, op, path, { auth, db, ...(data ? { object: data } : {}) }, ROOT).allowed;

const PHOTO = 'avatars/client1/photo';

describe('storage.rules: avatars/{userId}/{fileName}', () => {
  it('the owner reads their own photo', () => expect(can('get', PHOTO, who('client1'))).toBe(true));
  it('the linked trainer reads their client photo (users.trainerId)', () =>
    expect(can('get', PHOTO, who('trainer1', 'trainer'))).toBe(true));
  it('another trainer cannot read a client that is not theirs', () =>
    expect(can('get', PHOTO, who('trainer2', 'trainer'))).toBe(false));
  it('an admin reads any photo', () =>
    expect(can('get', PHOTO, who('admin1', 'admin'))).toBe(true));
  it('a member reads their own trainer photo, not another member', () => {
    expect(can('get', 'avatars/trainer1/photo', who('client1'))).toBe(true);
    expect(can('get', PHOTO, who('client2'))).toBe(false);
  });
  it('signed-out reads nothing', () => expect(can('get', PHOTO, who(null))).toBe(false));
  const ok = { size: 1000, contentType: 'image/jpeg' };
  it('only the owner writes, a small image', () => {
    expect(can('create', PHOTO, who('client1'), ok)).toBe(true);
    expect(can('create', PHOTO, who('trainer1', 'trainer'), ok)).toBe(false);
    expect(can('create', PHOTO, who('client1'), { ...ok, size: 7 * 1024 * 1024 })).toBe(false);
    expect(can('create', PHOTO, who('client1'), { ...ok, contentType: 'application/pdf' })).toBe(
      false,
    );
  });
  it('only the owner deletes', () => {
    expect(can('delete', PHOTO, who('client1'))).toBe(true);
    expect(can('delete', PHOTO, who('trainer1', 'trainer'))).toBe(false);
  });
  it('anything outside avatars/ is closed', () =>
    expect(can('get', 'other/x', who('client1'))).toBe(false));
});
