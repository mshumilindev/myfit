import { describe, expect, it } from 'vitest';
import { answerLocally, type AskCtx } from './intents';
import { richCtx } from './testCtx';
import type { Workout } from '../types';

const en = richCtx('en');
const uk = richCtx('uk');
const ask = (q: string, c: AskCtx = en) => answerLocally(q, c);
const DAY = 86_400_000;

/** The same log with sessions of different lengths, so durations can be told apart. */
const withDurations = (c: AskCtx): AskCtx => ({
  ...c,
  s: {
    ...c.s,
    workouts: c.s.workouts.map(
      (w, i) => ({ ...w, finishedAt: w.startedAt + (30 + (i % 5) * 10) * 60_000 }) as Workout,
    ),
  },
});

describe('log questions that compare periods', () => {
  it('says there is nothing to compare with when the period before is empty', () => {
    const a = ask('did my volume go up this year');
    expect(a?.intent).toBe('log_query');
    expect(a?.text).toMatch(
      /Volume, this year: 235 t — nothing in the period before to compare with\./,
    );
    const u = ask('чи виріс мій обʼєм цього року', uk);
    expect(u?.text).toMatch(/цього року: 235 т — за попередній такий самий період даних немає/);
  });
  it('compares two equal-length periods with a signed percentage', () => {
    const a = ask('did my volume go up in the last 2 weeks');
    expect(a?.text).toMatch(
      /Volume: 30\.9 t the last 2 weeks vs 23\.5 t the period before — up \(\+32%\)\./,
    );
  });
  it('says nothing grew when nothing did, naming the lift that held best', () => {
    const a = ask('which lift grew the most in the last month');
    expect(a?.text).toMatch(/Nothing grew, last month — best held: .* Time for a push/);
    expect(ask('яка вправа просіла найбільше', uk)?.text).toMatch(/нічого не просіло/);
  });
  it('says nothing dropped when every lift held or grew', () => {
    expect(ask('which lift dropped the most this month')?.text).toMatch(
      /nothing dropped, this month — every lift held or grew\. Slowest: /,
    );
  });
});

describe('log questions about session length', () => {
  it('finds the shortest session of the year with its date', () => {
    const a = ask('shortest session this year', withDurations(en));
    expect(a?.intent).toBe('log_query');
    expect(a?.text).toMatch(/Shortest workout length, this year: 30 min — /);
  });
  it('averages and finds the longest across differing sessions', () => {
    const c = withDurations(en);
    const avg = ask('average workout duration this year', c);
    expect(avg?.intent).toBe('log_query');
    expect(avg?.text).toMatch(/Average workout length.*this year: 50 min/);
    const max = ask('longest workout length this year', c);
    expect(max?.intent).toBe('longest_session');
    expect(max?.text).toMatch(
      /Longest: 70 min \(9\/5\/2026\)\. Shortest: 30 min \(9\/21\/2026\)\./,
    );
  });
});

describe('log questions with no matching data', () => {
  const empty: AskCtx = { ...en, s: { ...en.s, workouts: [] } };
  it('does not invent numbers for an empty log', () => {
    for (const q of [
      'top 3 lifts by volume',
      'average weight on bench this year',
      'volume by month',
    ]) {
      const a = ask(q, empty);
      expect(a?.text ?? '', q).not.toMatch(/undefined|NaN|Infinity/);
    }
  });
  it('an old log has nothing in the last weeks', () => {
    const old: AskCtx = { ...en, now: en.now + 400 * DAY };
    const a = ask('total volume last month', old);
    expect(a?.text ?? '').not.toMatch(/NaN|undefined/);
  });
});

describe('follow-ups that change one part of the last log question', () => {
  /** Ask in sequence, carrying the conversation state like the chat does. */
  const chain = (qs: string[], c: AskCtx = en) => {
    let convo = {};
    return qs.map((q) => {
      const a = answerLocally(q, c, convo);
      convo = a?.convo ?? {};
      return a;
    });
  };

  it('switching the period keeps the measure: “and last year?” after a monthly total', () => {
    const [first, next] = chain(['total volume last month', 'and last year?']);
    expect(first?.text).toMatch(/total volume, last month: 54\.4 t\./);
    expect(next?.intent).toBe('log_query');
    expect(next?.text).toBe('Nothing logged for that (last year).');
  });
  it('switching the lift keeps the measure and period: “and squat?”', () => {
    const [, sq] = chain(['average reps on bench in august', 'and squat?']);
    expect(sq?.intent).toBe('log_query');
    expect(sq?.text).toMatch(/^Reps per set, Barbell Full Squat, in August: 6\./);
  });
  it('switching the breakdown and the lift: “by week”, “by month”, “what about squat?”', () => {
    const r = chain([
      'total volume last month',
      'and sets?',
      'all time',
      'by week',
      'by month',
      'what about squat?',
    ]);
    expect(r[3]?.text).toMatch(
      /^Working sets \(all time\): ~24\.2 a week on average; best Jul 6 — 30\./,
    );
    expect(r[3]?.chips).toEqual(['By month', 'This month', 'Which lift improved most?']);
    expect(r[4]?.text).toMatch(
      /^Working sets \(all time\): ~90 a month on average; best Jun 26 — 120\./,
    );
    expect(r[4]?.chips?.[0]).toBe('This month');
    expect(r[5]?.text).toMatch(
      /^Working sets \(Barbell Full Squat, all time\): ~18 a month on average; best Jun 26 — 24\./,
    );
  });
  it('re-ranks by another measure: “and by sets?”, “and reps?”', () => {
    const r = chain(['top 5 lifts by volume', 'and by sets?', 'and reps?']);
    expect(r[0]?.text).toMatch(
      /^By volume \(all time\), most: Barbell Deadlift \(62\.6 t\)\. Top 5: 1\./,
    );
    expect(r[1]?.text).toMatch(
      /^By working sets \(all time\), most: Barbell Bench Press - Medium Grip \(90\)\./,
    );
    expect(r[2]?.text).toMatch(
      /^By reps \(all time\), most: Barbell Bench Press - Medium Grip \(720\)\./,
    );
    expect(r[2]?.text.match(/\d\. /g)?.length).toBe(5);
  });
  it('re-asks “which lift improved most” for another period', () => {
    const [a, b, c] = chain(['which lift improved most', 'and this year?', 'and last month']);
    expect(a?.text).toMatch(
      /^Most improved, the last 3 months: Barbell Bench Press - Medium Grip \(\+2%\)/,
    );
    expect(b?.text).toMatch(
      /^Most improved, this year: Pullups \(\+30%\)\. 1\. Pullups \+30% \(10 kg → 13 kg\); 2\. Barbell Curl \+7%/,
    );
    expect(c?.text).toMatch(/^Nothing grew, last month/);
  });
  it('a full question of its own is not a follow-up', () => {
    const [, b] = chain(['total volume last month', 'which day do I train most']);
    expect(b?.text).not.toMatch(/Nothing logged/);
    expect(b?.text).toMatch(/most: \w+day/i);
  });
  it('offers sensible next questions, never the one just asked', () => {
    const [a] = chain(['total volume last month']);
    expect(a?.chips).toEqual(['By week', 'Last month', 'Which lift improved most?']);
    const [m] = chain(['sets by muscle this month']);
    expect(m?.chips ?? []).not.toContain('Sets by muscle this month');
  });
});
