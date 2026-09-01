import { useStore } from '../store';
import type { Lang } from '../types';
import { en, type Strings } from './en';
import { uk } from './uk';
import { pl } from './pl';
import { lt } from './lt';
import { et } from './et';

const DICTS: Record<Lang, Strings> = { en, uk, pl, lt, et };

export const LANGS: { id: Lang; flag: string; label: string }[] = [
  { id: 'en', flag: '🇬🇧', label: 'English' },
  { id: 'uk', flag: '🇺🇦', label: 'Українська' },
  { id: 'pl', flag: '🇵🇱', label: 'Polski' },
  { id: 'lt', flag: '🇱🇹', label: 'Lietuvių' },
  { id: 'et', flag: '🇪🇪', label: 'Eesti' },
];

export type TFn = (key: keyof Strings, vars?: Record<string, string | number>) => string;

export function translate(lang: Lang, key: keyof Strings, vars?: Record<string, string | number>): string {
  let s: string = DICTS[lang][key] ?? en[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}

export function useT(): { t: TFn; lang: Lang } {
  const { lang } = useStore();
  const t: TFn = (key, vars) => translate(lang, key, vars);
  return { t, lang };
}
