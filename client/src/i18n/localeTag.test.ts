import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCALE_IDS } from './index';

// A locale ID (en/uk/pl/lt/et) is a valid tag, so views pass `locale` to Intl. `Strings.locale` is the language's display NAME ("Українська", "Lietuvių"), not a BCP 47 tag. Passing it to Intl
// throws "Invalid language tag" and crashed the session start in uk and lt (SPO-140 audit found it).
describe('locale ids as Intl tags', () => {
  it.each(LOCALE_IDS)('%s gives a tag Intl accepts', (id) => {
    expect(() => new Intl.DateTimeFormat(id, { weekday: 'long' })).not.toThrow();
    expect(() => 'x'.toLocaleUpperCase(id)).not.toThrow();
  });

  it('no source passes the display name to Intl or toLocale*', () => {
    const root = join(__dirname, '..');
    const bad: string[] = [];
    const walk = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n)) {
          const src = readFileSync(p, 'utf8');
          if (/(Intl\.\w+\(|toLocale\w*\()\s*t\.locale\b/.test(src)) bad.push(p.slice(root.length));
        }
      }
    };
    walk(root);
    expect(bad).toEqual([]);
  });
});
