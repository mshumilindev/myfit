import type { LocaleId } from '../i18n';
import { en } from './strings.en';
import { et } from './strings.et';
import { lt } from './strings.lt';
import { pl } from './strings.pl';
import type { PlannerStrings } from './strings.types';
import { uk } from './strings.uk';

export type { PlannerStrings } from './strings.types';

/** Planner's own words live in its chunk, not in the core i18n (add-on boundary). One file per language. */
export const STRINGS: Record<LocaleId, PlannerStrings> = { en, uk, pl, lt, et };

export const fill = (s: string, v: Record<string, string | number>): string =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''));
