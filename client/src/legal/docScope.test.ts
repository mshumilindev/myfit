import { describe, expect, it } from 'vitest';
import { legalEn } from '../i18n/legal.en';
import { legalPl } from '../i18n/legal.pl';
import { legalUk } from '../i18n/legal.uk';
import { ADDONS as MANIFEST } from '../addons/manifest';
import { docPlainText } from './textHash';
import { DOC_SCOPE, HEALTH_OWNERS, scopeHidesAnything, scopeSections } from './docScope';

const LOCALES = { en: legalEn, uk: legalUk, pl: legalPl };
const all = () => true;
const none = () => false;
const only =
  (...ids: string[]) =>
  (id: string) =>
    ids.includes(id);

describe('document lens (SPO-571 P5)', () => {
  it('every rule points at a real section, block and row/item in EVERY language', () => {
    for (const [loc, lg] of Object.entries(LOCALES)) {
      for (const r of DOC_SCOPE) {
        const s = lg[r.doc].sections.find((x) => x.id === r.section);
        expect(s, `${loc} ${r.doc} ${r.section}`).toBeTruthy();
        if (r.block === undefined) continue;
        const b = s!.body[r.block];
        if (r.row !== undefined) {
          expect(
            'table' in b && b.table.rows.length > r.row,
            `${loc} ${r.section} row ${r.row}`,
          ).toBe(true);
        }
        if (r.item !== undefined) {
          expect('ul' in b && b.ul.length > r.item, `${loc} ${r.section} item ${r.item}`).toBe(
            true,
          );
        }
      }
    }
  });

  it('rows and bullets have the same count in every language (a mapping that fits one fits all)', () => {
    for (const r of DOC_SCOPE) {
      if (r.block === undefined) continue;
      const sizes = Object.values(LOCALES).map((lg) => {
        const b = lg[r.doc].sections.find((x) => x.id === r.section)!.body[r.block!];
        return 'table' in b ? b.table.rows.length : 'ul' in b ? b.ul.length : -1;
      });
      expect(new Set(sizes).size).toBe(1);
    }
  });

  it('every owner is a real add-on', () => {
    const ids = new Set(MANIFEST.map((m) => m.id));
    for (const r of DOC_SCOPE) for (const o of r.owners) expect(ids.has(o), o).toBe(true);
    for (const o of HEALTH_OWNERS) expect(ids.has(o), o).toBe(true);
  });

  it('with everything available the lens changes nothing', () => {
    const out = scopeSections('privacy', legalEn.privacy.sections, all);
    expect(out.map((s) => s.num)).toEqual(legalEn.privacy.sections.map((_, i) => i + 1));
    expect(docPlainText({ title: 't', sections: out.map((s) => s.section) })).toBe(
      docPlainText({ title: 't', sections: legalEn.privacy.sections }),
    );
    expect(scopeHidesAnything('privacy', legalEn.privacy.sections, all)).toBe(false);
  });

  it('with nothing installed it hides the add-on parts and keeps the core and the numbers', () => {
    const out = scopeSections('privacy', legalEn.privacy.sections, none);
    const ids = out.map((s) => s.section.id);
    expect(ids).not.toContain('p6');
    expect(ids).not.toContain('p7');
    expect(ids).toContain('p1');
    expect(ids).toContain('p14'); // contact: core, and still section 14 (the text says "section 14")
    expect(out.find((s) => s.section.id === 'p14')!.num).toBe(14);
    const p3 = out.find((s) => s.section.id === 'p3')!.section.body[0];
    const text = JSON.stringify(p3);
    expect(text).not.toContain('Planner (only if you add it)');
    expect(text).not.toContain('Atlas AI chat (only if you turn it on)');
    expect(text).toContain('Account:');
    expect(scopeHidesAnything('privacy', legalEn.privacy.sections, none)).toBe(true);
  });

  it('a part shows when ANY of its owners is available', () => {
    const out = scopeSections('privacy', legalEn.privacy.sections, only('cycle', 'atlas'));
    const ids = out.map((s) => s.section.id);
    expect(ids).toContain('p6');
    expect(ids).toContain('p7');
    const p3 = JSON.stringify(out.find((s) => s.section.id === 'p3')!.section.body[0]);
    expect(p3).toContain('Health-related data');
    expect(p3).not.toContain('Planner (only if you add it)');
  });

  it('the Terms have no scoped parts yet and come out whole', () => {
    expect(scopeSections('terms', legalEn.terms.sections, none).length).toBe(
      legalEn.terms.sections.length,
    );
  });
});
