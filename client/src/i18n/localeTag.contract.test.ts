import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// `t.locale` is the language's display name ("Українська"), not a BCP-47 tag: handing it to Intl or
// toLocale*Case throws a RangeError in uk/lt. Code must use `locale` from `useT()` instead.
const SRC = join(__dirname, '..');
const BAD = /(Intl\.\w+\(\s*|toLocale\w*Case\(\s*|toLocale\w*String\(\s*)t\.locale\b/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'node_modules' ? [] : files(p);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
  });
}

describe('locale tag', () => {
  it('never passes the display name t.locale to Intl / toLocale*', () => {
    const offenders = files(SRC).filter((f) => BAD.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
