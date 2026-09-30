/**
 * Shared bits of the Health page: the design's inline stroke icons (1.75px,
 * currentColor — copied from docs/design/health), date formatting and the
 * labels every screen uses for periods and injuries.
 */
import type { ReactNode } from 'react';
import type { LocaleId } from '../../i18n';
import type { Strings } from '../../i18n/en';
import type { IllnessKind, Injury, RestMode, RestPeriod } from '../../types';
import { dayToTs, type HealthItem, type HealthKind } from '../../health';
import { REHAB_STAGES, stageIndex } from '../../injury';
import { IconTile } from '../../components/ui/IconTile';
import type { Tone as KitTone } from '../../components/ui/tones';

const PATHS: Record<string, ReactNode> = {
  chev: <path d="M9 6l6 6-6 6" />,
  back: <path d="M15 6l-6 6 6 6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  thermo: <path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z" />,
  bandage: (
    <>
      <rect x="2.5" y="8" width="19" height="8" rx="4" transform="rotate(-45 12 12)" />
      <path d="M10.5 10.5h.01M13.5 13.5h.01M13.5 10.5h.01M10.5 13.5h.01" />
    </>
  ),
  bed: (
    <>
      <path d="M3 6v12M3 14h18v4M21 14v-1.5a3 3 0 0 0-3-3h-7.5V14" />
      <circle cx="6.8" cy="11" r="1.6" />
    </>
  ),
  pulse: <path d="M3 12h4l3-7 4 14 3-7h4" />,
  moon: <path d="M19.5 14.5A7.5 7.5 0 1 1 9.5 4.5a6 6 0 0 0 10 10z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  calClock: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="M12 13.5v2.5l1.5 1" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  pause: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10 9v6M14 9v6" />
    </>
  ),
  bellOff: (
    <path d="M6.5 10a5.5 5.5 0 0 1 9.4-3.9M17.5 11v3l1.5 2H8M10 19a2 2 0 0 0 4 0M4 4l16 16" />
  ),
  bell: (
    <>
      <path d="M6.5 10a5.5 5.5 0 0 1 11 0v4l1.5 2.5h-14L6.5 14z" />
      <path d="M10 19.5a2 2 0 0 0 4 0" />
    </>
  ),
  dumbbell: <path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
    </>
  ),
  pencil: <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />,
  trash: <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" />,
};

export function Svg({ name, className }: { name: string; className?: string }) {
  return (
    <svg
      className={`hl-i${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

export function Chev() {
  return <Svg name="chev" className="hl-chev" />;
}

export type Tone = 'rest' | 'act' | 'ill' | 'inj' | 'slp' | 'neu' | 'gym';

/** Period colour family: full rest blue, active recovery teal, illness amber,
 *  injury warm red. */
export type PeriodTone = 'rest' | 'act' | 'ill' | 'inj';

/** Page tone → kit colour family (tokens in styles.css :root). */
export const KIT_TONE: Record<Tone, KitTone> = {
  rest: 'rest',
  act: 'active',
  ill: 'illness',
  inj: 'injury',
  slp: 'sleep',
  neu: 'neutral',
  gym: 'accent',
};

export function Ic({ tone, name, size = 30 }: { tone: Tone; name: string; size?: 30 | 36 }) {
  return (
    <IconTile tone={KIT_TONE[tone]} size={size}>
      <Svg name={name} />
    </IconTile>
  );
}

/** Form / period type: the three rest modes plus an injury. */
export type HealthType = RestMode | 'injury';

export function toneOf(type: HealthType | HealthKind): PeriodTone {
  if (type === 'illness') return 'ill';
  if (type === 'injury') return 'inj';
  if (type === 'active') return 'act';
  return 'rest';
}

/** Tone of a history item (a rest item is blue or teal by its mode). */
export function itemTone(it: HealthItem): PeriodTone {
  return it.mode ? toneOf(it.mode) : toneOf(it.kind);
}

export function iconOf(type: HealthType): string {
  if (type === 'illness') return 'thermo';
  if (type === 'injury') return 'bandage';
  if (type === 'active') return 'pulse';
  return 'bed';
}

export function typeName(type: HealthType, t: Strings): string {
  if (type === 'off') return t.hlFullRest;
  if (type === 'active') return t.restModeActive;
  if (type === 'illness') return t.restModeIllness;
  return t.hlFilter.injury;
}

export function illnessKindName(k: IllnessKind, t: Strings): string {
  if (k === 'cold') return t.illKindCold;
  if (k === 'virus') return t.illKindVirus;
  if (k === 'stomach') return t.illKindStomach;
  if (k === 'mental') return t.illKindMental;
  return t.illKindOther;
}

export const ILLNESS_KIND_ICON: Record<IllnessKind, string> = {
  cold: 'snowflake',
  virus: 'virus',
  stomach: 'drop',
  mental: 'brain',
  other: 'question',
};

/** The name shown for a period: the one the user typed, else (for illness) the
 *  kind picked under "What is it", else the plain type name. */
export function periodLabel(p: RestPeriod, t: Strings): string {
  const typed = p.name?.trim();
  if (typed) return typed;
  if (p.mode === 'illness' && p.illnessKind && p.illnessKind !== 'other')
    return illnessKindName(p.illnessKind, t);
  return typeName(p.mode, t);
}

export function injuryLabel(i: Injury, t: Strings): string {
  if (i.reason !== 'injury' || !i.bodyPart) return t.injReason[i.reason] ?? t.hlFilter.injury;
  const part = t.injBodyParts[i.bodyPart] ?? i.bodyPart;
  return t.hlInjuryName(part, i.side ?? 'both');
}

export function itemLabel(it: HealthItem, t: Strings): string {
  if (it.injury) return injuryLabel(it.injury, t);
  return it.period ? periodLabel(it.period, t) : '';
}

export function stageNo(i: Injury): number {
  return stageIndex(i.stage) + 1;
}
export const STAGE_TOTAL = REHAB_STAGES.length;

// --- dates ---------------------------------------------------------------------

/** Month / weekday names per locale; en uses en-US names ("Sep", not en-GB
 *  "Sept") but the design's day-month order ("Sat 12 Sep", "12–18 Sep"). */
const INTL: Record<LocaleId, string> = {
  en: 'en-US',
  uk: 'uk-UA',
  pl: 'pl-PL',
  lt: 'lt-LT',
  et: 'et-EE',
};

function dateOf(day: number): Date {
  return new Date(dayToTs(day));
}

function yearOf(day: number): number {
  return dateOf(day).getFullYear();
}

function mon(day: number, locale: LocaleId): string {
  return new Intl.DateTimeFormat(INTL[locale], { month: 'short' }).format(dateOf(day));
}

/** Month (+ year when it isn't this year's). */
function monY(day: number, locale: LocaleId, today: number): string {
  return yearOf(day) === yearOf(today) ? mon(day, locale) : `${mon(day, locale)} ${yearOf(day)}`;
}

/** "Sat" */
export function fmtWd(day: number, locale: LocaleId): string {
  return new Intl.DateTimeFormat(INTL[locale], { weekday: 'short' })
    .format(dateOf(day))
    .replace('.', '');
}

/** "Sat 12 Sep" */
export function fmtDay(day: number, locale: LocaleId, today: number): string {
  return `${fmtWd(day, locale)} ${dateOf(day).getDate()} ${monY(day, locale, today)}`;
}

/** "12 Sep" */
export function fmtDM(day: number, locale: LocaleId, today: number): string {
  return `${dateOf(day).getDate()} ${monY(day, locale, today)}`;
}

/** "1 Jun 2026" */
export function fmtDMY(day: number, locale: LocaleId): string {
  return `${dateOf(day).getDate()} ${mon(day, locale)} ${yearOf(day)}`;
}

function sameMonth(a: number, b: number): boolean {
  const x = dateOf(a);
  const y = dateOf(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth();
}

/** "12–18 Sep", "28 Sep – 2 Oct", or one day. */
export function fmtRange(a: number, b: number, locale: LocaleId, today: number): string {
  if (a === b) return fmtDM(a, locale, today);
  if (sameMonth(a, b)) return `${dateOf(a).getDate()}–${fmtDM(b, locale, today)}`;
  return `${fmtDM(a, locale, today)} – ${fmtDM(b, locale, today)}`;
}

/** "Thu 24 – Sat 26 Sep" — a range with weekdays (the recovered sheet). */
export function fmtRangeWd(a: number, b: number, locale: LocaleId, today: number): string {
  if (a === b) return fmtDay(a, locale, today);
  if (sameMonth(a, b))
    return `${fmtWd(a, locale)} ${dateOf(a).getDate()} – ${fmtDay(b, locale, today)}`;
  return `${fmtDay(a, locale, today)} – ${fmtDay(b, locale, today)}`;
}

/** "September 2026" */
export function fmtMonthYear(y: number, m: number, locale: LocaleId): string {
  const s = new Intl.DateTimeFormat(INTL[locale], { month: 'long', year: 'numeric' }).format(
    new Date(y, m, 1),
  );
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "September" */
export function fmtMonth(ts: number, locale: LocaleId): string {
  const s = new Intl.DateTimeFormat(INTL[locale], { month: 'long' }).format(new Date(ts));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** One-letter weekday column heads in week order. */
export function weekHeads(order: number[], locale: LocaleId): string[] {
  const f = new Intl.DateTimeFormat(INTL[locale], { weekday: 'narrow' });
  // 5 Jan 2026 is a Monday (ISO 1).
  return order.map((iso) => f.format(new Date(2026, 0, 4 + iso)));
}

/** "12–13 and 15–18 Sep" — natural list of day ranges. */
export function fmtRangeList(ranges: [number, number][], locale: LocaleId, today: number): string {
  const parts = ranges.map(([a, b]) => fmtRange(a, b, locale, today));
  return new Intl.ListFormat(INTL[locale], { type: 'conjunction' }).format(parts);
}

export function hhmm(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
