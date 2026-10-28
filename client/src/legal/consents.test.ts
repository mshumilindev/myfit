import { describe, expect, it } from 'vitest';
import {
  CONSENT_KINDS,
  LEGAL_VERSIONS,
  RELEASED_VERSIONS,
  documentOf,
  REQUIRED_KINDS,
  VERSION_RE,
  consentState,
  currentVersion,
  hasConsent,
  hasCurrentConsent,
  isConsentKind,
  isRequiredKind,
  isStale,
  latestRecord,
  needsLegalGate,
  optionalConsentOn,
  type ConsentKind,
  type ConsentRecord,
} from './consents';

const V = currentVersion('terms');
let n = 0;
const rec = (
  kind: ConsentKind,
  action: ConsentRecord['action'],
  at: number,
  version = currentVersion(kind),
): ConsentRecord => ({ id: `${at}-${kind}-${n++}`, kind, action, version, at });
const allRequired = (at = 1): ConsentRecord[] => REQUIRED_KINDS.map((k) => rec(k, 'grant', at));

describe('consent kinds and versions', () => {
  it('knows every kind from the plan, health per feature', () => {
    expect([...CONSENT_KINDS].sort()).toEqual(
      [
        'terms',
        'policy-ack',
        'age-18',
        'health:injuries',
        'health:chronic',
        'health:cycle',
        'health:nicotine',
        'health:alcohol',
        'health:supplements',
        'health:nutrition',
        'atlas-ai',
        'atlas-puter',
        'geo-search',
        'atlas-history',
        'trainer-terms',
      ].sort(),
    );
    expect(isConsentKind('health:injuries')).toBe(true);
    expect(isConsentKind('health:other')).toBe(false);
    expect(isConsentKind('marketing')).toBe(false);
    expect(isConsentKind(5)).toBe(false);
  });

  it('only terms, policy-ack and age-18 are required', () => {
    expect(CONSENT_KINDS.filter(isRequiredKind).sort()).toEqual(['age-18', 'policy-ack', 'terms']);
  });

  it('every kind has a current version in YYYY-MM-DD form, from one table', () => {
    for (const v of Object.values(LEGAL_VERSIONS)) expect(v).toMatch(VERSION_RE);
    for (const k of CONSENT_KINDS) expect(currentVersion(k)).toMatch(VERSION_RE);
    expect(V).toBe('2026-10-21');
    expect(currentVersion('health:cycle')).toBe(LEGAL_VERSIONS.health);
    expect(currentVersion('policy-ack')).toBe(LEGAL_VERSIONS.policy);
  });

  it('the current version of a document is the newest released one; released lists are sorted, valid and unique', () => {
    for (const [doc, vs] of Object.entries(RELEASED_VERSIONS)) {
      expect(vs.length).toBeGreaterThan(0);
      expect([...vs]).toEqual([...vs].sort());
      expect(new Set(vs).size).toBe(vs.length);
      for (const v of vs) expect(v).toMatch(VERSION_RE);
      expect(LEGAL_VERSIONS[doc as keyof typeof LEGAL_VERSIONS]).toBe(vs[vs.length - 1]);
    }
    expect(documentOf('health:nutrition')).toBe('health');
    expect(documentOf('age-18')).toBe('age');
    expect(documentOf('trainer-terms')).toBe('trainer-terms');
  });
});

describe('consentState / hasConsent (latest record wins)', () => {
  it('is none without records', () => {
    expect(consentState([], 'atlas-ai')).toBe('none');
    expect(hasConsent([], 'atlas-ai')).toBe(false);
    expect(latestRecord([], 'atlas-ai')).toBeNull();
  });

  it('grant then withdraw is withdrawn; withdraw then grant is granted, whatever the array order', () => {
    const g = rec('geo-search', 'grant', 10);
    const w = rec('geo-search', 'withdraw', 20);
    expect(consentState([g, w], 'geo-search')).toBe('withdrawn');
    expect(consentState([w, g], 'geo-search')).toBe('withdrawn');
    const g2 = rec('geo-search', 'grant', 30);
    expect(consentState([w, g2, g], 'geo-search')).toBe('granted');
    expect(hasConsent([w, g2, g], 'geo-search')).toBe(true);
  });

  it('breaks an `at` tie by id, deterministically', () => {
    const a: ConsentRecord = { ...rec('atlas-ai', 'grant', 5), id: '5-a' };
    const b: ConsentRecord = { ...rec('atlas-ai', 'withdraw', 5), id: '5-b' };
    expect(consentState([a, b], 'atlas-ai')).toBe('withdrawn');
    expect(consentState([b, a], 'atlas-ai')).toBe('withdrawn');
  });

  it('ignores other kinds', () => {
    expect(hasConsent([rec('atlas-puter', 'grant', 1)], 'atlas-ai')).toBe(false);
  });
});

describe('isStale', () => {
  it('is stale when granted at an older version', () => {
    const old = rec('atlas-ai', 'grant', 1, '2025-01-01');
    expect(isStale([old], 'atlas-ai')).toBe(true);
    expect(hasConsent([old], 'atlas-ai')).toBe(true);
    expect(hasCurrentConsent([old], 'atlas-ai')).toBe(false);
  });

  it('is NOT stale when the stored version is newer than this build knows (older app, newer data)', () => {
    const newer = rec('atlas-ai', 'grant', 1, '2099-01-01');
    expect(isStale([newer], 'atlas-ai')).toBe(false);
    expect(hasCurrentConsent([newer], 'atlas-ai')).toBe(true);
    expect(
      needsLegalGate([
        ...allRequired().filter((r) => r.kind !== 'terms'),
        rec('terms', 'grant', 5, '2099-01-01'),
      ]),
    ).toBe(false);
  });

  it('is not stale at the current version, when withdrawn, or when never asked', () => {
    expect(isStale([rec('atlas-ai', 'grant', 1)], 'atlas-ai')).toBe(false);
    expect(isStale([rec('atlas-ai', 'withdraw', 1, '2025-01-01')], 'atlas-ai')).toBe(false);
    expect(isStale([], 'atlas-ai')).toBe(false);
  });

  it('re-granting at the current version clears it', () => {
    const rs = [rec('terms', 'grant', 1, '2025-01-01'), rec('terms', 'grant', 2)];
    expect(isStale(rs, 'terms')).toBe(false);
    expect(hasCurrentConsent(rs, 'terms')).toBe(true);
  });
});

describe('needsLegalGate', () => {
  it('is true for a user with no records', () => {
    expect(needsLegalGate([])).toBe(true);
  });

  it('is false once all three required kinds are granted at the current version', () => {
    expect(needsLegalGate(allRequired())).toBe(false);
  });

  it('is true when any one required kind is missing', () => {
    for (const missing of REQUIRED_KINDS)
      expect(needsLegalGate(allRequired().filter((r) => r.kind !== missing))).toBe(true);
  });

  it('is true when one is stale or withdrawn', () => {
    const stale = [...allRequired(), rec('policy-ack', 'grant', 9, '2025-01-01')];
    // a stale version the changelog does not explain asks again with the full gate (the real changelog now explains it)
    expect(needsLegalGate(stale, { versions: LEGAL_VERSIONS, changelog: [] })).toBe(true);
    const withdrawn = [...allRequired(), rec('age-18', 'withdraw', 9)];
    expect(needsLegalGate(withdrawn)).toBe(true);
  });

  it('ignores optional kinds', () => {
    expect(needsLegalGate([...allRequired(), rec('atlas-ai', 'withdraw', 9)])).toBe(false);
    expect(needsLegalGate([rec('atlas-ai', 'grant', 1)])).toBe(true);
  });
});

describe('optionalConsentOn', () => {
  it('is off with no record, on after a current grant, off after a withdraw or a stale grant', () => {
    expect(optionalConsentOn([], 'atlas-ai')).toBe(false);
    expect(optionalConsentOn([rec('atlas-ai', 'grant', 1)], 'atlas-ai')).toBe(true);
    expect(
      optionalConsentOn([rec('atlas-ai', 'grant', 1), rec('atlas-ai', 'withdraw', 2)], 'atlas-ai'),
    ).toBe(false);
    expect(optionalConsentOn([rec('geo-search', 'grant', 1, '2000-01-01')], 'geo-search')).toBe(
      false,
    );
  });
  it('is per kind, and never true for a required kind', () => {
    expect(optionalConsentOn([rec('health:cycle', 'grant', 1)], 'health:injuries')).toBe(false);
    expect(optionalConsentOn(allRequired(), 'terms')).toBe(false);
  });
});
