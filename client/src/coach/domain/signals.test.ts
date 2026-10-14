// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { gateInput, type ClientSignalInput } from './signalInputs';
import { detectSignals, rankSignals } from './signals';
import { NOISE_KG } from './signalConfig';
import { DAY } from './time';
import type { Level, LogMode, Signal } from './types';
import { CUR, NOW, consent, input, lift, session, totals, week, wkAgo } from './testBuilders';

const kinds = (s: Signal[]) => s.map((x) => x.kind);
const run = (i: ClientSignalInput) => detectSignals([i], NOW);

describe('stall', () => {
  it.each([
    ['flat 4 weeks, gain 2.0 (116 vs 115 +1, +2)', [115, 115, 116, 117], 116, true],
    ['gain just under noise 2.4', [115, 115, 116, 117.4], 116, true],
    ['gain exactly noise 2.5 is progress', [115, 115, 116, 117.5], 116, false],
    ['gain above noise', [115, 116, 118, 120], 120, false],
    ['declining counts as no gain', [118, 117, 116, 115], 115, true],
  ])('%s', (_n, bests, cur, stall) => {
    const out = run(input({ lifts: [lift(bests, { cur })] }));
    expect(kinds(out).includes('stall')).toBe(stall);
  });

  it('uses the shared noise constant 2.5 kg', () => {
    expect(NOISE_KG).toBe(2.5);
  });

  it('needs four completed weeks', () => {
    expect(kinds(run(input({ lifts: [lift([115, 115, 115], { cur: 115 })] })))).not.toContain(
      'stall',
    );
  });

  it('volume must be steady (+-15%)', () => {
    expect(
      kinds(run(input({ lifts: [lift([115, 115, 115, 115], { sets: [6, 6, 6, 9] })] }))),
    ).not.toContain('stall');
    expect(
      kinds(run(input({ lifts: [lift([115, 115, 115, 115], { sets: [6, 6, 6, 6.5] })] }))),
    ).toContain('stall');
  });

  it('a machine/gym change is a `machine` signal, never a stall', () => {
    const out = run(
      input({
        lifts: [lift([180, 180, 181, 180], { cur: 160, variants: ['t', 't', 't', 't', 'h'] })],
      }),
    );
    expect(kinds(out)).toEqual(['machine']);
    expect(out[0].severity).toBe('watch');
  });

  it('reports weeks flat, strength grows with them, urgent', () => {
    const four = run(input({ lifts: [lift([115, 115, 116, 117], { cur: 116 })] }))[0];
    const six = run(input({ lifts: [lift([115, 115, 115, 115, 116, 117], { cur: 116 })] }))[0];
    expect(four).toMatchObject({ kind: 'stall', severity: 'urgent', key: 'c1|stall|bench' });
    expect(four.facts.weeks).toBe(4);
    expect(six.facts.weeks).toBeGreaterThan(4);
    expect(six.strength).toBeGreaterThan(four.strength);
  });

  it('unknown equipment lowers confidence', () => {
    const l = lift([115, 115, 116, 117], {
      cur: 116,
      variants: ['unknown', 'unknown', 'unknown', 'unknown', 'unknown'],
    });
    expect(run(input({ lifts: [l] }))[0].confidence).toBe('low');
  });

  it('effects level still detects the stall, with weekly evidence only', () => {
    const l = lift([115, 115, 116, 117], { cur: 116 });
    l.sessions = [session(1, 116, 9)];
    const out = run(input({ consent: consent({ totals: 'full', sets: 'effects' }), lifts: [l] }));
    expect(out[0].kind).toBe('stall');
    expect(out[0].evidence[0]).toMatchObject({
      category: 'sets',
      level: 'effects',
      granular: false,
    });
    expect(out[0].evidence[0].rows.every((r) => r.detail?.endsWith('sets'))).toBe(true);
  });

  it('full level carries set-by-set rows (<= 12)', () => {
    const sessions = Array.from({ length: 20 }, (_, i) =>
      session(i * 3.5 + 1, 115 + (i % 2), 8, { setsText: '100x5' }),
    );
    const out = run(input({ lifts: [{ liftId: 'bench', name: 'Bench press', sessions }] }));
    const ev = out.find((s) => s.kind === 'stall')?.evidence[0];
    expect(ev?.granular).toBe(true);
    expect(ev!.rows.length).toBeLessThanOrEqual(12);
    expect(ev!.rows[0].detail).toBe('100x5');
  });
});

describe('rhythm', () => {
  it.each([
    ['two weeks under 50%', totals([3, 3, 1, 1], 3, 2), true],
    ['only one low week', totals([3, 3, 3, 1], 3, 2), false],
    ['1 of 2 planned is exactly 50%: not low', totals([2, 2, 1, 1], 2, 2), false],
    ['idle 8 days while planned', totals([3, 3, 3, 3], 3, 8), true],
    ['idle exactly 7 days', totals([3, 3, 3, 3], 3, 7), false],
    ['idle but nothing planned', { ...totals([3, 3, 3, 3], 3, 20), plannedThisWeek: 0 }, false],
  ])('%s', (_n, t, expected) => {
    expect(kinds(run(input({ totals: t })))).toEqual(expected ? ['rhythm'] : []);
  });

  it('severity: idle >= 14 d or both rules is urgent, otherwise watch', () => {
    expect(run(input({ totals: totals([3, 3, 3, 3], 3, 8) }))[0].severity).toBe('watch');
    expect(run(input({ totals: totals([3, 3, 3, 3], 3, 14) }))[0].severity).toBe('urgent');
    expect(run(input({ totals: totals([3, 3, 1, 1], 3, 9) }))[0].severity).toBe('urgent');
  });

  it('works at totals: effects, locked at off', () => {
    const t = totals([3, 3, 1, 1], 3, 2);
    expect(kinds(run(input({ consent: consent({ totals: 'effects' }), totals: t })))).toContain(
      'rhythm',
    );
    const off = run(input({ consent: consent({ totals: 'off', sets: 'full' }), totals: t }));
    expect(kinds(off)).not.toContain('rhythm');
  });
});

describe('spike', () => {
  const m = (cur: number, prior = [20, 21, 22, 21]) => ({
    muscle: 'legs',
    weeklySets: [...prior, cur],
  });
  it.each([
    [30, [20, 21, 22, 21], true],
    [28, [20, 21, 22, 21], true], // 1.333
    [27, [20, 21, 22, 21], false], // 1.286
    [30, [4, 4, 4, 4], false], // no baseline worth the name
    [30, [20, 21], false], // fewer than 4 prior weeks
  ])('current %i vs %j -> %s', (cur, prior, expected) => {
    const out = run(input({ muscles: [m(cur, prior)] }));
    expect(kinds(out).includes('spike')).toBe(expected);
  });
  it('is a 7-day signal, watch, and urgent only far above', () => {
    expect(run(input({ muscles: [m(30)] }))[0]).toMatchObject({ kind: 'spike', severity: 'watch' });
    expect(run(input({ muscles: [m(40)] }))[0].severity).toBe('urgent');
  });
});

describe('ready and pr', () => {
  const rpe7 = [session(8, 99, 7), session(4, 99, 7), session(1, 100, 7)];
  it('ready needs 3 sessions in a row, RPE <= 7, all reps, set-by-set rows (Full)', () => {
    const mk = (ss: ReturnType<typeof session>[], lvl: Level = 'full') =>
      run(
        input({
          consent: consent({ totals: 'full', sets: lvl }),
          lifts: [{ liftId: 'dl', name: 'Deadlift', sessions: ss }],
        }),
      );
    expect(kinds(mk(rpe7))).toEqual(['ready']);
    expect(kinds(mk(rpe7, 'effects'))).toEqual([]);
    expect(kinds(mk([rpe7[0], rpe7[1], session(1, 100, 7.5)]))).toEqual([]);
    expect(kinds(mk([rpe7[0], rpe7[1], session(1, 100, 7, { allRepsDone: false })]))).toEqual([]);
    expect(kinds(mk([rpe7[0], rpe7[1], session(1, 100, 7, { variant: 'other' })]))).toEqual([]);
    expect(kinds(mk(rpe7.slice(1)))).toEqual([]);
  });
  it('pr: this week above everything before; informational severity good', () => {
    const out = run(input({ lifts: [lift([176, 177, 178, 179], { cur: 182 })] }));
    expect(out[0]).toMatchObject({ kind: 'pr', severity: 'good' });
    expect(out[0].facts.gainKg).toBe(3);
    expect(kinds(run(input({ lifts: [lift([176, 177, 178, 179], { cur: 179 })] })))).toEqual([]);
  });
  it('pr and stall never together', () => {
    expect(kinds(run(input({ lifts: [lift([176, 177, 178, 179], { cur: 182 })] })))).not.toContain(
      'stall',
    );
  });
});

describe('injury (only from a program conflict)', () => {
  const inj = {
    restrictions: ['no overhead'],
    conflicts: [{ exercise: 'Military press', restriction: 'no overhead movement' }],
  };
  it('raised from a conflict when injury and sets are readable', () => {
    const out = run(
      input({ consent: consent({ totals: 'full', sets: 'full', injury: 'full' }), injury: inj }),
    );
    expect(out[0]).toMatchObject({ kind: 'injury', severity: 'urgent' });
    expect(out[0].facts.restriction).toBe('no overhead movement');
  });
  it('effects level: no restriction text (merged restrictions only)', () => {
    const out = run(
      input({ consent: consent({ totals: 'full', sets: 'full', injury: 'effects' }), injury: inj }),
    );
    expect(out[0].facts.restriction).toBeNull();
    expect(out[0].evidence[0].rows[0].detail).toBeUndefined();
  });
  it.each([
    ['injury off', consent({ totals: 'full', sets: 'full', injury: 'off' }), inj],
    ['sets off', consent({ totals: 'full', sets: 'off', injury: 'full' }), inj],
    [
      'no conflict (injury data alone never alerts)',
      consent({ totals: 'full', sets: 'full', injury: 'full' }),
      { restrictions: ['x'], conflicts: [] },
    ],
  ])('none when %s', (_n, c, i) => {
    expect(kinds(run(input({ consent: c, injury: i })))).not.toContain('injury');
  });
});

describe('nodata and modes', () => {
  it('totals only (sets off) -> informational nodata', () => {
    const out = run(input({ consent: consent({ totals: 'full' }), totals: totals([3, 3, 3, 3]) }));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      kind: 'nodata',
      reason: 'sets-not-shared',
      severity: 'good',
      evidence: [],
    });
  });
  it('program mode: no signals at all, whatever the data and consent say', () => {
    const out = run(
      input({
        mode: 'program',
        consent: consent({ totals: 'full', sets: 'full', injury: 'full' }),
        totals: totals([3, 3, 1, 1], 3, 20),
        lifts: [lift([115, 115, 116, 117], { cur: 116 })],
        muscles: [{ muscle: 'legs', weeklySets: [20, 21, 22, 21, 40] }],
        injury: { restrictions: [], conflicts: [{ exercise: 'x', restriction: 'y' }] },
      }),
    );
    expect(out).toEqual([]);
  });
  it('hybrid without data in 4 weeks -> one nodata, no rhythm/stall', () => {
    const out = run(input({ mode: 'hybrid', totals: totals([0, 0, 0, 0], 3, 40), lifts: [] }));
    expect(out.map((s) => [s.kind, s.reason])).toEqual([['nodata', 'no-data']]);
  });
  it('hybrid with logged sessions behaves like app', () => {
    const out = run(input({ mode: 'hybrid', totals: totals([3, 3, 1, 1], 3, 2) }));
    expect(kinds(out)).toEqual(['rhythm']);
  });
  it('hybrid with nothing shared raises nothing', () => {
    expect(
      run(input({ mode: 'hybrid', consent: consent(), totals: totals([0, 0, 0, 0], 3, 40) })),
    ).toEqual([]);
  });
});

describe('consent gating (locked categories never produce evidence)', () => {
  const FULL: ClientSignalInput = {
    clientId: 'c1',
    mode: 'app',
    consent: consent(),
    totals: totals([3, 3, 1, 1], 3, 9),
    lifts: [
      {
        ...lift([115, 115, 116, 117], { cur: 116 }),
        sessions: [session(1, 116, 9, { setsText: 'secret-set-text' }), session(5, 117, 8)],
      },
    ],
    muscles: [{ muscle: 'legs', weeklySets: [20, 21, 22, 21, 40] }],
    injury: {
      restrictions: ['r'],
      conflicts: [{ exercise: 'Military press', restriction: 'secret-restriction' }],
    },
  };
  const LV: Level[] = ['off', 'effects', 'full'];
  const modes: LogMode[] = ['app', 'hybrid', 'program'];
  const cases = modes.flatMap((mode) =>
    LV.flatMap((totalsL) =>
      LV.flatMap((setsL) => LV.map((injuryL) => ({ mode, totalsL, setsL, injuryL }))),
    ),
  );

  it.each(cases)(
    '$mode totals=$totalsL sets=$setsL injury=$injuryL',
    ({ mode, totalsL, setsL, injuryL }) => {
      const c = consent({ totals: totalsL, sets: setsL, injury: injuryL });
      const out = run({ ...FULL, mode, consent: c });
      const eff = mode === 'program' ? consent() : c;
      for (const s of out) {
        for (const e of s.evidence) {
          expect(eff[e.category], `${s.kind} evidence ${e.category}`).not.toBe('off');
          expect(e.level, `${s.kind} level`).toBe(eff[e.category] === 'full' ? e.level : 'effects');
          if (eff[e.category] !== 'full') expect(e.granular).toBe(false);
          expect(e.rows.length).toBeLessThanOrEqual(12);
        }
        if (
          s.kind === 'stall' ||
          s.kind === 'pr' ||
          s.kind === 'ready' ||
          s.kind === 'machine' ||
          s.kind === 'spike'
        )
          expect(eff.sets).not.toBe('off');
        if (s.kind === 'rhythm') expect(eff.totals).not.toBe('off');
        if (s.kind === 'injury') expect(eff.injury).not.toBe('off');
      }
      const json = JSON.stringify(out);
      if (setsL !== 'full' || mode === 'program') expect(json).not.toContain('secret-set-text');
      if (injuryL !== 'full' || mode === 'program')
        expect(json).not.toContain('secret-restriction');
      if (mode === 'program') expect(out).toEqual([]);
    },
  );

  it('gateInput strips what the level does not allow', () => {
    const effects = gateInput(
      { ...FULL, consent: consent({ totals: 'off', sets: 'effects', injury: 'off' }) },
      NOW,
    );
    expect(effects.totals).toBeUndefined();
    expect(effects.injury).toBeUndefined();
    expect(effects.lifts![0].sessions).toBeUndefined();
    expect(effects.lifts![0].weeks!.length).toBeGreaterThan(0);
    const off = gateInput({ ...FULL, consent: consent({ totals: 'full' }) }, NOW);
    expect(off.lifts).toBeUndefined();
    expect(off.muscles).toBeUndefined();
    const prog = gateInput(
      { ...FULL, mode: 'program', consent: consent({ totals: 'full', sets: 'full' }) },
      NOW,
    );
    expect(Object.keys(prog).sort()).toEqual(['clientId', 'consent', 'mode']);
    expect(Object.values(prog.consent).every((l) => l === 'off')).toBe(true);
  });

  it('health categories (sleep, body, nutrition) never alert', () => {
    const c = consent({ sleep: 'full', body: 'full', nutrition: 'full', checkins: 'full' });
    expect(run(input({ consent: c }))).toEqual([]);
  });

  it('data older than 90 days is not read', () => {
    const old = [0, 1, 2, 3].flatMap((i) => [
      session(100 + i * 7, 115, 8),
      session(101 + i * 7, 115, 8),
    ]);
    expect(run(input({ lifts: [{ liftId: 'b', name: 'B', sessions: old }] }))).toEqual([]);
    const l = gateInput(
      input({
        lifts: [{ liftId: 'b', name: 'B', sessions: [session(100, 1, 8), session(10, 1, 8)] }],
      }),
      NOW,
    ).lifts![0];
    expect(l.sessions).toHaveLength(1);
    expect(NOW - l.sessions![0].at).toBe(10 * DAY);
  });
});

describe('ranking', () => {
  it('urgent first, then kind, then strength; deterministic', () => {
    const a = run(
      input({
        lifts: [lift([115, 115, 116, 117], { cur: 116 })],
        totals: totals([3, 3, 3, 3], 3, 8),
      }),
    );
    expect(kinds(a)).toEqual(['stall', 'rhythm']);
    const mk = (
      kind: Signal['kind'],
      severity: Signal['severity'],
      strength: number,
      key: string,
    ): Signal => ({
      key,
      clientId: 'c',
      kind,
      severity,
      confidence: 'high',
      strength,
      exerciseKey: null,
      detectedAt: NOW,
      facts: {},
      evidence: [],
    });
    const list = [
      mk('pr', 'good', 30, 'a'),
      mk('spike', 'watch', 10, 'b'),
      mk('stall', 'urgent', 50, 'c'),
      mk('spike', 'watch', 80, 'd'),
    ];
    expect(rankSignals(list).map((s) => s.key)).toEqual(['c', 'd', 'b', 'a']);
    expect(rankSignals([...list].reverse()).map((s) => s.key)).toEqual(['c', 'd', 'b', 'a']);
  });
  it('week helpers are Monday based', () => {
    expect(CUR).toBe(Date.UTC(2026, 9, 5));
    expect(wkAgo(1)).toBe(Date.UTC(2026, 8, 28));
    expect(week(1, 100).weekStart).toBe(wkAgo(1));
  });
});
