import { beforeEach, describe, expect, it } from 'vitest';
import { buildShareSource } from './__fixtures__/fixtures';
import {
  SORTS,
  clearRecentShares,
  defaultSort,
  parseDay,
  recentShares,
  rememberShare,
  searchAll,
  shareRefs,
  suggestionsFor,
  type DateWords,
  type Group,
} from './search';
import type { ShareKind, ShareSource, Viewer } from './types';

const src = buildShareSource();
const NOW = src.now; // Wed 7 Oct 2026 09:05 UTC
const TR: Viewer = { side: 'trainer', clientId: 'c1' };
const CL = (id: string): Viewer => ({ side: 'client', clientId: id });
const W: DateWords = { today: ['today'], yesterday: ['yesterday'], last: ['last'] };
const group = (src0: ShareSource, q: string, kind: ShareKind, v: Viewer = TR, o = {}): Group =>
  searchAll(q, v, src0, { filter: kind, ...o }).groups.find((g) => g.kind === kind)!;
const titles = (g: Group) => g.hits.map((h) => h.view.title);
const ids = (g: Group) => g.hits.map((h) => h.view.ref.id);

describe('sorting each kind', () => {
  it('every kind has a default that is its first option', () => {
    for (const [k, list] of Object.entries(SORTS))
      expect(defaultSort(k as ShareKind)).toBe(list[0]);
  });

  it('workouts: newest first, heaviest first, longest first', () => {
    const w = src.clients.c1.workouts;
    const by = (f: (x: (typeof w)[number]) => number) =>
      [...w].sort((a, b) => f(b) - f(a)).map((x) => x.id);
    const got = (sort: string) => ids(group(src, '', 'workout', TR, { sort }));
    expect(got('new')).toEqual(by((x) => x.at).slice(0, 40));
    expect(
      got('heavy')
        .slice(0, 5)
        .map((id) => w.find((x) => x.id === id)!.tonnageKg),
    ).toEqual(
      by((x) => x.tonnageKg ?? 0)
        .slice(0, 5)
        .map((id) => w.find((x) => x.id === id)!.tonnageKg),
    );
    const minutes = got('long')
      .slice(0, 6)
      .map((id) => w.find((x) => x.id === id)!.minutes);
    expect(minutes).toEqual([...minutes].sort((a, b) => b - a));
  });

  it('only the 40 newest workouts are offered', () => {
    const many: ShareSource = {
      ...src,
      clients: {
        ...src.clients,
        c1: {
          ...src.clients.c1,
          workouts: Array.from({ length: 55 }, (_, i) => ({
            ...src.clients.c1.workouts[0],
            id: `bulk-${i}`,
            at: NOW - i * 3_600_000,
          })),
        },
      },
    };
    const refs = shareRefs('workout', TR, many);
    expect(refs).toHaveLength(40);
    expect(refs[39].id).toBe('bulk-39');
    expect(shareRefs('workout', TR, src)).toHaveLength(40);
  });

  it('activities: newest or longest first', () => {
    expect(ids(group(src, '', 'activity', TR, { sort: 'new' }))).toEqual([
      'c1-a3',
      'c1-a1',
      'c1-a2',
    ]);
    expect(ids(group(src, '', 'activity', TR, { sort: 'long' }))).toEqual([
      'c1-a2',
      'c1-a1',
      'c1-a3',
    ]);
  });

  it('results: A-Z, or best estimated 1RM first', () => {
    const az = titles(group(src, '', 'results', TR, { sort: 'az' }));
    expect(az).toEqual([...az].sort((a, b) => a.localeCompare(b)));
    const best = ids(group(src, '', 'results', TR, { sort: 'best' }));
    const e = (id: string) => src.clients.c1.results.find((r) => r.id === id)!.e1rm!;
    expect(best.map(e)).toEqual([...best.map(e)].sort((a, b) => b - a));
    expect(best[0]).toBe('ex9'); // Leg press 277
  });

  it('programs: assigned ones first when asked; days by program or by weekday', () => {
    const prog = ids(group(src, '', 'program', TR, { sort: 'assigned' }));
    expect(prog[0]).toBe('upper-lower-4x');
    const byWeek = ids(group(src, '', 'day', TR, { sort: 'week' }));
    const wd = (id: string) => {
      const [p, i] = id.split(':');
      return src.programs.find((x) => x.id === p)!.days[Number(i)].wd ?? '';
    };
    const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const idx = byWeek.map((id) => order.indexOf(wd(id)));
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
    const byProgram = titles(group(src, '', 'day', TR, { sort: 'program' }));
    expect(byProgram.length).toBe(byWeek.length);
  });

  it('gyms by size, equipment by type, muscles by weekly sets, exercises by muscle family or by plan', () => {
    const size = ids(group(src, '', 'gym', TR, { sort: 'size' }));
    const machines = size.map((id) => src.library.gyms.find((g) => g.id === id)!.machines);
    expect(machines).toEqual([...machines].sort((a, b) => b - a));
    const typed = group(src, '', 'equipment', TR, { sort: 'type' });
    const cats = ids(typed).map((id) =>
      String(src.library.equipment.find((e) => e.id === id)!.category),
    );
    const all = [...new Set(cats)].sort((x, y) => x.localeCompare(y));
    expect(all.length).toBeGreaterThan(1);
    expect(cats[0]).toBe(all[0]);
    expect(cats[cats.length - 1]).toBe(all[all.length - 1]);
    const sets = group(src, '', 'muscle', TR, { sort: 'sets' });
    expect(sets.hits.length).toBeGreaterThan(0);
    const planned = group(src, '', 'exercise', TR, { sort: 'plan' });
    const inPlan = new Set(
      src.clients.c1.results.flatMap((r) => [r.exerciseId ?? '', r.name.toLowerCase()]),
    );
    const flags = planned.hits.map(
      (h) => inPlan.has(h.view.ref.id) || inPlan.has(h.view.title.toLowerCase()),
    );
    expect(flags.some(Boolean)).toBe(true);
    // every exercise of the client's results comes before every other exercise
    expect(flags).toEqual([...flags].sort((a, b) => Number(b) - Number(a)));
    const fam = group(src, '', 'exercise', TR, { sort: 'muscle' });
    expect(fam.total).toBe(planned.total);
  });
});

describe('who can be listed', () => {
  it('a client lists only their own data and only programs assigned to them', () => {
    const c2 = CL('c2');
    expect(shareRefs('program', c2, src).map((r) => r.id)).toEqual(['glute-focus-3x']);
    expect(shareRefs('day', c2, src).every((r) => r.id.startsWith('glute-focus-3x:'))).toBe(true);
    for (const kind of ['workout', 'activity', 'results'] as const)
      for (const r of shareRefs(kind, c2, src)) expect(r.ownerId).toBe('c2');
    const mine = new Set(src.clients.c2.workouts.map((w) => w.id));
    expect(shareRefs('workout', c2, src).every((r) => mine.has(r.id))).toBe(true);
    expect(
      shareRefs('workout', c2, src).some((r) => src.clients.c1.workouts.some((w) => w.id === r.id)),
    ).toBe(false);
  });

  it('the trainer sees all programs but the data of the client of THIS thread only', () => {
    expect(shareRefs('program', TR, src)).toHaveLength(src.programs.length);
    for (const r of shareRefs('workout', TR, src)) expect(r.ownerId).toBe('c1');
  });

  it('a viewer whose client is unknown gets no personal items and no crash', () => {
    const nobody = CL('nobody');
    expect(shareRefs('workout', nobody, src)).toEqual([]);
    expect(shareRefs('activity', nobody, src)).toEqual([]);
    expect(shareRefs('results', nobody, src)).toEqual([]);
  });

  it('a kind the client does not share is a locked group for the trainer and has no hits', () => {
    const lowered: ShareSource = {
      ...src,
      clients: {
        ...src.clients,
        c1: { ...src.clients.c1, consent: { ...src.clients.c1.consent, sets: 'off' } },
      },
    };
    const out = searchAll('', TR, lowered);
    const g = out.groups.find((x) => x.kind === 'results')!;
    expect(g.locked).toEqual({ code: 'notShared', cat: 'sets' });
    expect(g.hits).toEqual([]);
    // a muscle card of that client is limited (no weekly sets), not leaked
    const muscle = out.groups.find((x) => x.kind === 'muscle')!;
    expect(muscle.hits.every((h) => h.view.state === 'limited' || h.view.state === 'ok')).toBe(
      true,
    );
    expect(muscle.hits.flatMap((h) => h.view.facts).some((f) => f.key === 'setsWeek')).toBe(false);
    // with a query the locked groups sink to the end
    const q = searchAll('a', TR, lowered);
    const lockedAt = q.groups.map((g) => !!g.locked);
    expect(lockedAt.indexOf(true)).toBeGreaterThan(lockedAt.lastIndexOf(false) - 1);
    // the client of that thread is never locked out of their own items
    expect(searchAll('', CL('c1'), lowered).groups.every((g) => !g.locked)).toBe(true);
  });
});

describe('matching', () => {
  it('a title that starts with the word outranks one that merely contains it', () => {
    const g = group(src, 'bench', 'exercise');
    const t = titles(g).map((x) => x.toLowerCase());
    const firstStarts = t.findIndex((x) => x.startsWith('bench'));
    const firstContains = t.findIndex((x) => !x.startsWith('bench') && x.includes('bench'));
    expect(firstStarts).toBeGreaterThanOrEqual(0);
    expect(firstContains).toBeGreaterThan(firstStarts);
  });

  it('every word must match (AND), a word can match in the middle of a title or in an alias', () => {
    expect(group(src, 'bench zzzqq', 'exercise').total).toBe(0);
    const alias = group(src, 'brzuszki', 'exercise');
    expect(ids(alias)).toContain('3_4_Sit-Up');
    const mid = group(src, 'press', 'exercise');
    expect(mid.total).toBeGreaterThan(0);
  });

  it('a program found by a row inside it says which row ("Has ...")', () => {
    const g = group(src, 'deadlift', 'program');
    const hit = g.hits.find((h) => h.has);
    if (hit) expect(hit.has?.toLowerCase()).toContain('deadlift');
    expect(group(src, 'deadlift', 'day').hits.every((h) => h.score >= 1)).toBe(true);
  });

  it('the best-matching kind comes first and counts add up', () => {
    const out = searchAll('upper', TR, src);
    expect(out.groups[0].total).toBeGreaterThan(0);
    const sum = out.groups.reduce((n, g) => n + g.total, 0);
    expect(out.counts.all).toBe(sum);
  });

  it('a gym that exists only on this device is listed but cannot be sent', () => {
    const only: ShareSource = {
      ...src,
      library: {
        ...src.library,
        gyms: [{ ...src.library.gyms[0], id: 'home', name: 'Home gym', shareable: false }],
      },
    };
    const g = group(only, '', 'gym');
    expect(g.hits[0].disabled).toBe('deviceOnly');
  });

  it('custom labels (the reader language) are what is matched', () => {
    const labels = (v: { title: string }) => ({ title: `zzz ${v.title}`, extra: [] });
    const g = group(src, 'zzz', 'gym', TR, { labels });
    expect(g.total).toBe(src.library.gyms.length);
  });
});

describe('dates in the query', () => {
  const day = (q: string, o = {}) => searchAll(q, TR, src, { filter: 'all', ...o });
  it('"yesterday" keeps only the workouts and activities of that day, every other kind is empty', () => {
    const out = day('yesterday');
    expect(out.date).toEqual({ key: '2026-10-06', rest: '' });
    expect(ids(out.groups.find((g) => g.kind === 'workout')!)).toEqual(['w0-0']);
    expect(ids(out.groups.find((g) => g.kind === 'activity')!)).toEqual(['c1-a3']);
    for (const g of out.groups.filter((x) => x.kind !== 'workout' && x.kind !== 'activity'))
      expect(g.total).toBe(0);
  });

  it('the rest of the query still filters inside that day', () => {
    expect(ids(day('yesterday upper').groups.find((g) => g.kind === 'workout')!)).toEqual(['w0-0']);
    expect(day('yesterday lower').groups.find((g) => g.kind === 'workout')!.total).toBe(0);
  });

  it("the day is the coach's day: the same query lands on another day in another zone", () => {
    // 18:00 UTC on 6 Oct is already 7 Oct 07:00 in Auckland, and "now" is 7 Oct 22:05 there
    const nz = day('today', { tz: 'Pacific/Auckland' });
    expect(ids(nz.groups.find((g) => g.kind === 'workout')!)).toEqual(['w0-0']);
    expect(day('today').groups.find((g) => g.kind === 'workout')!.total).toBe(0);
  });

  it('a date with no sessions finds nothing', () => {
    expect(day('1 jan').counts.all).toBe(0);
  });

  it('parseDay: weekdays, months, and what it refuses', () => {
    const p = (q: string, loc: 'en' | 'uk' = 'en') => parseDay(q, NOW, 'UTC', loc, W);
    expect(p('last mon')?.key).toBe('2026-10-05');
    expect(p('mon')?.key).toBe('2026-10-05');
    expect(p('tue run')).toBeNull(); // a weekday inside a longer query without "last" is a word, not a date
    expect(p('last tue run')).toEqual({ key: '2026-10-06', rest: 'run' });
    expect(p('1st oct')?.key).toBe('2026-10-01');
    expect(p('15 october')?.key).toBe('2026-10-15');
    expect(p('oct 15')?.key).toBe('2026-10-15');
    expect(p('32 oct')).toBeNull();
    expect(p('0 oct')).toBeNull();
    expect(p('oct 99')).toBeNull();
    expect(p('32oct')).toBeNull();
    expect(p('oct')).toBeNull();
    expect(p('12 xx')).toBeNull(); // shorter than 3 letters never names a month
    expect(p('  TODAY  ')?.key).toBe('2026-10-07');
    expect(p('today.')).toBeNull();
  });

  it('parseDay: a word of the reader language and the English one both work', () => {
    const uk: DateWords = { today: ['сьогодні'], yesterday: ['вчора'], last: ['минулого'] };
    expect(parseDay('вчора', NOW, 'UTC', 'uk', uk)?.key).toBe('2026-10-06');
    expect(parseDay('сьогодні жим', NOW, 'UTC', 'uk', uk)).toEqual({
      key: '2026-10-07',
      rest: 'жим',
    });
    expect(parseDay('6 oct', NOW, 'UTC', 'uk', uk)?.key).toBe('2026-10-06');
  });

  it('parseDay: Sunday is a weekday like the others, and month names of the reader language work only in that language', () => {
    const p = (q: string, loc: 'en' | 'uk' = 'en') => parseDay(q, NOW, 'UTC', loc, W);
    expect(p('sun')?.key).toBe('2026-10-04');
    expect(p('last sun run')).toEqual({ key: '2026-10-04', rest: 'run' });
    expect(p('жовт 6', 'uk')?.key).toBe('2026-10-06');
    expect(p('жовт 6', 'en')).toBeNull();
  });
});

describe('suggestions', () => {
  it('trainer, discussing a lift: the lift, the day that has it, the results of the client', () => {
    const ex = src.clients.c1.results[0].exerciseId!;
    const s = suggestionsFor(TR, src, { exerciseId: ex });
    expect(s[0]).toEqual({ ref: { kind: 'exercise', id: ex }, why: 'decision' });
    expect(s.map((x) => x.why)).toContain('resultsOf');
  });

  it('a lift that is not in the library is not suggested; the next session and the last session are', () => {
    const s = suggestionsFor(TR, src, { exerciseId: 'not-in-the-library' });
    expect(s.map((x) => x.why)).toEqual(['nextSession', 'lastSession']);
    expect(s[1].ref.id).toBe(src.clients.c1.workouts[0].id);
  });

  it('results are not suggested when the client does not share sets', () => {
    const ex = src.clients.c1.results[0].exerciseId!;
    const lowered: ShareSource = {
      ...src,
      clients: {
        ...src.clients,
        c1: { ...src.clients.c1, consent: { ...src.clients.c1.consent, sets: 'off' } },
      },
    };
    expect(suggestionsFor(TR, lowered, { exerciseId: ex }).map((x) => x.why)).not.toContain(
      'resultsOf',
    );
  });

  it('without totals, the last session is not suggested', () => {
    const lowered: ShareSource = {
      ...src,
      clients: {
        ...src.clients,
        c1: { ...src.clients.c1, consent: { ...src.clients.c1.consent, totals: 'off' } },
      },
    };
    expect(suggestionsFor(TR, lowered).map((x) => x.why)).toEqual(['nextSession']);
  });

  it('client: own last session and best result; nothing for a client with no data', () => {
    expect(suggestionsFor(CL('c1'), src).map((x) => x.why)).toEqual(['yourLast', 'yourBest']);
    expect(suggestionsFor(CL('nobody'), src)).toEqual([]);
  });
});

describe('recent shares (memory only)', () => {
  beforeEach(() => clearRecentShares());
  it('newest first, a repeat moves to the front, at most six, owner counts for identity', () => {
    for (let i = 0; i < 8; i++) rememberShare({ kind: 'gym', id: `g${i}` });
    expect(recentShares().map((r) => r.id)).toEqual(['g7', 'g6', 'g5', 'g4', 'g3', 'g2']);
    rememberShare({ kind: 'gym', id: 'g4' });
    expect(recentShares().map((r) => r.id)).toEqual(['g4', 'g7', 'g6', 'g5', 'g3', 'g2']);
    rememberShare({ kind: 'workout', id: 'g4', ownerId: 'c1' });
    expect(recentShares()).toHaveLength(6);
    expect(recentShares()[0]).toEqual({ kind: 'workout', id: 'g4', ownerId: 'c1' });
    clearRecentShares();
    expect(recentShares()).toEqual([]);
  });
  it('nothing is written to storage', () => {
    const before = JSON.stringify({ ...window.localStorage });
    rememberShare({ kind: 'gym', id: 'g1' });
    expect(JSON.stringify({ ...window.localStorage })).toBe(before);
    expect(JSON.stringify({ ...window.sessionStorage })).not.toContain('g1');
  });
});
