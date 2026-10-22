/** Shapes of the Privacy Policy / Terms of Use texts (SPO-295 N2). Dictionaries: legal.en.ts, legal.uk.ts, legal.pl.ts. */

/** A block of a section: a paragraph, a bullet list or a table. Inline `**bold**` is allowed in every string. */
export type DocBlock =
  | { p: string }
  | { ul: readonly string[] }
  | { table: { head: readonly string[]; rows: readonly (readonly string[])[] } };

export interface DocSectionText {
  /** Anchor id; the same in every language (pending items and links refer to it). */
  id: string;
  title: string;
  body: readonly DocBlock[];
}

export interface LegalDocText {
  title: string;
  sections: readonly DocSectionText[];
}

export interface LegalUi {
  brandLabel: string;
  contents: string;
  save: string;
  print: string;
  saveHint: string;
  version: (v: string) => string;
  updated: (date: string) => string;
  /** Name of the footer nav landmark. */
  legalNav: string;
  privacyLink: string;
  termsLink: string;
  /** Shown only when the page falls back to English (lt, et). */
  englishOnlyNote: string;
}

export interface LegalTexts {
  ui: LegalUi;
  privacy: LegalDocText;
  terms: LegalDocText;
}
