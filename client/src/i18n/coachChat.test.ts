import { describe, expect, it } from 'vitest';
import { LOCALE_IDS } from './index';
import { CHAT_LOCALES, chatStrings } from './coachChat';
import { chatEn } from './coachChat.en';

const KEYS = Object.keys(chatEn) as (keyof typeof chatEn)[];

function sample(d: (typeof CHAT_LOCALES)['en']): string[] {
  const out: string[] = [];
  for (const v of Object.values(d)) {
    if (typeof v === 'string') out.push(v);
    else for (const n of [0, 1, 2, 5, 11, 21]) out.push((v as (a: never) => string)(n as never));
  }
  return out;
}

describe('chat dictionary', () => {
  it('registers all five locales', () => {
    expect(Object.keys(CHAT_LOCALES).sort()).toEqual([...LOCALE_IDS].sort());
    expect(chatStrings('en')).toBe(chatEn);
  });

  it.each(LOCALE_IDS)('%s has every key with the same kind as en', (id) => {
    const dict = CHAT_LOCALES[id];
    expect(Object.keys(dict).sort()).toEqual([...KEYS].sort());
    for (const k of KEYS) expect(typeof dict[k], `${id}.${k}`).toBe(typeof chatEn[k]);
  });

  it.each(LOCALE_IDS)(
    '%s: no empty, untrimmed or unfilled strings (names/numbers as args)',
    (id) => {
      const d = CHAT_LOCALES[id];
      const out: string[] = [];
      for (const v of Object.values(d)) {
        if (typeof v === 'string') out.push(v);
        else {
          const f = v as unknown as (a: number | string) => string;
          out.push(f('Oleh'), f(1), f(2), f(5), f(12), f(21));
        }
      }
      for (const s of out) {
        expect(s.length).toBeGreaterThan(0);
        expect(s).not.toMatch(/\{n\}|undefined|NaN/);
      }
      void sample;
    },
  );

  it.each(LOCALE_IDS.filter((l) => l !== 'en'))('%s: translated, not copied', (id) => {
    const d = CHAT_LOCALES[id];
    for (const k of ['chTitle', 'chSend', 'chDelTitle', 'chClearTitle', 'chNewDivider'] as const)
      expect(d[k], `${id}.${k}`).not.toBe(chatEn[k]);
  });

  it('never promises end-to-end encryption or media (plan C.1, R-FE-020)', () => {
    for (const id of LOCALE_IDS) {
      const text = JSON.stringify(sample(CHAT_LOCALES[id])).toLowerCase();
      expect(text).not.toMatch(/end-to-end|attach|photo|camera|paperclip|voice/);
    }
  });
});
