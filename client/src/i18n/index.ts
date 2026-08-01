import { useSyncExternalStore } from 'react';
import { en, type Strings } from './en';
import { uk } from './uk';
import { pl } from './pl';
import { lt } from './lt';
import { et } from './et';

export type LocaleId = 'en' | 'uk' | 'pl' | 'lt' | 'et';

export const LOCALES: Record<LocaleId, Strings> = { en, uk, pl, lt, et };
export const LOCALE_IDS: LocaleId[] = ['en', 'uk', 'pl', 'lt', 'et'];

export const FLAGS: Record<LocaleId, string> = {
  en: '\u{1F1EC}\u{1F1E7}',
  uk: '\u{1F1FA}\u{1F1E6}',
  pl: '\u{1F1F5}\u{1F1F1}',
  lt: '\u{1F1F1}\u{1F1F9}',
  et: '\u{1F1EA}\u{1F1EA}',
};

const LOCALE_KEY = 'gym.locale';

/**
 * IANA timezone → locale: a permissionless proxy for where the user physically
 * is. Beats browser language, because a user in Kyiv/Warsaw with an English
 * browser should still get their regional language on first run.
 */
const TZ_LOCALE: Record<string, LocaleId> = {
  'Europe/Kyiv': 'uk',
  'Europe/Kiev': 'uk',
  'Europe/Uzhgorod': 'uk',
  'Europe/Zaporozhye': 'uk',
  'Europe/Simferopol': 'uk',
  'Europe/Warsaw': 'pl',
  'Europe/Vilnius': 'lt',
  'Europe/Tallinn': 'et',
};

function fromTimezone(): LocaleId | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TZ_LOCALE[tz] ?? null;
  } catch {
    return null;
  }
}

function fromLanguages(): LocaleId | null {
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const raw of langs) {
    const l = (raw || '').toLowerCase();
    for (const id of LOCALE_IDS) if (l.startsWith(id)) return id;
  }
  return null;
}

/**
 * Order: saved choice → physical location (timezone) → browser language → en.
 * The manual selector (every screen) is always the override.
 */
function detect(): LocaleId {
  const stored = localStorage.getItem(LOCALE_KEY);
  if (stored && LOCALE_IDS.includes(stored as LocaleId)) return stored as LocaleId;
  return fromTimezone() ?? fromLanguages() ?? 'en';
}

let current: LocaleId = detect();
const listeners = new Set<() => void>();

export function setLocale(id: LocaleId): void {
  current = id;
  localStorage.setItem(LOCALE_KEY, id);
  document.documentElement.lang = id;
  listeners.forEach((l) => l());
}

export function getLocale(): LocaleId {
  return current;
}

/** Reactive hook: returns the active dictionary + locale id. */
export function useT(): { t: Strings; locale: LocaleId } {
  const locale = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
  return { t: LOCALES[locale], locale };
}

/** Non-reactive accessor for code outside React (store, formatters). */
export function t(): Strings {
  return LOCALES[current];
}

// --- Locale-aware formatters ----------------------------------------------

const dateLocale: Record<LocaleId, string> = {
  en: 'en-US',
  uk: 'uk-UA',
  pl: 'pl-PL',
  lt: 'lt-LT',
  et: 'et-EE',
};

/** Locale-natural full date with year: "Saturday, August 1, 2026" / "субота, 1 серпня 2026 р." */
export function fmtFullDate(ts: number, locale: LocaleId = current): string {
  return new Intl.DateTimeFormat(dateLocale[locale], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(ts));
}

/** "31 July" */
export function fmtDayMonth(ts: number, locale: LocaleId = current): string {
  return new Intl.DateTimeFormat(dateLocale[locale], {
    day: 'numeric',
    month: 'long',
  }).format(new Date(ts));
}

/** "29 JUL" (recent-row date badge) */
export function fmtShortDate(ts: number, locale: LocaleId = current): string {
  return new Intl.DateTimeFormat(dateLocale[locale], {
    day: '2-digit',
    month: 'short',
  })
    .format(new Date(ts))
    .toUpperCase()
    .replace('.', '');
}

/** "18:02" */
export function fmtClock(ts: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts));
}

/** Duration ms → "1:12" (h:mm) or "0:54". */
export function fmtDurationHM(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000));
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
}

/** Session clock ms → "24:18" or "8:00:00". */
export function fmtSessionClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

/** "1h 20m" (visit duration). */
export function fmtDurationHuman(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60000));
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Volume kg → "4 980 kg" (thin-space thousands) or "2.1 t" / "3.4 t". */
export function fmtKg(kg: number): string {
  const rounded = Math.round(kg);
  return `${rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} kg`;
}

export function fmtTonnes(kg: number): string {
  return `${(kg / 1000).toFixed(1)} t`;
}

/** "85 × 8" (weight × reps, design order). */
export function fmtSet(weight: number | null, reps: number): string {
  return `${weight ?? 0} × ${reps}`;
}

/** "8 × 80 kg" (reps × weight, snackbar order from the design). */
export function fmtSetSnack(reps: number, weight: number | null): string {
  return `${reps} × ${weight ?? 0} kg`;
}
