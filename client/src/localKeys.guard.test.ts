// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LOCAL_KEYS, localKeyEntry } from './localKeys.registry';
import { DEVICE_KEYS } from './accounts/scopedStorage';
import { classifyKey } from './legal/mydata/deviceInventory';
import { OPEN_FIELDS } from './encryptedDoc';

/**
 * SPO-390: no browser-storage key without a decision. Scans every non-test source file of `client/src` for key-shaped
 * string literals and requires each one to be in `localKeys.registry.ts`. Extends `localStoragePlaintext.guard.test.ts`
 * (which looks only at plain writes in store.ts).
 */
const SRC = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(SRC, '..', '..');
const SKIP_DIR = new Set(['node_modules', '__tests__', '__fixtures__']);
const SKIP_FILE = /\.(test|cases|spec)\.|localKeys\.registry\.ts$/;
/** Literals that look like keys but are not storage keys. */
const NOT_STORAGE = new Map([['spotter.app', 'the app handle shown on share cards']]);

function files(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIR.has(e.name)) files(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name) && !SKIP_FILE.test(e.name)) out.push(p);
  }
  return out;
}

const LITERAL =
  /(['"`])((?:spotter|gym)\.[A-Za-z][A-Za-z0-9_.\-${}]*|sc\.[a-z][\w.]*|coach:[a-z]\w*)\1/g;

/** A template literal key is registered by the text before its first `${`. */
export function keyOf(lit: string): string {
  const at = lit.indexOf('${');
  return at < 0 ? lit : lit.slice(0, at);
}

export function unregistered(literals: Iterable<string>): string[] {
  const bad: string[] = [];
  for (const lit of literals) {
    const key = keyOf(lit);
    if (NOT_STORAGE.has(key)) continue;
    const e = localKeyEntry(key);
    // a literal that ends with `.` is itself a prefix: some prefix entry must cover it
    if (!e) bad.push(lit);
  }
  return bad;
}

const sources = files(SRC).map((f) => ({ f: relative(SRC, f), text: readFileSync(f, 'utf8') }));
const found = new Map<string, string>();
// deviceInventory.ts only NAMES keys to group them on the My data screen; it does not use them
const INVENTORY = join('legal', 'mydata', 'deviceInventory.ts');
for (const s of sources)
  if (s.f !== INVENTORY)
    for (const m of s.text.matchAll(LITERAL)) if (!found.has(m[2])) found.set(m[2], s.f);

describe('every browser-storage key is registered (SPO-390)', () => {
  it('finds the keys at all (the scan itself works)', () => {
    expect(found.size).toBeGreaterThan(60);
    expect(found.has('spotter.weightUnit')).toBe(true);
  });

  it('no key literal in client/src is missing from localKeys.registry.ts', () => {
    const bad = unregistered(found.keys()).map((k) => `${k} (${found.get(k)})`);
    expect(bad, `Register these keys in localKeys.registry.ts:\n${bad.join('\n')}`).toEqual([]);
  });

  it('a new unregistered key is caught (and a template of a registered prefix is not)', () => {
    expect(unregistered(['spotter.brandNewThing'])).toEqual(['spotter.brandNewThing']);
    expect(unregistered(['gym.brandNew.${id}'])).toEqual(['gym.brandNew.${id}']);
    expect(unregistered(['spotter.tw.${id}', 'spotter.weightUnit', 'gym.addr.x'])).toEqual([]);
  });

  it('no entry is stale: its key is still used somewhere in the source', () => {
    const all = sources.map((s) => s.text).join('\n');
    const stale = LOCAL_KEYS.filter((e) => !all.includes(e.key ?? (e.prefix as string))).map(
      (e) => e.key ?? e.prefix,
    );
    expect(stale).toEqual([]);
  });

  it('an entry names a key or a prefix, not both, and there are no duplicates', () => {
    const ids = LOCAL_KEYS.map((e) => {
      expect(Boolean(e.key) !== Boolean(e.prefix)).toBe(true);
      return e.key ?? e.prefix;
    });
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('what each class has to say (SPO-390)', () => {
  it('a gap names its issue, a synced key says where it goes', () => {
    for (const e of LOCAL_KEYS) {
      const id = e.key ?? e.prefix;
      if (e.class === 'gap')
        expect(e.issue, `${id} is a gap and needs an issue`).toMatch(/^SPO-\d+$/);
      if (e.class === 'synced')
        expect(e.syncedTo, `${id} is synced to ...`).toMatch(/^users\/\{uid\}\//);
      expect(e.note.length, `${id} needs a note`).toBeGreaterThan(3);
    }
  });

  it('device scope is exactly DEVICE_KEYS, and only those survive sign-out', () => {
    for (const e of LOCAL_KEYS) {
      const id = e.key ?? e.prefix;
      const isDevice = e.key !== undefined && DEVICE_KEYS.has(e.key);
      expect(e.scope, `${id} scope`).toBe(isDevice ? 'device' : 'account');
      expect(e.wipe, `${id} wipe`).toBe(isDevice ? 'keep' : 'signout');
    }
    for (const k of DEVICE_KEYS)
      expect(
        LOCAL_KEYS.some((e) => e.key === k),
        `${k} is in DEVICE_KEYS but not registered`,
      ).toBe(true);
  });

  it('the My data screen never files a registered key under "other"', () => {
    for (const e of LOCAL_KEYS) {
      const probe = e.key ?? `${e.prefix}x`;
      expect(classifyKey(probe), `${probe} classifies as other`).not.toBe('other');
    }
  });
});

describe('"synced" is true on the database side too (SPO-390)', () => {
  const rules = readFileSync(join(ROOT, 'firestore.rules'), 'utf8');
  const usedOutsideRegistry = sources
    .filter((s) => s.f !== INVENTORY)
    .map((s) => s.text)
    .join('\n');

  it('every meta/prefs field a key is synced to exists in the code', () => {
    for (const e of LOCAL_KEYS) {
      const m = /^users\/\{uid\}\/meta\/prefs#(\w+)$/.exec(e.syncedTo ?? '');
      if (!m) continue;
      expect(usedOutsideRegistry, `${e.key ?? e.prefix} → meta/prefs.${m[1]}`).toMatch(
        new RegExp(`\\b${m[1]}\\b`),
      );
    }
  });

  it('every meta document a key is synced to is known to the rules or the sealed-field list', () => {
    for (const e of LOCAL_KEYS) {
      const m = /^users\/\{uid\}\/meta\/(\w+)$/.exec(e.syncedTo ?? '');
      if (!m) continue;
      const known =
        new RegExp(`\\b${m[1]}\\b`).test(rules) || Object.keys(OPEN_FIELDS).includes(m[1]);
      expect(known, `${e.key ?? e.prefix} → meta/${m[1]}`).toBe(true);
    }
  });

  it('the documents added for account sync are sealed and have rules', () => {
    for (const name of ['exercisePrefs', 'widgetData', 'challenges'])
      expect(rules).toContain(`match /meta/${name} {`);
    expect(Object.keys(OPEN_FIELDS)).toEqual(
      expect.arrayContaining(['exercisePrefs', 'widgetData', 'challenges']),
    );
  });
});
