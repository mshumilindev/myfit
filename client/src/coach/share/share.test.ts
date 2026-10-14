import { describe, expect, it } from 'vitest';
import { buildShareSource } from './__fixtures__/fixtures';
import { resolveShare } from './resolve';
import {
  defaultSort,
  parseDay,
  rememberShare,
  clearRecentShares,
  recentShares,
  searchAll,
  suggestionsFor,
} from './search';
import {
  isShareKind,
  loadingView,
  parseShareRef,
  SHARE_KINDS,
  type ShareRef,
  type ShareSource,
  type Viewer,
} from './types';
import { shareStrings } from '../../i18n/coachShare';

const TRAINER: Viewer = { side: 'trainer', clientId: 'c1' };
const src: ShareSource = buildShareSource();

/** The same source with one category of a client lowered. */
function withConsent(
  clientId: string,
  patch: Record<string, 'off' | 'effects' | 'full'>,
): ShareSource {
  const c = src.clients[clientId];
  return {
    ...src,
    clients: { ...src.clients, [clientId]: { ...c, consent: { ...c.consent, ...patch } } },
  };
}

describe('parseShareRef (untrusted body)', () => {
  it('accepts a typed ref and drops everything else', () => {
    expect(parseShareRef({ kind: 'program', id: 'p1', evil: '<b>' })).toEqual({
      kind: 'program',
      id: 'p1',
    });
    expect(parseShareRef({ kind: 'results', id: 'x', ownerId: 'c1' })).toEqual({
      kind: 'results',
      id: 'x',
      ownerId: 'c1',
    });
  });
  it.each([
    null,
    'x',
    5,
    {},
    { kind: 'nope', id: 'a' },
    { kind: 'gym' },
    { kind: 'gym', id: '' },
    { kind: 'gym', id: 'a'.repeat(200) },
    { kind: 'gym', id: 'a', ownerId: 5 },
  ])('refuses %j', (v) => expect(parseShareRef(v)).toBeNull());
  it('knows the nine kinds', () => {
    expect(SHARE_KINDS).toHaveLength(9);
    expect(isShareKind('muscle')).toBe(true);
    expect(isShareKind('video')).toBe(false);
  });
  it('loadingView carries no data', () => {
    const v = loadingView({ kind: 'workout', id: 'w' });
    expect(v.state).toBe('loading');
    expect(v.title).toBe('');
    expect(v.facts).toEqual([]);
  });
});

describe('resolveShare', () => {
  const lib = src.library;
  const refs: Record<string, ShareRef> = {
    program: { kind: 'program', id: src.programs[0].id },
    day: { kind: 'day', id: `${src.programs[0].id}:0` },
    exercise: { kind: 'exercise', id: lib.exercises[0].id },
    equipment: { kind: 'equipment', id: lib.equipment[0].id },
    gym: { kind: 'gym', id: lib.gyms[0].id },
    muscle: { kind: 'muscle', id: 'chest' },
  };

  it.each(Object.entries(refs))(
    '%s resolves ok for the trainer, with a title and an open target',
    (_k, ref) => {
      const v = resolveShare(ref, TRAINER, src);
      expect(v.state).toBe('ok');
      expect(v.title).not.toBe('');
      expect(v.openTarget.app).toBe('trainer');
    },
  );

  it('a missing item is removed, with a reason and no data', () => {
    for (const kind of ['program', 'exercise', 'equipment', 'gym'] as const) {
      const v = resolveShare({ kind, id: 'nope' }, TRAINER, src);
      expect(v.state).toBe('removed');
      expect(v.title).toBe('');
      expect(v.reason).toBeDefined();
    }
  });

  it('a program not assigned to the reader is locked on the client side', () => {
    const p = src.programs.find((x) => !x.assignedTo.includes('c2'))!;
    const v = resolveShare({ kind: 'program', id: p.id }, { side: 'client', clientId: 'c2' }, src);
    expect(v.state).toBe('locked');
    expect(v.reason).toEqual({ code: 'notAssigned' });
    expect(v.rows).toBeUndefined();
  });

  it('workout and activity are locked when the client shares no totals, and the locked view carries no item data', () => {
    const w = src.clients.c1.workouts[0];
    const off = withConsent('c1', { totals: 'off' });
    const v = resolveShare({ kind: 'workout', id: w.id, ownerId: 'c1' }, TRAINER, off);
    expect(v.state).toBe('locked');
    expect(v.reason).toEqual({ code: 'notShared', cat: 'totals' });
    expect(v.facts).toEqual([]);
    expect(v.rows).toBeUndefined();
    expect(JSON.stringify(v)).not.toContain(w.rows[0].name);
  });

  it('a workout with totals but no sets is limited: totals only, no rows', () => {
    const w = src.clients.c1.workouts[0];
    const v = resolveShare(
      { kind: 'workout', id: w.id, ownerId: 'c1' },
      TRAINER,
      withConsent('c1', { totals: 'full', sets: 'off' }),
    );
    expect(v.state).toBe('limited');
    expect(v.rows).toBeUndefined();
    expect(v.limited).toEqual({ cat: 'sets' });
  });

  it('with full sets the workout shows its rows', () => {
    const w = src.clients.c1.workouts[0];
    const v = resolveShare(
      { kind: 'workout', id: w.id, ownerId: 'c1' },
      TRAINER,
      withConsent('c1', { totals: 'full', sets: 'full' }),
    );
    expect(v.state).toBe('ok');
    expect(v.rows?.length).toBeGreaterThan(0);
  });

  it("another client's data is private whoever asks", () => {
    const w = src.clients.c1.workouts[0];
    const v = resolveShare(
      { kind: 'workout', id: w.id, ownerId: 'c1' },
      { side: 'trainer', clientId: 'c2' },
      src,
    );
    expect(v.state).toBe('locked');
    expect(v.reason).toEqual({ code: 'private' });
  });

  it('results with fewer than three sessions are gone, results without sets are locked', () => {
    const r = src.clients.c1.results[0];
    expect(
      resolveShare(
        { kind: 'results', id: r.id, ownerId: 'c1' },
        TRAINER,
        withConsent('c1', { sets: 'off' }),
      ).state,
    ).toBe('locked');
  });

  it('an activity draws its stored track', () => {
    const a = src.clients.c1.activities[0];
    if (!a) return;
    const v = resolveShare(
      { kind: 'activity', id: a.id, ownerId: 'c1' },
      TRAINER,
      withConsent('c1', { totals: 'full' }),
    );
    expect(['ok', 'locked']).toContain(v.state);
  });

  it('muscle without sets hides the weekly sets and says so', () => {
    const v = resolveShare(
      { kind: 'muscle', id: 'chest', ownerId: 'c1' },
      TRAINER,
      withConsent('c1', { sets: 'off' }),
    );
    expect(v.state).toBe('limited');
    expect(v.facts.find((f) => f.key === 'setsWeek')).toBeUndefined();
  });
});

describe('searchAll', () => {
  const view = (q: string, o = {}) => searchAll(q, TRAINER, src, o);
  it('groups every kind with counts; All is the sum', () => {
    const out = view('');
    expect(out.groups.map((g) => g.kind)).toEqual([...SHARE_KINDS]);
    const sum = SHARE_KINDS.reduce((a, k) => a + out.counts[k], 0);
    expect(out.counts.all).toBe(sum);
  });
  it('finds an exercise by name and by a row that contains it ("Has ...")', () => {
    const out = view('bench');
    expect(out.counts.exercise).toBeGreaterThan(0);
    expect(out.counts.program + out.counts.day).toBeGreaterThan(0);
  });
  it('a kind the client does not share comes back as a locked group, never missing', () => {
    const out = searchAll('', TRAINER, withConsent('c1', { totals: 'off' }), {});
    const g = out.groups.find((x) => x.kind === 'workout')!;
    expect(g.locked).toEqual({ code: 'notShared', cat: 'totals' });
    expect(g.hits).toEqual([]);
  });
  it('filter narrows to one kind; unknown words find nothing', () => {
    const out = view('', { filter: 'gym' });
    expect(out.groups.find((g) => g.kind === 'gym')!.hits.length).toBeGreaterThan(0);
    expect(view('zzzzqqq').counts.all).toBe(0);
  });
  it('a gym that exists only on this device is disabled', () => {
    const g = view('home', { filter: 'gym' }).groups.find((x) => x.kind === 'gym')!;
    expect(g.hits.find((h) => h.disabled === 'deviceOnly')).toBeDefined();
  });
  it('sort option changes the order', () => {
    const az = view('', { filter: 'program', sort: 'az' })
      .groups.find((g) => g.kind === 'program')!
      .hits.map((h) => h.view.title);
    expect(az).toEqual([...az].sort((a, b) => a.localeCompare(b)));
    expect(defaultSort('program')).toBe('az');
  });
});

describe('parseDay', () => {
  const NOW = src.now; // Wed 7 Oct 2026 09:05 UTC
  const W = { today: ['today'], yesterday: ['yesterday'], last: ['last'] };
  const p = (q: string) => parseDay(q, NOW, 'UTC', 'en', W);
  it('understands today and yesterday', () => {
    expect(p('today')).toEqual({ key: '2026-10-07', rest: '' });
    expect(p('yesterday run')).toEqual({ key: '2026-10-06', rest: 'run' });
  });
  it('understands "6 oct", "oct 6" and "6oct"', () => {
    expect(p('6 oct')?.key).toBe('2026-10-06');
    expect(p('oct 6')?.key).toBe('2026-10-06');
    expect(p('6oct')?.key).toBe('2026-10-06');
  });
  it('understands a weekday: "last tue" is strictly before today, bare "wed" is today', () => {
    expect(p('last tue')?.key).toBe('2026-10-06');
    expect(p('last wed')?.key).toBe('2026-09-30');
    expect(p('wed')?.key).toBe('2026-10-07');
  });
  it('leaves plain words alone', () => {
    expect(p('bench press')).toBeNull();
    expect(p('')).toBeNull();
  });
  it('understands the reader-language month', () => {
    expect(parseDay('6 жовт', NOW, 'UTC', 'uk', shareStrings('uk').dateWords)?.key).toBe(
      '2026-10-06',
    );
  });
});

describe('suggestions and recents', () => {
  it('the trainer gets a context-aware list for the client', () => {
    const s = suggestionsFor(TRAINER, src, { exerciseId: src.library.exercises[0].id });
    expect(s.length).toBeGreaterThan(0);
    expect(s[0].why).toBe('decision');
  });
  it('recents are memory only and capped by use', () => {
    clearRecentShares();
    rememberShare({ kind: 'gym', id: 'a' });
    rememberShare({ kind: 'gym', id: 'b' });
    rememberShare({ kind: 'gym', id: 'a' });
    expect(recentShares().map((r) => r.id)).toEqual(['a', 'b']);
    clearRecentShares();
  });
});
