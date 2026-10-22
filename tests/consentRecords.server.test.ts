import { describe, expect, it } from 'vitest';
import {
  CONSENT_KINDS as SERVER_KINDS,
  VERSION_RE as SERVER_VERSION_RE,
  HASH_REQUIRED_KINDS as SERVER_HASH_KINDS,
  RELEASED_VERSIONS as SERVER_RELEASED,
  buildConsentRecord,
  currentVersionOf,
  documentOf as serverDocumentOf,
  isNoOp,
  parseConsentInput,
} from '../functions/src/consentRecordsPure';
import {
  CONSENT_KINDS,
  HASH_REQUIRED_KINDS,
  RELEASED_VERSIONS,
  VERSION_RE,
  currentVersion,
  documentOf,
} from '../client/src/legal/consents';

const V = '2026-10-21';
const HASH = 'b'.repeat(64);
const ok = { kind: 'atlas-ai', action: 'grant', version: currentVersionOf('atlas-ai') };
const code = (d: unknown) => {
  try {
    parseConsentInput(d);
    return 'ok';
  } catch (e) {
    return (e as Error).message;
  }
};

describe('recordConsent input', () => {
  it('server and client agree on the kinds and the version format', () => {
    expect([...SERVER_KINDS].sort()).toEqual([...CONSENT_KINDS].sort());
    expect(SERVER_VERSION_RE.source).toBe(VERSION_RE.source);
  });

  it('server and client agree on released versions, documents, current versions and hash-required kinds', () => {
    expect(SERVER_RELEASED).toEqual(RELEASED_VERSIONS);
    expect([...SERVER_HASH_KINDS].sort()).toEqual([...HASH_REQUIRED_KINDS].sort());
    for (const k of CONSENT_KINDS) {
      expect(serverDocumentOf(k), k).toBe(documentOf(k));
      expect(currentVersionOf(k), k).toBe(currentVersion(k));
    }
  });

  it('accepts every known kind and both actions', () => {
    for (const kind of SERVER_KINDS)
      for (const action of ['grant', 'withdraw']) {
        const textHash = SERVER_HASH_KINDS.includes(kind) && action === 'grant' ? HASH : undefined;
        const version = currentVersionOf(kind);
        expect(parseConsentInput({ kind, action, version, ...(textHash && { textHash }) })).toEqual(
          {
            kind,
            action,
            version,
            ...(textHash && { textHash }),
          },
        );
      }
  });

  it('a grant must be for the CURRENT version; a withdrawal for any released one', () => {
    expect(code({ ...ok, version: '2025-01-01' })).toBe('stale-version');
    expect(code({ ...ok, version: '2099-01-01' })).toBe('stale-version');
    expect(code({ ...ok, action: 'withdraw', version: '2025-01-01' })).toBe('bad-version');
    expect(code({ ...ok, action: 'withdraw' })).toBe('ok');
  });

  it('grants of terms, policy-ack and trainer-terms need a 64-hex textHash; withdrawals and other kinds do not', () => {
    for (const kind of ['terms', 'policy-ack', 'trainer-terms']) {
      const cur = currentVersionOf(kind); // trainer-terms has its own version line
      expect(code({ kind, action: 'grant', version: cur })).toBe('bad-textHash');
      expect(code({ kind, action: 'grant', version: cur, textHash: HASH })).toBe('ok');
      expect(code({ kind, action: 'withdraw', version: cur })).toBe('ok');
    }
    expect(code({ kind: 'age-18', action: 'grant', version: V })).toBe('ok');
  });

  it('refuses unknown kinds, actions and extra fields', () => {
    expect(code({ ...ok, kind: 'marketing' })).toBe('bad-kind');
    expect(code({ ...ok, kind: 'health:other' })).toBe('bad-kind');
    expect(code({ ...ok, kind: 5 })).toBe('bad-kind');
    expect(code({ ...ok, action: 'revoke' })).toBe('bad-action');
    expect(code({ ...ok, at: 1 })).toBe('bad-input');
    expect(code({ ...ok, id: 'x' })).toBe('bad-input');
    expect(code(null)).toBe('bad-input');
    expect(code([])).toBe('bad-input');
    expect(code('x')).toBe('bad-input');
  });

  it('refuses a malformed version', () => {
    for (const version of ['2026-10-2', '20261021', '2026-10-21T00:00', '', 5, undefined])
      expect(code({ ...ok, version }), String(version)).toBe('bad-version');
  });

  it('checks textHash, categories and engines', () => {
    const hash = 'a'.repeat(64);
    expect(parseConsentInput({ ...ok, textHash: hash }).textHash).toBe(hash);
    expect(code({ ...ok, textHash: 'A'.repeat(64) })).toBe('bad-textHash');
    expect(code({ ...ok, textHash: 'abc' })).toBe('bad-textHash');
    expect(
      parseConsentInput({ ...ok, categories: ['workouts', 'workouts', 'sleep'] }).categories,
    ).toEqual(['workouts', 'sleep']);
    expect(code({ ...ok, categories: 'workouts' })).toBe('bad-categories');
    expect(code({ ...ok, categories: ['a b'] })).toBe('bad-categories');
    expect(code({ ...ok, categories: ['x'.repeat(65)] })).toBe('bad-categories');
    expect(code({ ...ok, categories: Array.from({ length: 21 }, (_, i) => `c${i}`) })).toBe(
      'bad-categories',
    );
    expect(code({ ...ok, engines: [1] })).toBe('bad-engines');
    expect(parseConsentInput({ ...ok, engines: ['gemini'] }).engines).toEqual(['gemini']);
  });

  it('builds the stored doc with an opaque id (time + random, no kind) and the given (server) time', () => {
    const health = parseConsentInput({ kind: 'health:cycle', action: 'grant', version: V });
    const doc = buildConsentRecord(health, 1_700_000_000_000, 'abc123');
    expect(doc).toEqual({ id: '1700000000000-abc123', ...health, at: 1_700_000_000_000 });
    expect(doc.id).not.toContain('cycle');
    expect(doc.id).not.toContain('health');
  });

  it('isNoOp: same action, version, categories and engines (order-insensitive) as the latest', () => {
    const base = {
      action: 'grant',
      version: ok.version,
      categories: ['a', 'b'],
      engines: ['gemini'],
    };
    const same = parseConsentInput({ ...ok, categories: ['b', 'a'], engines: ['gemini'] });
    expect(isNoOp(base, same)).toBe(true);
    expect(isNoOp(null, same)).toBe(false);
    expect(isNoOp(base, parseConsentInput({ ...ok, categories: ['a'], engines: ['gemini'] }))).toBe(
      false,
    );
    expect(isNoOp(base, parseConsentInput({ ...ok, categories: ['a', 'b'] }))).toBe(false);
    expect(isNoOp({ ...base, action: 'withdraw' }, same)).toBe(false);
    expect(isNoOp({ ...base, version: '2025-01-01' }, same)).toBe(false);
  });
});
