import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { STREAK_MAX_GAP, computeStreak } from '../client/src/streak';
import {
  awakeMsAt,
  classifySleepKind,
  lastBedtimeAt,
  localDayId,
  minutesOfDay,
  nightDurationMin,
} from '../client/src/sleep';
import { dayKey } from '../client/src/store';
import { fmtBodyWeightKg, fmtKg, fmtTonnes } from '../client/src/i18n';
import { fmtWeightValue } from '../client/src/fmtWeight';
import { parseProgramsHash } from '../client/src/views/programs/programsRoute';
import { parseCoachHash } from '../client/src/coach/routes';
import { parseClientRoute } from '../client/src/coach/client/routes';
import { parseCallLog } from '../client/src/calls/callLog';
import { parseQuiet } from '../client/src/quietHours';
import { parseRange } from '../client/src/atlas/when';
import { parseFrame } from '../client/src/atlas/frame';
import { parseShareRef } from '../client/src/coach/share/types';
import { parseAnchor } from '../client/src/coach/notes/types';
import { parseHidden } from '../client/src/coach/schedule/legend';
import { parseDraft } from '../client/src/coach/schedule/grid';
import type { SleepNight } from '../client/src/types';

/**
 * SPO-66: property-based and fuzz tests (fast-check) on the pure logic that has had bugs: the streak (SPO-42), auto sleep
 * (SPO-43), weights, day boundaries across time zones and daylight saving, and the parsers of untrusted text.
 * A failing property prints a minimal counter-example and a seed: add it as a plain example test next to the fix.
 */
const RUNS = { numRuns: 300 };

describe('streak', () => {
  const days = fc.record({
    today: fc.integer({ min: 100, max: 200 }),
    span: fc.integer({ min: 0, max: 60 }),
    covered: fc.array(fc.integer({ min: 0, max: 80 }), { maxLength: 80 }),
  });
  const run = (today: number, span: number, covered: Set<number>, extra?: (d: number) => boolean) =>
    computeStreak({
      trained: covered,
      isProtected: extra ?? (() => false),
      today,
      floorDay: today - span,
    });

  it('is within 0..window length, whatever is covered', () => {
    fc.assert(
      fc.property(days, ({ today, span, covered }) => {
        const s = run(today, span, new Set(covered.map((c) => today - c)));
        return s >= 0 && s <= span + 1;
      }),
      RUNS,
    );
  });

  it('never shrinks when one more day is covered', () => {
    fc.assert(
      fc.property(days, fc.integer({ min: 0, max: 60 }), ({ today, span, covered }, extra) => {
        const base = new Set(covered.map((c) => today - c));
        const more = new Set([...base, today - extra]);
        return run(today, span, more) >= run(today, span, base);
      }),
      RUNS,
    );
  });

  it('counts every day of the window when every day is covered', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 200 }),
        fc.integer({ min: 0, max: 60 }),
        (today, span) => {
          expect(run(today, span, new Set(), () => true)).toBe(span + 1);
        },
      ),
      RUNS,
    );
  });

  it('is 0 with nothing covered, and 0 when the floor is after today', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 200 }),
        fc.integer({ min: 0, max: 60 }),
        (today, span) => {
          expect(run(today, span, new Set())).toBe(0);
          expect(
            computeStreak({
              trained: new Set([today]),
              isProtected: () => false,
              today,
              floorDay: today + 1,
            }),
          ).toBe(0);
        },
      ),
      RUNS,
    );
  });

  it('forgives exactly STREAK_MAX_GAP empty days in a row, and not one more', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 200 }),
        fc.integer({ min: 1, max: 20 }),
        (today, before) => {
          const bridged = new Set([today, today - 1 - STREAK_MAX_GAP]);
          const broken = new Set([today, today - 2 - STREAK_MAX_GAP]);
          const floor = today - 1 - STREAK_MAX_GAP - before;
          const a = computeStreak({
            trained: bridged,
            isProtected: () => false,
            today,
            floorDay: floor,
          });
          const b = computeStreak({
            trained: broken,
            isProtected: () => false,
            today,
            floorDay: floor,
          });
          expect(a).toBe(2);
          expect(b).toBe(1);
        },
      ),
      RUNS,
    );
  });

  it('an empty today is free: it does not use up the forgiven gap days', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 200 }),
        fc.integer({ min: 0, max: 20 }),
        (today, before) => {
          const trained = new Set([today - 1 - STREAK_MAX_GAP]);
          const floor = today - 1 - STREAK_MAX_GAP - before;
          expect(computeStreak({ trained, isProtected: () => false, today, floorDay: floor })).toBe(
            1,
          );
        },
      ),
      RUNS,
    );
  });

  it('an empty today never breaks the chain that ended yesterday', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 200 }),
        fc.integer({ min: 1, max: 30 }),
        (today, n) => {
          const trained = new Set(Array.from({ length: n }, (_, i) => today - 1 - i));
          expect(
            computeStreak({ trained, isProtected: () => false, today, floorDay: today - n }),
          ).toBe(n);
        },
      ),
      RUNS,
    );
  });
});

const ZONES = [
  'UTC',
  'Europe/Kyiv',
  'America/Los_Angeles',
  'Pacific/Auckland',
  'Australia/Lord_Howe',
  'Asia/Kolkata',
];
const T0 = Date.UTC(2020, 0, 1);
const T1 = Date.UTC(2030, 0, 1);
const instant = fc.integer({ min: T0, max: T1 });

describe.each(ZONES)('time zones and daylight saving: %s', (zone) => {
  let before: string | undefined;
  beforeEach(() => {
    before = process.env.TZ;
    process.env.TZ = zone;
  });
  afterEach(() => {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  });

  it('local day keys never go backwards, and local noon of consecutive dates differs by exactly one day', () => {
    fc.assert(
      fc.property(instant, fc.integer({ min: 0, max: 3 * 3_600_000 }), (ts, dt) => {
        expect(dayKey(ts + dt)).toBeGreaterThanOrEqual(dayKey(ts));
        const d = new Date(ts);
        const noon = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime();
        const nextNoon = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12).getTime();
        expect(dayKey(nextNoon) - dayKey(noon)).toBe(1);
      }),
      RUNS,
    );
  });

  it('localDayId matches the local calendar date and sorts like time', () => {
    fc.assert(
      fc.property(instant, fc.integer({ min: 0, max: 400 * 3_600_000 }), (ts, dt) => {
        expect(localDayId(ts)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(localDayId(ts + dt) >= localDayId(ts)).toBe(true);
        const d = new Date(ts);
        expect(localDayId(ts)).toBe(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        );
      }),
      RUNS,
    );
  });

  it('the last scheduled bedtime is at or before now, at most one day plus the DST hour back, and has the right clock time', () => {
    fc.assert(
      fc.property(instant, fc.integer({ min: 0, max: 1439 }), (now, bedMin) => {
        const bed = lastBedtimeAt(now, bedMin);
        expect(bed).toBeLessThanOrEqual(now);
        expect(now - bed).toBeLessThanOrEqual(25 * 3_600_000);
        // A bedtime inside the skipped spring-forward hour does not exist; every other clock time is exact (or one DST hour away).
        const diff = Math.abs(minutesOfDay(bed) - bedMin);
        expect(Math.min(diff, 1440 - diff)).toBeLessThanOrEqual(60);
      }),
      RUNS,
    );
  });
});

describe('sleep', () => {
  const night = fc.record({
    bedtime: instant,
    wake: fc.option(instant, { nil: undefined }),
    awakeMs: fc.option(fc.integer({ min: 0, max: 6 * 3_600_000 }), { nil: undefined }),
    awakeSince: fc.option(instant, { nil: undefined }),
    lastSeen: fc.option(instant, { nil: undefined }),
  });
  const asNight = (n: object) => ({ id: 'n', ...n }) as unknown as SleepNight;

  it('awake time is never negative and never below what is banked', () => {
    fc.assert(
      fc.property(night, instant, (n, now) => {
        const a = awakeMsAt(asNight(n), now);
        expect(a).toBeGreaterThanOrEqual(n.awakeMs ?? 0);
        expect(Number.isFinite(a)).toBe(true);
      }),
      RUNS,
    );
  });

  it('a night lasts a non-negative whole number of minutes, never longer than bedtime to end', () => {
    fc.assert(
      fc.property(night, instant, (n, now) => {
        const m = nightDurationMin(asNight(n), now);
        const end = n.wake ?? now;
        expect(Number.isInteger(m)).toBe(true);
        expect(m).toBeGreaterThanOrEqual(0);
        expect(m).toBeLessThanOrEqual(Math.max(0, Math.round((end - n.bedtime) / 60000)));
      }),
      RUNS,
    );
  });

  it('anything over three hours of sleep is night sleep; the kind is always sleep or nap', () => {
    fc.assert(
      fc.property(
        instant,
        fc.integer({ min: 0, max: 24 * 3_600_000 }),
        fc.integer({ min: 0, max: 3_600_000 }),
        (bed, len, awake) => {
          const kind = classifySleepKind(bed, bed + len, awake);
          expect(['sleep', 'nap']).toContain(kind);
          if ((len - awake) / 60000 > 180) expect(kind).toBe('sleep');
        },
      ),
      RUNS,
    );
  });
});

describe('weights', () => {
  const kg = fc.double({ min: 0, max: 700, noNaN: true });

  it('body weight text keeps the logged value to one decimal and is never NaN', () => {
    fc.assert(
      fc.property(kg, (w) => {
        const text = fmtBodyWeightKg(w);
        expect(text).not.toMatch(/NaN|Infinity/);
        expect(Math.abs(parseFloat(text) - w)).toBeLessThanOrEqual(0.05 + 1e-9);
      }),
      RUNS,
    );
  });

  it('session weight text keeps one decimal', () => {
    fc.assert(
      fc.property(kg, (w) => {
        expect(fmtWeightValue(w)).toMatch(/^\d+\.\d$/);
        expect(Math.abs(parseFloat(fmtWeightValue(w)) - w)).toBeLessThanOrEqual(0.05 + 1e-9);
      }),
      RUNS,
    );
  });

  it('whole-kilo text rounds to the nearest kilo and tonnes to a tenth', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 5_000_000, noNaN: true }), (w) => {
        expect(Number(fmtKg(w).replace(/\s/g, '').replace('kg', ''))).toBe(Math.round(w));
        expect(Math.abs(parseFloat(fmtTonnes(w)) - w / 1000)).toBeLessThanOrEqual(0.05 + 1e-9);
      }),
      RUNS,
    );
  });
});

describe('fuzz: parsers of untrusted text never throw', () => {
  const text = fc.oneof(
    fc.string({ maxLength: 200 }),
    fc.string({ unit: 'binary', maxLength: 120 }),
    fc.constantFrom(
      '#',
      '#/',
      '#/coach',
      '#/coach/clients/',
      '#/programs/',
      '%',
      '%E0%A4%A',
      '{"a":',
      '[]',
      'null',
      '😀',
      '\u0000',
      '../',
    ),
  );
  const anything = fc.anything();

  it('route parsers return a route or null', () => {
    fc.assert(
      fc.property(text, (s) => {
        for (const p of [parseProgramsHash, parseCoachHash, parseClientRoute]) {
          const r = p(s);
          expect(r === null || typeof r === 'object').toBe(true);
        }
      }),
      RUNS,
    );
  });

  it('message and settings parsers accept any text or value', () => {
    fc.assert(
      fc.property(text, anything, (s, v) => {
        parseCallLog(s);
        parseHidden(s);
        parseDraft(s);
        parseQuiet(v);
        parseShareRef(v);
        parseAnchor(v);
      }),
      RUNS,
    );
  });

  it('the Atlas phrase parsers survive any question', () => {
    fc.assert(
      fc.property(text, instant, (s, now) => {
        parseRange(s, now);
        parseFrame(s, undefined, now);
      }),
      { numRuns: 150 },
    );
  });
});
