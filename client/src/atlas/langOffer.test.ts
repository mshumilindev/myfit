import { describe, expect, it } from 'vitest';
import { detectLang, langOffer } from './langOffer';

describe('detectLang', () => {
  it('tells the scripts apart', () => {
    expect(detectLang('скільки відпочивати?')).toBe('uk');
    expect(detectLang('how long should I rest')).toBe('en');
    expect(detectLang('ile odpoczywać między seriami')).toBe('pl');
    expect(detectLang('kiek ilsėtis')).toBe('lt');
    expect(detectLang('kui kaua puhata pärast')).toBe('et');
    expect(detectLang('ok')).toBeNull();
  });
});

describe('langOffer — once per language change', () => {
  it('offers once, stays quiet while you keep writing that language', () => {
    let st = { offered: null as null | 'uk' | 'en' | 'pl' | 'lt' | 'et' };
    let r = langOffer('скільки відпочивати', 'en', st);
    expect(r.offer).toBe('uk');
    st = r.state;
    r = langOffer('а наступна вага?', 'en', st);
    expect(r.offer).toBeNull();
    st = r.state;
    // back to the app's language → memory resets…
    r = langOffer('what about deadlift', 'en', st);
    expect(r.offer).toBeNull();
    st = r.state;
    // …so switching again gets one fresh offer
    expect(langOffer('а станова?', 'en', st).offer).toBe('uk');
  });

  it('never offers the language the app is already in', () => {
    expect(langOffer('скільки відпочивати', 'uk', { offered: null }).offer).toBeNull();
  });
});
