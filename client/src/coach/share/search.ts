/**
 * The share picker's search engine (plan C-04): ONE query across all nine kinds, pure and synchronous over a
 * `ShareSource`. Returns every kind grouped with a count, the date it understood ("6 oct", "yesterday", "last tue" and
 * the same words in the reader's language) and, per hit, WHY it matched when the title does not show it. A kind the
 * viewer may not share comes back as a `locked` group, never silently missing. Names are matched in the reader's
 * language through `labels`, supplied by the UI (the engine does not know the dictionary).
 */
import type { LocaleId } from '../../i18n';
import { DAY } from '../domain/time';
import { findProgram, kindAccess, resolveShare } from './resolve';
import {
  SHARE_KINDS,
  type ShareKind,
  type ShareReason,
  type ShareRef,
  type ShareSource,
  type ShareView,
  type Viewer,
} from './types';
import { FAMILY_ORDER } from './library';

export type Filter = 'all' | ShareKind;
export const FILTERS: readonly Filter[] = ['all', ...SHARE_KINDS];

export interface DateWords {
  today: readonly string[];
  yesterday: readonly string[];
  last: readonly string[];
}
export interface DateHit {
  /** YYYY-MM-DD in the coach's zone */
  key: string;
  /** the query without the date words */
  rest: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (ts: number, tz: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(ts);
const wdOfKey = (key: string): number => new Date(`${key}T12:00:00Z`).getUTCDay();

function names(
  locale: LocaleId,
  opt: Intl.DateTimeFormatOptions,
  count: number,
  start: (i: number) => Date,
): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < count; i++) {
    const set = new Set<string>();
    for (const loc of locale === 'en' ? ['en'] : ['en', locale])
      for (const style of ['short', 'long'] as const) {
        const v = new Intl.DateTimeFormat(loc, {
          ...opt,
          [Object.keys(opt)[0]]: style,
          timeZone: 'UTC',
        }).format(start(i));
        set.add(v.toLowerCase().replace(/[.,]/g, '').trim());
      }
    out.push([...set]);
  }
  return out;
}
const monthCache = new Map<LocaleId, string[][]>();
const weekdayCache = new Map<LocaleId, string[][]>();
const months = (l: LocaleId) => {
  let m = monthCache.get(l);
  if (!m)
    monthCache.set(
      l,
      (m = names(l, { month: 'short' }, 12, (i) => new Date(Date.UTC(2026, i, 15)))),
    );
  return m;
};
/** index 0 = Sunday */
const weekdays = (l: LocaleId) => {
  let m = weekdayCache.get(l);
  if (!m)
    weekdayCache.set(
      l,
      (m = names(l, { weekday: 'short' }, 7, (i) => new Date(Date.UTC(2026, 9, 4 + i, 12)))),
    );
  return m;
};
const matchIdx = (table: string[][], word: string): number =>
  word.length < 3
    ? -1
    : table.findIndex((forms) =>
        forms.some((f) => f === word || (word.length >= 3 && f.startsWith(word))),
      );

/** "6 oct", "oct 6", "yesterday", "today", "last tue", "tue" -> a day key + the rest of the query. */
export function parseDay(
  q: string,
  now: number,
  tz: string,
  locale: LocaleId,
  words: DateWords,
): DateHit | null {
  const s = q.toLowerCase().trim().replace(/\s+/g, ' ');
  if (!s) return null;
  const strip = (re: RegExp) => s.replace(re, ' ').replace(/\s+/g, ' ').trim();
  const has = (list: readonly string[]) =>
    list
      .map((w) => w.toLowerCase())
      .find((w) => new RegExp(`(^|\\s)${esc(w)}(\\s|$)`, 'u').test(s));
  const t = has(words.today);
  if (t) return { key: keyOf(now, tz), rest: strip(new RegExp(`(^|\\s)${esc(t)}(?=\\s|$)`, 'u')) };
  const y = has(words.yesterday);
  if (y)
    return { key: keyOf(now - DAY, tz), rest: strip(new RegExp(`(^|\\s)${esc(y)}(?=\\s|$)`, 'u')) };

  const toks = s.split(' ');
  const last = toks.findIndex((x) => words.last.map((w) => w.toLowerCase()).includes(x));
  // weekday: "last tue" (strictly before today) or a bare weekday as the whole query
  for (let i = 0; i < toks.length; i++) {
    const wd = matchIdx(weekdays(locale), toks[i]);
    if (wd < 0) continue;
    if (last < 0 && toks.length !== 1) continue;
    for (let d = last >= 0 ? 1 : 0; d < 8; d++) {
      const k = keyOf(now - d * DAY, tz);
      if (wdOfKey(k) === wd)
        return { key: k, rest: toks.filter((_, j) => j !== i && j !== last).join(' ') };
    }
  }
  const year = Number(keyOf(now, tz).slice(0, 4));
  const day = (d: number, m: number) =>
    d >= 1 && d <= 31 ? `${year}-${pad(m + 1)}-${pad(d)}` : null;
  for (let i = 0; i < toks.length; i++) {
    const m = toks[i].match(/^(\d{1,2})(?:st|nd|rd|th)?$/);
    if (m && toks[i + 1]) {
      const mi = matchIdx(months(locale), toks[i + 1]);
      const k = mi >= 0 ? day(Number(m[1]), mi) : null;
      if (k) return { key: k, rest: toks.filter((_, j) => j !== i && j !== i + 1).join(' ') };
    }
    const mi = matchIdx(months(locale), toks[i]);
    const dm = toks[i + 1]?.match(/^(\d{1,2})$/);
    if (mi >= 0 && dm) {
      const k = day(Number(dm[1]), mi);
      if (k) return { key: k, rest: toks.filter((_, j) => j !== i && j !== i + 1).join(' ') };
    }
    const joined = toks[i].match(/^(\d{1,2})(\p{L}{3,})$/u);
    if (joined) {
      const k2 = matchIdx(months(locale), joined[2]);
      const k = k2 >= 0 ? day(Number(joined[1]), k2) : null;
      if (k) return { key: k, rest: toks.filter((_, j) => j !== i).join(' ') };
    }
  }
  return null;
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ---------------- lists ---------------------------------------------------------------------------------------------- */

export interface Hit {
  view: ShareView;
  /** The row that matched when the title does not show it ("Has Bench press"). */
  has?: string;
  score: number;
  /** A gym that only exists on this device cannot be sent. */
  disabled?: 'deviceOnly';
}
export interface Group {
  kind: ShareKind;
  total: number;
  hits: Hit[];
  locked?: ShareReason;
}
export interface SearchOut {
  groups: Group[];
  counts: Record<Filter, number>;
  date?: DateHit;
}

export const SORTS: Readonly<Record<ShareKind, readonly string[]>> = {
  program: ['az', 'assigned'],
  day: ['program', 'week'],
  exercise: ['az', 'muscle', 'plan'],
  equipment: ['az', 'type'],
  gym: ['az', 'size'],
  workout: ['new', 'heavy', 'long'],
  activity: ['new', 'long'],
  results: ['az', 'best'],
  muscle: ['az', 'sets'],
};
export const defaultSort = (k: ShareKind): string => SORTS[k][0];

/** Every ref the viewer could pick for a kind (before search). Another client's data is never listed. */
export function shareRefs(kind: ShareKind, viewer: Viewer, src: ShareSource): ShareRef[] {
  const me = viewer.clientId;
  const isClient = viewer.side === 'client';
  const d = src.clients[me];
  switch (kind) {
    case 'program':
      return src.programs
        .filter((p) => !isClient || p.assignedTo.includes(me))
        .map((p) => ({ kind, id: p.id, ownerId: 'coach' }));
    case 'day':
      return src.programs
        .filter((p) => !isClient || p.assignedTo.includes(me))
        .flatMap((p) => p.days.map((_, i) => ({ kind, id: `${p.id}:${i}`, ownerId: 'coach' })));
    case 'exercise':
      return src.library.exercises.map((e) => ({ kind, id: e.id }));
    case 'equipment':
      return src.library.equipment.map((e) => ({ kind, id: e.id }));
    case 'gym':
      return src.library.gyms.map((g) => ({ kind, id: g.id }));
    case 'workout':
      return (d?.workouts ?? []).slice(0, 40).map((w) => ({ kind, id: w.id, ownerId: me }));
    case 'activity':
      return (d?.activities ?? []).map((a) => ({ kind, id: a.id, ownerId: me }));
    case 'results':
      return (d?.results ?? []).map((r) => ({ kind, id: r.id, ownerId: me }));
    case 'muscle':
      return Array.from(new Set(src.library.exercises.flatMap((e) => e.muscles.slice(0, 1)))).map(
        (m) => ({ kind, id: m, ownerId: me }),
      );
  }
}

const refDay = (
  ref: ShareRef,
  viewer: Viewer,
  src: ShareSource,
  tz: string,
): string | undefined => {
  const d = src.clients[ref.ownerId ?? viewer.clientId];
  const at =
    ref.kind === 'workout'
      ? d?.workouts.find((w) => w.id === ref.id)?.at
      : ref.kind === 'activity'
        ? d?.activities.find((a) => a.id === ref.id)?.at
        : undefined;
  return at == null ? undefined : keyOf(at, tz);
};

export interface SearchOpts {
  filter?: Filter;
  sort?: string;
  locale?: LocaleId;
  words?: DateWords;
  tz?: string;
  /** Searchable, localised strings of a view: title first, then anything else the reader sees. */
  labels?: (v: ShareView) => { title: string; extra: string[] };
}

const norm = (s: string) => s.toLowerCase();
const EN_WORDS: DateWords = { today: ['today'], yesterday: ['yesterday'], last: ['last'] };

function scoreView(
  v: ShareView,
  tokens: string[],
  labels: NonNullable<SearchOpts['labels']>,
  aliases: readonly string[],
): { score: number; has?: string } | null {
  if (!tokens.length) return { score: 0 };
  const l = labels(v);
  const title = norm(l.title);
  const extra = norm([...l.extra, ...aliases].join(' '));
  let total = 0;
  let has: string | undefined;
  for (const t of tokens) {
    if (title.startsWith(t)) total += 5;
    else if (title.split(/[^\p{L}\p{N}]+/u).some((w) => w.startsWith(t))) total += 4;
    else if (title.includes(t)) total += 3;
    else if (extra.includes(t)) total += 2;
    else {
      const row = (v.rows ?? []).find((r) => norm(r.name).includes(t));
      if (!row) return null;
      total += 1;
      has = row.name;
    }
  }
  return { score: total, has };
}

function aliasesOf(ref: ShareRef, src: ShareSource): readonly string[] {
  if (ref.kind === 'exercise')
    return src.library.exercises.find((e) => e.id === ref.id)?.aliases ?? [];
  if (ref.kind === 'equipment')
    return src.library.equipment.find((e) => e.id === ref.id)?.aliases ?? [];
  return [];
}

function sortHits(
  kind: ShareKind,
  sort: string,
  hits: Hit[],
  viewer: Viewer,
  src: ShareSource,
): Hit[] {
  const me = viewer.clientId;
  const d = src.clients[me];
  const planned = new Set(
    (d?.results ?? []).flatMap((r) => [r.exerciseId ?? '', r.name.toLowerCase()]),
  );
  const key = (h: Hit): number | string => {
    const r = h.view.ref;
    switch (kind) {
      case 'exercise': {
        const e = src.library.exercises.find((x) => x.id === r.id);
        if (sort === 'muscle')
          return `${FAMILY_ORDER.indexOf(e?.family ?? 'other')}${h.view.title}`;
        if (sort === 'plan')
          return `${planned.has(r.id) || planned.has(h.view.title.toLowerCase()) ? 0 : 1}${h.view.title}`;
        return h.view.title;
      }
      case 'program':
        return sort === 'assigned'
          ? `${findProgram(src.programs, r.id)?.assignedTo.includes(me) ? 0 : 1}${h.view.title}`
          : h.view.title;
      case 'day': {
        const [pid, di] = r.id.split(':');
        const p = findProgram(src.programs, pid);
        const day = p?.days[Number(di)];
        const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        return sort === 'week'
          ? order.indexOf(day?.wd ?? 'Mon') * 100 + Number(di)
          : `${p?.name}${String(di).padStart(2, '0')}`;
      }
      case 'workout': {
        const w = d?.workouts.find((x) => x.id === r.id);
        return sort === 'heavy'
          ? -(w?.tonnageKg ?? 0)
          : sort === 'long'
            ? -(w?.minutes ?? 0)
            : -(w?.at ?? 0);
      }
      case 'activity': {
        const a = d?.activities.find((x) => x.id === r.id);
        return sort === 'long' ? -(a?.minutes ?? 0) : -(a?.at ?? 0);
      }
      case 'results': {
        const x = d?.results.find((q) => q.id === r.id);
        return sort === 'best' ? -(x?.e1rm ?? 0) : h.view.title;
      }
      case 'equipment':
        return sort === 'type'
          ? `${src.library.equipment.find((e) => e.id === r.id)?.category}${h.view.title}`
          : h.view.title;
      case 'gym':
        return sort === 'size'
          ? -(src.library.gyms.find((g) => g.id === r.id)?.machines ?? 0)
          : h.view.title;
      case 'muscle':
        return sort === 'sets'
          ? -Number(h.view.facts.find((f) => f.key === 'setsWeek')?.value ?? 0)
          : h.view.title;
    }
  };
  return [...hits].sort((a, b) => {
    const x = key(a);
    const y = key(b);
    return typeof x === 'number' && typeof y === 'number'
      ? x - y
      : String(x).localeCompare(String(y));
  });
}

export function searchAll(
  q: string,
  viewer: Viewer,
  src: ShareSource,
  opts: SearchOpts = {},
): SearchOut {
  const locale = opts.locale ?? 'en';
  const tz = opts.tz ?? 'UTC';
  const labels = opts.labels ?? ((v) => ({ title: v.title, extra: [...(v.chips ?? [])] }));
  const date = parseDay(q, src.now, tz, locale, opts.words ?? EN_WORDS);
  const tokens = norm(date ? date.rest : q)
    .split(/\s+/)
    .filter(Boolean);
  const counts = { all: 0 } as Record<Filter, number>;
  const groups: Group[] = [];
  for (const kind of SHARE_KINDS) {
    counts[kind] = 0;
    const acc = kindAccess(kind, viewer, src);
    if (!acc.ok) {
      groups.push({ kind, total: 0, hits: [], locked: acc.reason });
      continue;
    }
    if (date && kind !== 'workout' && kind !== 'activity') {
      groups.push({ kind, total: 0, hits: [] });
      continue;
    }
    let hits: Hit[] = [];
    for (const ref of shareRefs(kind, viewer, src)) {
      if (date && refDay(ref, viewer, src, tz) !== date.key) continue;
      const v = resolveShare(ref, viewer, src);
      if (v.state === 'removed' || v.state === 'locked' || v.state === 'loading') continue;
      const sc = scoreView(v, tokens, labels, aliasesOf(ref, src));
      if (!sc) continue;
      const gym = kind === 'gym' ? src.library.gyms.find((g) => g.id === ref.id) : undefined;
      hits.push({
        view: v,
        score: sc.score,
        has: sc.has,
        disabled: gym && !gym.shareable ? 'deviceOnly' : undefined,
      });
    }
    const sortId = opts.filter === kind && opts.sort ? opts.sort : defaultSort(kind);
    hits = sortHits(kind, sortId, hits, viewer, src);
    if (tokens.length) hits = hits.sort((a, b) => b.score - a.score);
    counts[kind] = hits.length;
    counts.all += hits.length;
    groups.push({ kind, total: hits.length, hits });
  }
  // with a query the groups with the best match come first, locked ones last
  if (tokens.length || date)
    groups.sort(
      (a, b) =>
        (a.locked ? 1 : 0) - (b.locked ? 1 : 0) ||
        (b.hits[0]?.score ?? -1) - (a.hits[0]?.score ?? -1) ||
        b.total - a.total,
    );
  return { groups, counts, date: date ?? undefined };
}

export interface Suggestion {
  ref: ShareRef;
  why:
    'decision' | 'dayBench' | 'resultsOf' | 'nextSession' | 'lastSession' | 'yourLast' | 'yourBest';
}
/**
 * Contextual suggestions for an empty query. `topic` = what the chat was opened from (a decision about a lift: its
 * exercise id). Trainer: the exercise being discussed, the day that has it, the client's history of it when shared;
 * otherwise the next planned day and the last session. Client: own last session and best.
 */
export function suggestionsFor(
  viewer: Viewer,
  src: ShareSource,
  topic?: { exerciseId?: string },
): Suggestion[] {
  const me = viewer.clientId;
  const d = src.clients[me];
  const out: Suggestion[] = [];
  const lastW = d?.workouts[0];
  if (viewer.side === 'trainer') {
    const prog = src.programs.find((p) => p.assignedTo.includes(me));
    if (topic?.exerciseId && src.library.exercises.some((e) => e.id === topic.exerciseId)) {
      out.push({ ref: { kind: 'exercise', id: topic.exerciseId }, why: 'decision' });
      const di =
        prog?.days.findIndex((x) => x.rows?.some((r) => r.exerciseId === topic.exerciseId)) ?? -1;
      if (prog && di >= 0)
        out.push({
          ref: { kind: 'day', id: `${prog.id}:${di}`, ownerId: 'coach' },
          why: 'dayBench',
        });
      const res = d?.results.find((r) => r.exerciseId === topic.exerciseId);
      if (res && kindAccess('results', viewer, src).ok)
        out.push({ ref: { kind: 'results', id: res.id, ownerId: me }, why: 'resultsOf' });
    } else {
      if (prog && prog.days.length)
        out.push({
          ref: { kind: 'day', id: `${prog.id}:0`, ownerId: 'coach' },
          why: 'nextSession',
        });
      if (lastW && kindAccess('workout', viewer, src).ok)
        out.push({ ref: { kind: 'workout', id: lastW.id, ownerId: me }, why: 'lastSession' });
    }
  } else {
    if (lastW) out.push({ ref: { kind: 'workout', id: lastW.id, ownerId: me }, why: 'yourLast' });
    const best = d?.results[0];
    if (best) out.push({ ref: { kind: 'results', id: best.id, ownerId: me }, why: 'yourBest' });
  }
  return out;
}

/** Recently shared in this session, newest first. Memory only (never storage). */
const RECENT: ShareRef[] = [];
export function rememberShare(ref: ShareRef): void {
  const i = RECENT.findIndex(
    (r) => r.kind === ref.kind && r.id === ref.id && r.ownerId === ref.ownerId,
  );
  if (i >= 0) RECENT.splice(i, 1);
  RECENT.unshift(ref);
  RECENT.length = Math.min(RECENT.length, 6);
}
export const recentShares = (): readonly ShareRef[] => RECENT;
export const clearRecentShares = (): void => void (RECENT.length = 0);
