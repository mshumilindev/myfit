/**
 * Small shared helpers for the Log activity page and its Quick-log panel.
 */
import { useEffect, useState } from 'react';
import {
  ACTIVITY_TYPES,
  activityTone,
  activityType,
  durationMin,
  type ActivityType,
} from '../../activities';
import { dayStart } from '../../activitySuggest';
import { fmtDayMonth, fmtWeekdayShort, type LocaleId } from '../../i18n';
import type { Strings } from '../../i18n/en';
import type { Activity } from '../../types';

import { firstOrder } from '../../accountOverrides';
import type { Tone } from '../../components/ui/tones';

export type CatId = 'conditioning' | 'sport' | 'recovery';
export const CATS: CatId[] = ['conditioning', 'sport', 'recovery'];

/** The three browse groups, in catalog order (sports split out of conditioning). */
export function catTypes(cat: CatId): ActivityType[] {
  return firstOrder(
    ACTIVITY_TYPES.filter((a) => (cat === 'sport' ? a.sport : !a.sport && a.category === cat)),
  );
}

export function catOf(key: string): CatId {
  const t = activityType(key);
  if (!t) return 'sport';
  return t.sport ? 'sport' : t.category;
}

export function catName(cat: CatId, t: Strings): string {
  return cat === 'sport' ? t.actSports : cat === 'recovery' ? t.actRecovery : t.actConditioning;
}

/** Colour family class: gold conditioning, green sports, blue recovery. */
export function toneClass(key: string): string {
  const t = activityType(key);
  const tone = t ? activityTone(key, t.category) : 'sport';
  return tone === 'sport' ? 'la-s' : tone === 'recovery' ? 'la-r' : 'la-g';
}
export function catTone(cat: CatId): string {
  return cat === 'sport' ? 'la-s' : cat === 'recovery' ? 'la-r' : 'la-g';
}

/** The same families as kit tones (components/ui/tones.ts). */
export function kitTone(key: string): Tone {
  return KIT_OF[toneClass(key)];
}
export function catKitTone(cat: CatId): Tone {
  return KIT_OF[catTone(cat)];
}
export const KIT_OF: Record<string, Tone> = { 'la-g': 'accent', 'la-s': 'sport', 'la-r': 'rest' };

export function typeName(key: string, t: Strings): string {
  return t.actType[key] ?? key;
}

export function typeIcon(key: string): string {
  return activityType(key)?.icon ?? 'heartbeat';
}

/** "20 min" / "2 h" / "1 h 15 min". */
export function fmtDur(min: number, t: Strings): string {
  return `${Math.max(0, Math.round(min))} ${t.minShort}`;
}

/** Suggestion wording (design: "~2 h", "Log 2 h", "Sauna 20 min"): hours from an hour up. */
export function fmtApprox(min: number, t: Strings): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} ${t.minShort}`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} ${t.hrShort} ${r} ${t.minShort}` : `${h} ${t.hrShort}`;
}

export function hhmm(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function minToHhmm(n: number): string {
  const m = ((Math.round(n) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** "today" / "Thu" (this week) / "17 Sep". */
export function relDay(ts: number, now: number, t: Strings, locale: LocaleId): string {
  const days = Math.round((dayStart(now) - dayStart(ts)) / 86_400_000);
  if (days <= 0) return t.laTodayLower;
  if (days < 7) return fmtWeekdayShort(ts, locale);
  return fmtDayMonth(ts, locale);
}

/** "60 min · 17 Sep" / "5 km · Thu" — the last-logged meta on cards. */
export function lastMeta(
  a: Activity | undefined,
  now: number,
  t: Strings,
  locale: LocaleId,
  opts: { distanceFirst?: boolean } = {},
): string {
  if (!a) return '';
  const when = relDay(a.startedAt, now, t, locale);
  const lead =
    opts.distanceFirst && a.distanceKm
      ? `${fmtKm(a.distanceKm)} ${t.laKm}`
      : fmtDur(durationMin(a), t);
  return `${lead} · ${when}`;
}

export function fmtKm(km: number): string {
  return (Math.round(km * 10) / 10).toString();
}

/** Ticking clock: every second while `fast`, else every 30 s. */
export function useNow(fast: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = window.setInterval(() => setNow(Date.now()), fast ? 1000 : 30_000);
    return () => window.clearInterval(iv);
  }, [fast]);
  return now;
}

/** "42:10" / "1:02:03". */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(r).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

/** Wall-clock read for event handlers and the "ends in the future" check. */
export function nowMs(): number {
  return Date.now();
}
