import { describe, expect, it } from 'vitest';
import { addonById } from '../addons/manifest';
import { SHARE_IDS } from '../coach/client/shareModel';
import { ADDON_OF } from '../coach/client/shareModel';
import { CONSENT_KINDS, REQUIRED_KINDS } from './consents';
import { CATEGORY_REGISTRY, CORE_OWNER, consentVisible } from './categoryRegistry';
import { OPTIONAL_KINDS, countOn, visibleKinds } from './consentsModel';

/** Kinds that are not a category of data: the Terms row and the trainer's own terms. */
const NOT_CATEGORIES = new Set<string>([...REQUIRED_KINDS, 'trainer-terms']);

describe('category registry (SPO-571 guard)', () => {
  it('has an entry for every consent kind that is a category', () => {
    const have = new Set(CATEGORY_REGISTRY.flatMap((e) => (e.consent ? [e.consent] : [])));
    const missing = CONSENT_KINDS.filter((k) => !NOT_CATEGORIES.has(k) && !have.has(k));
    expect(missing).toEqual([]);
  });

  it('has an entry for every trainer-sharing setting, and Cycle is explicitly never shared', () => {
    const shared = new Set(CATEGORY_REGISTRY.map((e) => e.share));
    expect(SHARE_IDS.filter((id) => !shared.has(id))).toEqual([]);
    expect(CATEGORY_REGISTRY.find((e) => e.id === 'cycle')?.share).toBe('none');
    // Every share id is a real setting (or the explicit "none").
    for (const e of CATEGORY_REGISTRY)
      expect(e.share === 'none' || SHARE_IDS.includes(e.share as never)).toBe(true);
  });

  it('names an owner that exists in the manifest (or the core) for every category', () => {
    for (const e of CATEGORY_REGISTRY)
      expect(e.owner === CORE_OWNER || addonById(e.owner), e.id).toBeTruthy();
  });

  it('has unique ids, one entry per consent kind and one per sharing setting', () => {
    const ids = CATEGORY_REGISTRY.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const kinds = CATEGORY_REGISTRY.flatMap((e) => (e.consent ? [e.consent] : []));
    expect(new Set(kinds).size).toBe(kinds.length);
    const shares = CATEGORY_REGISTRY.map((e) => e.share).filter((s) => s !== 'none');
    expect(new Set(shares).size).toBe(shares.length);
  });

  it('agrees with the sharing list: a setting hidden by an add-on there is owned by the same add-on here', () => {
    for (const [share, addon] of Object.entries(ADDON_OF)) {
      const e = CATEGORY_REGISTRY.find((x) => x.share === share);
      expect(e?.owner, share).toBe(addon);
    }
  });

  it('gives every consent row an icon and a tone (Nutrition included)', () => {
    for (const e of CATEGORY_REGISTRY.filter((x) => x.consent)) {
      expect(e.icon, e.id).toBeTruthy();
      expect(e.tone, e.id).toBeTruthy();
    }
  });

  it('keeps the saved chat copy when Atlas goes, and withdraws the AI engines', () => {
    const on = (id: string) => CATEGORY_REGISTRY.find((e) => e.id === id)?.onRemove;
    expect(on('atlas-history')).toBe('keep');
    expect(on('atlas-ai')).toBe('withdraw');
    expect(on('atlas-puter')).toBe('withdraw');
  });
});

describe('consent visibility by owner', () => {
  const none = () => false;
  it('hides every consent whose owner is not available, shows the rest', () => {
    expect(visibleKinds(none)).toEqual([]);
    expect(visibleKinds(() => true)).toEqual(OPTIONAL_KINDS);
    expect(visibleKinds((id) => id === 'cycle')).toEqual(['health:cycle']);
  });
  it('treats an unknown kind as visible and the core owner as always available', () => {
    expect(consentVisible('terms', none)).toBe(true);
  });
  it('counts only the rows that are shown', () => {
    expect(countOn([], none)).toEqual({ on: 0, total: 0 });
    expect(countOn([], () => true)).toEqual({ on: 0, total: OPTIONAL_KINDS.length });
    expect(countOn([])).toEqual({ on: 0, total: OPTIONAL_KINDS.length });
  });
});
