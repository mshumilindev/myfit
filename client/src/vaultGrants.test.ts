// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readyVault, unsetVault } from './testVault';
import {
  ensureCoachKey,
  ensureGrant,
  openAthleteKey,
  type GrantPorts,
  type StoredGrant,
} from './vaultGrants';
import type { CoachKeyRecord } from './vaultShare';
import { sealDoc, unsealDoc } from './encryptedDoc';

/** One shared "server" with per-user views. */
function world() {
  const pubs = new Map<string, JsonWebKey>();
  const own = new Map<string, CoachKeyRecord>();
  const grants = new Map<string, Map<string, StoredGrant>>(); // athlete -> coach -> grant
  const portsFor = (me: string): GrantPorts => ({
    loadOwnCoachKey: async () => own.get(me) ?? null,
    saveOwnCoachKey: async (r) => void own.set(me, r),
    publishCoachPub: async (p) => void pubs.set(me, p),
    loadCoachPub: async (id) => pubs.get(id) ?? null,
    loadGrant: async (id) => grants.get(me)?.get(id) ?? null,
    saveGrant: async (id, g) => {
      if (!grants.has(me)) grants.set(me, new Map());
      grants.get(me)!.set(id, g);
    },
    listGrantIds: async () => [...(grants.get(me)?.keys() ?? [])],
    deleteGrant: async (id) => void grants.get(me)?.delete(id),
  });
  return { portsFor, grants, pubs, own };
}

describe('automatic key exchange', () => {
  it('coach key is created once and published', async () => {
    const w = world();
    const coach = await readyVault();
    expect(await ensureCoachKey(coach, w.portsFor('c1'))).toBe('created');
    expect(await ensureCoachKey(coach, w.portsFor('c1'))).toBe('present');
    expect(w.pubs.has('c1')).toBe(true);
  });

  it('does nothing while a vault is locked', async () => {
    const w = world();
    const locked = await unsetVault();
    expect(await ensureCoachKey(locked, w.portsFor('c1'))).toBe('locked');
    expect(await ensureGrant(locked, 'c1', w.portsFor('a1'))).toBe('locked');
  });

  it('waits for a coach without a key, then grants as soon as one exists', async () => {
    const w = world();
    const athlete = await readyVault();
    const coach = await readyVault();
    expect(await ensureGrant(athlete, 'c1', w.portsFor('a1'))).toBe('waiting-for-coach');
    await ensureCoachKey(coach, w.portsFor('c1'));
    expect(await ensureGrant(athlete, 'c1', w.portsFor('a1'))).toBe('created');
    expect(await ensureGrant(athlete, 'c1', w.portsFor('a1'))).toBe('current');
  });

  it('end to end: the coach reads the athlete data, nobody else can', async () => {
    const w = world();
    const athlete = await readyVault();
    const coach = await readyVault();
    const stranger = await readyVault();
    await ensureCoachKey(coach, w.portsFor('c1'));
    await ensureCoachKey(stranger, w.portsFor('c2'));
    await ensureGrant(athlete, 'c1', w.portsFor('a1'));

    const { key, salt } = athlete.material();
    const sealed = await sealDoc('gyms', { id: 'g', updatedAt: 1, name: 'Home gym' }, key, salt);

    const grant = w.grants.get('a1')!.get('c1');
    const ak = await openAthleteKey(coach, grant, w.portsFor('c1'));
    expect(ak).not.toBeNull();
    expect((await unsealDoc(sealed, ak!.key)).name).toBe('Home gym');
    expect(await openAthleteKey(stranger, grant, w.portsFor('c2'))).toBeNull();
  });

  it('changing coach revokes the old grant and grants the new one', async () => {
    const w = world();
    const athlete = await readyVault();
    const c1 = await readyVault();
    const c2 = await readyVault();
    await ensureCoachKey(c1, w.portsFor('c1'));
    await ensureCoachKey(c2, w.portsFor('c2'));
    await ensureGrant(athlete, 'c1', w.portsFor('a1'));
    expect(await ensureGrant(athlete, 'c2', w.portsFor('a1'))).toBe('created');
    expect([...w.grants.get('a1')!.keys()]).toEqual(['c2']);
  });

  it('no coach removes every grant', async () => {
    const w = world();
    const athlete = await readyVault();
    const c1 = await readyVault();
    await ensureCoachKey(c1, w.portsFor('c1'));
    await ensureGrant(athlete, 'c1', w.portsFor('a1'));
    expect(await ensureGrant(athlete, null, w.portsFor('a1'))).toBe('none');
    expect(w.grants.get('a1')!.size).toBe(0);
  });

  it('a coach who regenerated the key pair gets a fresh grant', async () => {
    const w = world();
    const athlete = await readyVault();
    const coach = await readyVault();
    await ensureCoachKey(coach, w.portsFor('c1'));
    await ensureGrant(athlete, 'c1', w.portsFor('a1'));
    w.own.delete('c1');
    w.pubs.delete('c1');
    await ensureCoachKey(coach, w.portsFor('c1'));
    expect(await ensureGrant(athlete, 'c1', w.portsFor('a1'))).toBe('created');
  });
});
