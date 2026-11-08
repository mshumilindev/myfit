import { describe, expect, it } from 'vitest';
import { ADDONS, addonById } from './manifest';

/** SPO-512 AC4: an add-on carries its app's colour; a child without it (or with another tone) is an error. */
describe('manifest colour coding', () => {
  const children = ADDONS.filter((a) => a.parent);
  it('every child names a parent that exists', () => {
    for (const a of children) expect(addonById(a.parent!), `${a.id} → ${a.parent}`).toBeTruthy();
  });
  it('every item has a tone', () => {
    for (const a of ADDONS) expect(typeof a.tone, a.id).toBe('number');
  });
  it('a child has the same tone as its parent app', () => {
    const off = children
      .filter((a) => addonById(a.parent!)!.tone !== a.tone)
      .map((a) => `${a.id}(${a.tone}) vs ${a.parent}(${addonById(a.parent!)!.tone})`);
    expect(off).toEqual([]);
  });
});
