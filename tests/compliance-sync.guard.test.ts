/**
 * compliance-sync guard (SPO-295 N11, `LEGAL-compliance-system.md` §3 item 5): the data registry, the processor and
 * tracker registers and the AI-provider register (docs/compliance/*) cannot silently fall behind the code.
 * Pure file reads: no emulator, no network. A failure says exactly WHAT to add and WHERE. Do not weaken it: add the row.
 *   (a) every top-level collection and every users/{uid}/<sub> in firestore.rules has a row in data-registry.md
 *   (b) every ConsentKind appears in data-registry.md
 *   (c) every third-party host in gymProviders.ts / index.html / firebase.json (CSP) (+ the map, Puter, OFF and admin-QR modules)
 *       appears in processors.md or trackers.md
 *   (d) every key of FACT_CATEGORY (atlas/chatFacts.ts) and every Atlas AI category appears in ai-providers.md
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONSENT_KINDS } from '../client/src/legal/consents';
import { ATLAS_AI_CATEGORIES } from '../client/src/legal/gateChoices';

const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const registry = read('docs/compliance/data-registry.md');
const processors = read('docs/compliance/processors.md');
const trackers = read('docs/compliance/trackers.md');
const aiDoc = read('docs/compliance/ai-providers.md');

const report = (title: string, missing: string[], howTo: string) =>
  missing.length
    ? `${title}\n  missing: ${missing.join(', ')}\n  ADD: ${howTo}`
    : '';

/** Collections that hold no personal data. Allowed WITHOUT a registry row, each with its reason. */
const NO_PERSONAL_DATA: Record<string, string> = {
  exerciseCatalog: 'shared exercise catalog, written by admins',
  sharedGyms: 'crowdsourced equipment ids per venue, no personal data (rules comment)',
  config: 'app-wide switches edited in the console (see registry R53 for the closed-test allow-list caveat)',
};

/** Registry paths: backticked tokens, normalised to `top` or `users/{uid}/sub`, each with the id of its `| Rn |` row. */
function registryPaths(): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of registry.split('\n')) {
    const row = /^\| (R\d+) \|/.exec(line);
    if (!row) continue;
    for (const m of line.matchAll(/`([A-Za-z]+(?:\/\{[A-Za-z]+\})?(?:\/[A-Za-z]+)?(?:\/\{[A-Za-z]+\})?)[^`]*`/g)) {
      const parts = m[1].split('/');
      const key = parts[0] === 'users' && parts[1] === '{uid}' && parts[2] ? `users/{uid}/${parts[2]}` : parts[0];
      if (!out.has(key)) out.set(key, row[1]);
    }
  }
  return out;
}

/** Top-level collections and the direct subcollections of users/{userId} from firestore.rules. */
function rulesCollections(): { top: string[]; userSubs: string[] } {
  const lines = read('firestore.rules').split('\n');
  const top = new Set<string>();
  const subs = new Set<string>();
  let inUsers = false;
  for (const l of lines) {
    const t = /^ {4}match \/([A-Za-z]+)\//.exec(l);
    if (t) {
      top.add(t[1]);
      inUsers = t[1] === 'users';
      continue;
    }
    if (inUsers) {
      const s = /^ {6}match \/([A-Za-z]+)\/\{/.exec(l);
      if (s) subs.add(s[1]);
    }
  }
  return { top: [...top].sort(), userSubs: [...subs].sort() };
}

const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

function hostsOf(text: string): string[] {
  const hosts = new Set<string>();
  for (const m of text.matchAll(/(?:https?|wss):\/\/([A-Za-z0-9*][A-Za-z0-9*.-]*\.[A-Za-z]{2,})/g)) hosts.add(m[1].toLowerCase());
  return [...hosts];
}

/** Hosts that are not a request (XML namespaces, docs links). */
const NOT_A_REQUEST = new Set(['www.w3.org']);

describe('compliance-sync: docs/compliance stay in step with the code', () => {
  it('(a) every collection in firestore.rules has a data-registry row (or a reasoned allow-list entry)', () => {
    const { top, userSubs } = rulesCollections();
    expect(top.length).toBeGreaterThan(10); // the parser still sees the rules
    expect(userSubs.length).toBeGreaterThan(15);
    const paths = registryPaths();
    const missingTop = top.filter((c) => !paths.has(c) && !(c in NO_PERSONAL_DATA));
    const missingSubs = userSubs.filter((s) => !paths.has(`users/{uid}/${s}`));
    const msg = [
      report(
        'firestore.rules top-level collections without a registry row:',
        missingTop,
        'a row `| Rn | ... | `<collection>/{id}` | ...` in docs/compliance/data-registry.md (what, where, encryption, purpose, basis, retention, recipients, export, deletion, consent), or an entry with a reason in NO_PERSONAL_DATA of this test',
      ),
      report(
        'firestore.rules users/{uid} subcollections without a registry row:',
        missingSubs.map((s) => `users/{uid}/${s}`),
        'a row in docs/compliance/data-registry.md whose "Де" column has the backticked path `users/{uid}/<sub>`',
      ),
    ]
      .filter(Boolean)
      .join('\n');
    expect(msg, msg).toBe('');
  });

  it('(a) allow-list entries are still collections in the rules (no stale exceptions)', () => {
    const { top } = rulesCollections();
    expect(Object.keys(NO_PERSONAL_DATA).filter((c) => !top.includes(c))).toEqual([]);
  });

  it('(b) every ConsentKind appears in data-registry.md', () => {
    const missing = CONSENT_KINDS.filter((k) => !registry.includes(`\`${k}\``));
    const msg = report(
      'ConsentKind (client/src/legal/consents.ts) not in the registry:',
      missing,
      'the kind in backticks in docs/compliance/data-registry.md (the consent-kind table and the Consent column of the rows it governs)',
    );
    expect(msg, msg).toBe('');
  });

  it('(c) every third-party host in code and CSP appears in processors.md or trackers.md', () => {
    const sources: Record<string, string> = {
      'client/src/data/gymProviders.ts': strip(read('client/src/data/gymProviders.ts')),
      'client/index.html': read('client/index.html').replace(/<!--[\s\S]*?-->/g, ''),
      'firebase.json (CSP)': read('firebase.json'),
      'client/src/components/RouteMap.tsx': strip(read('client/src/components/RouteMap.tsx')),
      'client/src/atlas/puter.ts': strip(read('client/src/atlas/puter.ts')),
      'client/src/nutrition/off.ts': strip(read('client/src/nutrition/off.ts')),
      'client/src/views/AdminView.tsx': strip(read('client/src/views/AdminView.tsx')),
    };
    const docs = `${processors}\n${trackers}`.toLowerCase();
    const missing: string[] = [];
    let seen = 0;
    for (const [file, text] of Object.entries(sources)) {
      for (const h of hostsOf(text)) {
        if (NOT_A_REQUEST.has(h)) continue;
        seen++;
        if (!docs.includes(h)) missing.push(`${h} (${file})`);
      }
    }
    expect(seen).toBeGreaterThan(15); // the extractor still finds hosts
    const msg = report(
      'third-party hosts without a register entry:',
      missing,
      'a row in docs/compliance/processors.md (what it receives, when, basis, transfer note) or docs/compliance/trackers.md, and a mention in the Privacy Policy',
    );
    expect(msg, msg).toBe('');
  });

  it('(d) every FACT_CATEGORY key and every Atlas AI category is covered by ai-providers.md', () => {
    const src = read('client/src/atlas/chatFacts.ts');
    const body = /export const FACT_CATEGORY = \{([\s\S]*?)\} as const/.exec(src);
    expect(body, 'FACT_CATEGORY not found in client/src/atlas/chatFacts.ts').not.toBeNull();
    const keys = [...(body as RegExpExecArray)[1].matchAll(/^\s*([A-Za-z]+)\s*:/gm)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(5);
    const missingKeys = keys.filter((k) => !aiDoc.includes(`\`${k}\``));
    const missingCats = ATLAS_AI_CATEGORIES.filter((c) => !aiDoc.includes(`\`${c}\``));
    const msg = [
      report(
        'FACT_CATEGORY keys (client/src/atlas/chatFacts.ts) not in ai-providers.md:',
        missingKeys,
        'a row in the payload-category table of docs/compliance/ai-providers.md with the key in backticks, and re-check the consent text (SPO-286) and the Privacy Policy',
      ),
      report(
        'ATLAS_AI_CATEGORIES not in ai-providers.md:',
        missingCats,
        'the category in backticks in docs/compliance/ai-providers.md',
      ),
    ]
      .filter(Boolean)
      .join('\n');
    expect(msg, msg).toBe('');
  });
});
