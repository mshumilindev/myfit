/**
 * "Only what applies to you" in the Privacy Policy and Terms pages opened from inside the app (SPO-571 P5, owner decision
 * 11.11.2026: documents show only what is installed). A LENS on the one full text, never a second document:
 *  - the version, the consent hash (`docPlainText`) and the acceptance at the gate always use the full text;
 *  - the public page (not opened from the app) shows the full text;
 *  - section numbers stay as in the full text (the text refers to "section 7"), so a hidden section leaves a gap.
 * A part shows when ANY of its owner add-ons is available (`addonAvailable`: installed, base for the role, or "soon").
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

export const DOC_SCOPE: readonly ScopeRule[] = [
  // Privacy Policy 3: what data we process (table rows)
  { doc: 'privacy', section: 'p3', block: 0, row: 2, owners: HEALTH_OWNERS },
  { doc: 'privacy', section: 'p3', block: 0, row: 4, owners: ['coach-team'] },
  { doc: 'privacy', section: 'p3', block: 0, row: 5, owners: ['planner'] },
  { doc: 'privacy', section: 'p3', block: 0, row: 6, owners: ['planner-availability'] },
  { doc: 'privacy', section: 'p3', block: 0, row: 10, owners: ['atlas'] },
  { doc: 'privacy', section: 'p3', block: 0, row: 11, owners: ['atlas'] },
  // 6 health data and consent, 7 Atlas AI chat (whole sections)
  { doc: 'privacy', section: 'p6', owners: HEALTH_OWNERS },
  { doc: 'privacy', section: 'p7', owners: ['atlas'] },
  // 8 how long we keep data (bullets)
  { doc: 'privacy', section: 'p8', block: 0, item: 2, owners: ['atlas'] },
  { doc: 'privacy', section: 'p8', block: 0, item: 7, owners: ['planner'] },
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
