import { describe, expect, it } from 'vitest';
import { FACT_CATEGORY, buildChatFacts } from './chatFacts';
import { COACH_DEFAULT } from './types';
import { ATLAS_AI_CATEGORIES } from '../legal/gateChoices';
import { renderHook } from '@testing-library/react';
import { setLocale, type LocaleId } from '../i18n';
import { useAtlasConsentT } from '../i18n/atlasConsent';
import { richCtx } from './testCtx';

/**
 * SPO-286: the payload is no wider than the consent text. The consent lists `ATLAS_AI_CATEGORIES`; every key of the
 * facts must belong to one of them (or be the non-personal `context`), and every listed category must really be sent.
 */
const CONSENT = new Set<string>(ATLAS_AI_CATEGORIES);

function payload() {
  const s = richCtx('en').s;
  const facts = buildChatFacts(
    {
      ...s,
      injuries: [],
      sleeps: [],
      conditions: [],
      activities: [],
      bodyMetrics: { weights: [{ id: 'a', at: 1, weight: 90 }], dob: '1990-07-01', sex: 'male' },
      coach: { ...COACH_DEFAULT, enabled: true },
    } as never,
    [],
    1,
    Date.now(),
  );
  return JSON.parse(facts) as Record<string, unknown>;
}

describe('Atlas chat payload vs the consent text', () => {
  it('every key sent belongs to a category the consent lists', () => {
    const keys = Object.keys(payload());
    const unknown = keys.filter((k) => !(k in FACT_CATEGORY));
    expect(unknown, `keys with no consent category: ${unknown.join(', ')}`).toEqual([]);
    for (const k of keys) {
      const cat: string = FACT_CATEGORY[k as keyof typeof FACT_CATEGORY];
      expect(cat === 'context' || CONSENT.has(cat), `${k} -> ${cat}`).toBe(true);
    }
  });

  it('the map names only listed categories, and every listed category is really sent', () => {
    const used = new Set<string>(Object.values(FACT_CATEGORY));
    used.delete('context');
    for (const c of used) expect(CONSENT.has(c), `category not in the consent: ${c}`).toBe(true);
    for (const c of ATLAS_AI_CATEGORIES) expect(used.has(c), `consent overstates: ${c}`).toBe(true);
  });

  it('never carries identity: no name, email, birth date, photos or ids', () => {
    const text = JSON.stringify(payload());
    expect(text).not.toMatch(/1990|email|@|displayName|photo|uid/i);
  });

  it('every category has words in each language the consent is written in', () => {
    for (const loc of ['en', 'uk', 'pl', 'lt', 'et'] as LocaleId[]) {
      setLocale(loc);
      const tx = renderHook(() => useAtlasConsentT()).result.current;
      for (const c of ATLAS_AI_CATEGORIES)
        expect(tx.categories[c]?.length, `${loc}: ${c}`).toBeGreaterThan(2);
    }
    setLocale('en');
  });
});
