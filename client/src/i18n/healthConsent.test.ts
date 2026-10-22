import { describe, expect, it } from 'vitest';
import { HEALTH_CONSENT_LOCALES, healthConsentTexts, withdrawNote } from './healthConsent';
import { HEALTH_FEATURES } from '../legal/consents';

describe('health consent words', () => {
  it('en, uk and pl carry the same keys and a text for every feature; lt and et read English', () => {
    const en = healthConsentTexts('en');
    for (const l of ['uk', 'pl'] as const) {
      const t = healthConsentTexts(l);
      expect(Object.keys(t).sort()).toEqual(Object.keys(en).sort());
      for (const f of HEALTH_FEATURES)
        expect(Object.keys(t.features[f]).sort()).toEqual(Object.keys(en.features[f]).sort());
      expect(t.primary).not.toBe(en.primary);
      expect(t.disclaimer).not.toBe(en.disclaimer);
    }
    expect(healthConsentTexts('lt')).toBe(en);
    expect(healthConsentTexts('et')).toBe(en);
    expect(Object.keys(HEALTH_CONSENT_LOCALES).sort()).toEqual(['en', 'pl', 'uk']);
  });

  it('never overstates the protection: end-to-end is named only to deny it', () => {
    const denial =
      /not end-to-end|не наскрізне|nie szyfrowanie end-to-end|Це не наскрізне|To nie jest szyfrowanie end-to-end/;
    for (const l of ['en', 'uk', 'pl'] as const) {
      const t = healthConsentTexts(l);
      expect(t.where).toMatch(denial);
      expect(t.whereNutrition).toMatch(denial);
    }
  });

  it('injuries and conditions say plainly that saved safety limits keep restricting and are never shown, shared or sent', () => {
    for (const l of ['en', 'uk', 'pl'] as const) {
      const t = healthConsentTexts(l);
      for (const f of ['injuries', 'chronic'] as const) {
        expect(t.features[f].limits.length).toBeGreaterThan(40);
        expect(withdrawNote(t.features[f])).toContain(t.features[f].limits);
      }
      for (const f of HEALTH_FEATURES.filter((x) => x !== 'injuries' && x !== 'chronic'))
        expect(t.features[f].limits).toBe('');
      expect(t.d1Limits.length).toBeGreaterThan(10);
    }
    const en = healthConsentTexts('en');
    expect(en.features.injuries.limits).toMatch(/only ever reduce load/);
    expect(en.features.injuries.limits).toMatch(/never shown, shared or sent/);
  });

  it('the trainer sentence matches what the code does: injuries and the food log are switched off, not "left as set"', () => {
    for (const l of ['en', 'uk', 'pl'] as const) {
      const t = healthConsentTexts(l);
      expect(t.features.injuries.coach).toBe(withdrawNote({ ...t.features.injuries, limits: '' }));
      expect(t.features.injuries.coach).not.toBe(t.features.nutrition.coach);
    }
    const en = healthConsentTexts('en');
    expect(en.features.injuries.coach).toMatch(/switched off too/);
    expect(en.features.nutrition.coach).toMatch(/switched off too/);
    expect(en.features.injuries.coach).not.toMatch(/stays as you set/);
  });
});
