/** Plural helpers for the Coach dictionary (no imports from the dictionaries: they use these). */
// Same ids as `LocaleId` in ./index, declared here so the dictionaries can import this file without a cycle.
type LocaleId = 'en' | 'uk' | 'pl' | 'lt' | 'et';

export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

const BCP47: Record<LocaleId, string> = {
  en: 'en',
  uk: 'uk',
  pl: 'pl',
  lt: 'lt',
  et: 'et',
};

const rules = new Map<LocaleId, Intl.PluralRules>();

/** CLDR plural category of `n` in `locale`. */
export function pluralCategory(locale: LocaleId, n: number): Intl.LDMLPluralRule {
  let r = rules.get(locale);
  if (!r) {
    r = new Intl.PluralRules(BCP47[locale]);
    rules.set(locale, r);
  }
  return r.select(n);
}

/** Pick the form for `n`; a missing category falls back to `other`. `{n}` in the form is replaced by the count. */
export function plural(locale: LocaleId, n: number, forms: PluralForms): string {
  const form = forms[pluralCategory(locale, n)] ?? forms.other;
  return form.replace('{n}', String(n));
}
