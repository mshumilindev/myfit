/**
 * Contracts of the legal texts (SPO-295 N2): no raw draft markup reaches a reader, the three languages have the same
 * structure, the pending list matches the texts. The last test PRINTS the open items (it never fails): the release
 * blocker made visible.
 */
import { describe, expect, it } from 'vitest';
import { LEGAL_LOCALES, isLegalFallback, legalTexts } from '../i18n/legal';
import { legalTrainerTexts } from '../i18n/legalTrainer';
import type { DocBlock, LegalTexts } from '../i18n/legal';
import { LEGAL_VERSIONS } from './consents';
import { PENDING, TRANSLATION_REVIEW } from './pending';
import { docVersion, fmtVersionDate } from './docVersion';
import { legalRoute } from './route';

const strings = (b: DocBlock): string[] =>
  'p' in b ? [b.p] : 'ul' in b ? [...b.ul] : [...b.table.head, ...b.table.rows.flat()];

function allText(t: LegalTexts): string[] {
  const out: string[] = [];
  for (const v of Object.values(t.ui)) out.push(typeof v === 'function' ? v('X') : v);
  for (const doc of [t.privacy, t.terms]) {
    out.push(doc.title);
    for (const s of doc.sections) out.push(s.title, ...s.body.flatMap(strings));
  }
  return out;
}

const shape = (b: DocBlock): string =>
  'p' in b
    ? 'p'
    : 'ul' in b
      ? `ul${b.ul.length}`
      : `t${b.table.head.length}x${b.table.rows.length}`;

const LOCALES = Object.keys(LEGAL_LOCALES) as (keyof typeof LEGAL_LOCALES)[];

describe('legal texts: guards', () => {
  it.each(LOCALES)('%s: no draft markup ({{ }}) and no stray bold markers', (l) => {
    for (const s of allText(legalTexts(l))) {
      expect(s, s).not.toMatch(/\{\{|\}\}/);
      expect(s, s).not.toMatch(/ПОТРІБНО|ЗАЛЕЖИТЬ|ЮРИСТ/);
      expect((s.match(/\*\*/g) ?? []).length % 2, s).toBe(0);
    }
  });

  it.each(LOCALES)('%s: no Contact link, no end-to-end or "we cannot see" overclaims', (l) => {
    for (const s of allText(legalTexts(l))) {
      expect(s).not.toMatch(/mailto:|href=/i);
    }
    const body = allText(legalTexts(l)).join('\n');
    // the draft says it is NOT end-to-end against us; that sentence is the only place the word may appear
    for (const line of body.split('\n').filter((x) => /end-to-end|наскрізн/i.test(x))) {
      expect(line).toMatch(/not end-to-end|не наскрізне|nie szyfrowanie end-to-end/i);
    }
  });

  it.each(LOCALES)('%s: controller line, 18+, and no invented email address', (l) => {
    const t = legalTexts(l);
    const text = allText(t).join('\n');
    expect(text).toContain('Mykola Volodymyrovych Lukianov');
    expect(text).toContain('Bukowińska 17/1005');
    expect(text).toMatch(/18/);
    expect(text).not.toMatch(/[\w.-]+@[\w.-]+\.\w+/);
  });

  it('uk and pl have the same sections, ids and block shapes as the English text', () => {
    const en = legalTexts('en');
    for (const l of ['uk', 'pl'] as const) {
      const t = legalTexts(l);
      for (const d of ['privacy', 'terms'] as const) {
        expect(t[d].sections.map((s) => s.id)).toEqual(en[d].sections.map((s) => s.id));
        expect(t[d].sections.map((s) => s.body.map(shape))).toEqual(
          en[d].sections.map((s) => s.body.map(shape)),
        );
        // the same numbers survive translation (retention days, article numbers)
        const nums = (x: LegalTexts) =>
          x[d].sections
            .flatMap((s) => s.body.flatMap(strings))
            .join(' ')
            .match(/\b(400|90|30|180|18)\b/g);
        expect(nums(t)).toEqual(nums(en));
      }
      expect(typeof t.ui.version('v')).toBe('string');
    }
  });

  it('section ids are unique and anchors are plain tokens', () => {
    for (const d of ['privacy', 'terms'] as const) {
      const ids = legalTexts('en')[d].sections.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^[pt]\d+$/);
    }
  });

  it('lt and et read the English document (no texts are written for them)', () => {
    expect(isLegalFallback('lt')).toBe(true);
    expect(isLegalFallback('et')).toBe(true);
    expect(legalTexts('lt')).toBe(legalTexts('en'));
    expect(isLegalFallback('uk')).toBe(false);
  });

  it('version and date come from LEGAL_VERSIONS', () => {
    expect(docVersion('privacy')).toBe(LEGAL_VERSIONS.policy);
    expect(docVersion('terms')).toBe(LEGAL_VERSIONS.terms);
    expect(fmtVersionDate('2026-10-21', 'en')).toBe('21 October 2026');
    expect(fmtVersionDate('2026-10-21', 'pl')).toMatch(/21 października 2026/);
    expect(fmtVersionDate('2026-10-21', 'uk')).toMatch(/21 жовтня 2026/);
  });

  it('routes: only /privacy, /terms, /trainer-terms and /dpa are legal pages', () => {
    expect(legalRoute('#/privacy')).toBe('privacy');
    expect(legalRoute('#/terms/')).toBe('terms');
    expect(legalRoute('#/privacy?x=1')).toBe('privacy');
    expect(legalRoute('#/trainer-terms')).toBe('trainer-terms');
    expect(legalRoute('#/dpa/')).toBe('dpa');
    expect(legalRoute('#/privacy-settings')).toBeNull();
    expect(legalRoute('#/dpa-x')).toBeNull();
    expect(legalRoute('#/today')).toBeNull();
    expect(legalRoute('')).toBeNull();
  });
});

describe('legal pending items', () => {
  it('ids are unique and every item points at a real section of its document', () => {
    expect(new Set(PENDING.map((p) => p.id)).size).toBe(PENDING.length);
    const en = legalTexts('en');
    for (const p of PENDING) {
      const trainer = legalTrainerTexts('en');
      const doc =
        p.doc === 'trainer-terms'
          ? trainer.trainerTerms
          : p.doc === 'dpa'
            ? trainer.dpa
            : en[p.doc === 'privacy' ? 'privacy' : 'terms'];
      const ids = ['header', ...doc.sections.map((s) => s.id)];
      expect(ids, p.id).toContain(p.section);
      expect(p.note.length, p.id).toBeGreaterThan(10);
    }
  });

  it('REPORT (never fails): open items that block publication', () => {
    const lines = PENDING.map(
      (p) => `  [${p.kind.padEnd(7)}] ${p.doc}/${p.section} ${p.id}: ${p.note}`,
    );
    const byKind = (k: string) => PENDING.filter((p) => p.kind === k).length;
    console.warn(
      `LEGAL RELEASE BLOCKERS: ${PENDING.length} open (owner ${byKind('owner')}, depends ${byKind('depends')}, lawyer ${byKind('lawyer')}); ` +
        `translations needing review: ${TRANSLATION_REVIEW.join(', ')}\n${lines.join('\n')}`,
    );
    expect(Array.isArray(PENDING)).toBe(true);
  });
});
