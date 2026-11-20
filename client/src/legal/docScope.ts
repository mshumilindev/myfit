/**
 * "Only what applies to you" in the Privacy Policy and Terms pages opened from inside the app (SPO-571 P5, owner decision
 * 11.11.2026: documents show only what is installed). A LENS on the one full text, never a second document:
 *  - the version, the consent hash (`docPlainText`) and the acceptance at the gate always use the full text;
 *  - the public page (not opened from the app) shows the full text;
 *  - section numbers stay as in the full text (the text refers to "section 7"), so a hidden section leaves a gap.
 * A part shows when ANY of its owner add-ons is available (`useAddonAvailable`: installed, base for the role, or an id the store does not offer).
 * Parts that no rule names are core and always show. Pure: no React, no storage.
 */
import type { DocBlock, DocSectionText } from '../i18n/legal.types';

export type ScopedDoc = 'privacy' | 'terms';

/** The health features' add-ons (nutrition is "soon" and is never a reason to show or hide anything). */
export const HEALTH_OWNERS = [
  'health',
  'injury-log',
  'conditions',
  'cycle',
  'supplements',
  'nicotine',
  'alcohol',
] as const;

export interface ScopeRule {
  doc: ScopedDoc;
  section: string;
  /** Without `block`: the whole section. */
  block?: number;
  /** A table row of block `block`, or a bullet of its list. */
  row?: number;
  item?: number;
  owners: readonly string[];
}

/**
 * Only processing that STOPS with the add-on is narrowed (reviewer finding, 20.11): Atlas AI sending is a consent that
 * is withdrawn on removal, availability sharing is revoked on removal. Everything an add-on STORES stays in the account
 * after removal (addons.md: data is kept), so what describes stored data, its retention and the health consents is
 * always shown, whatever is installed (Art. 13: the person must be able to read about the data held about them).
 */
export const DOC_SCOPE: readonly ScopeRule[] = [
  // Privacy Policy 3: availability shared with the trainer (revoked when the Planner goes) and the Atlas AI chat
  { doc: 'privacy', section: 'p3', block: 0, row: 6, owners: ['planner-availability'] },
  { doc: 'privacy', section: 'p3', block: 0, row: 11, owners: ['atlas'] },
  // 7 Atlas AI chat (whole section; "see section 7" in row 11 goes with it)
  { doc: 'privacy', section: 'p7', owners: ['atlas'] },
];

export interface ScopedSection {
  /** The section's number in the FULL document (1-based). */
  num: number;
  section: DocSectionText;
}

const hides = (r: ScopeRule, available: (id: string) => boolean): boolean =>
  !r.owners.some((o) => available(o));

function filterBlock(
  b: DocBlock,
  blockIndex: number,
  rules: readonly ScopeRule[],
  available: (id: string) => boolean,
): DocBlock {
  const mine = rules.filter((r) => r.block === blockIndex && hides(r, available));
  if (!mine.length) return b;
  if ('table' in b) {
    const gone = new Set(mine.map((r) => r.row));
    return { table: { head: b.table.head, rows: b.table.rows.filter((_, i) => !gone.has(i)) } };
  }
  if ('ul' in b) {
    const gone = new Set(mine.map((r) => r.item));
    return { ul: b.ul.filter((_, i) => !gone.has(i)) };
  }
  return b;
}

/** The sections of a document that apply, with their numbers in the full text. */
export function scopeSections(
  doc: ScopedDoc,
  sections: readonly DocSectionText[],
  available: (id: string) => boolean,
): ScopedSection[] {
  const rules = DOC_SCOPE.filter((r) => r.doc === doc);
  const out: ScopedSection[] = [];
  sections.forEach((s, i) => {
    const own = rules.filter((r) => r.section === s.id);
    if (own.some((r) => r.block === undefined && hides(r, available))) return;
    out.push({
      num: i + 1,
      section: { ...s, body: s.body.map((b, bi) => filterBlock(b, bi, own, available)) },
    });
  });
  return out;
}

/** True when the lens hides something for this person (so the page offers "show everything"). */
export function scopeHidesAnything(
  doc: ScopedDoc,
  sections: readonly DocSectionText[],
  available: (id: string) => boolean,
): boolean {
  return DOC_SCOPE.some((r) => r.doc === doc && hides(r, available)) && sections.length > 0;
}
