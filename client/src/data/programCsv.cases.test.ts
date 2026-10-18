import { describe, expect, it } from 'vitest';
import {
  TEMPLATE_HEADERS,
  buildRows,
  detectColumns,
  guessField,
  levenshtein,
  nearest,
  parseCsv,
  programToCsv,
  revalidate,
  rowsToItems,
  splitSetsReps,
  summarize,
  templateCsv,
  type CsvColumn,
  type ParsedRow,
  type ProgramItemLike,
} from './programCsv';

function rowsFor(csv: string, known: string[] = []) {
  const grid = parseCsv(csv);
  const cols = detectColumns(grid[0]);
  return { grid, cols, rows: buildRows(grid, cols, known) };
}

function row(over: Partial<ParsedRow> = {}): ParsedRow {
  return {
    index: 1,
    day: 1,
    name: 'Squat',
    kind: 'strength',
    sets: 3,
    reps: 5,
    durationMin: null,
    equipment: [],
    suggestion: null,
    unknownEquipment: [],
    problems: [],
    ...over,
  };
}

describe('parseCsv edge cases', () => {
  it('returns no rows for empty or blank-only input', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('\n\r\n  ,  \n')).toEqual([]);
  });

  it('strips a UTF-8 BOM from the first header', () => {
    expect(parseCsv('﻿Day,Exercise\n1,Squat')[0]).toEqual(['Day', 'Exercise']);
  });

  it('treats a lone CR, LF and CRLF each as one row break', () => {
    expect(parseCsv('a\rb\nc\r\nd')).toEqual([['a'], ['b'], ['c'], ['d']]);
  });

  it('un-escapes doubled quotes and keeps newlines/commas inside quotes', () => {
    expect(parseCsv('"say ""hi""","a,b","l1\nl2"')).toEqual([['say "hi"', 'a,b', 'l1\nl2']]);
  });

  it('keeps empty cells, including a trailing comma and a missing final newline', () => {
    expect(parseCsv('a,,c,\n1,2,3,4')).toEqual([
      ['a', '', 'c', ''],
      ['1', '2', '3', '4'],
    ]);
  });

  it('keeps the text of an unterminated quote instead of dropping the row', () => {
    expect(parseCsv('a,"open cell')).toEqual([['a', 'open cell']]);
  });
});

describe('guessField', () => {
  it.each([
    ['Sets x Reps', 'setsReps'],
    ['reps × sets', 'setsReps'],
    ['Scheme', 'setsReps'],
    ['Day', 'day'],
    ['  WEEKDAY ', 'day'],
    ['DOW', 'day'],
    ['Exercise', 'name'],
    ['Movement', 'name'],
    ['Kind', 'kind'],
    ['Category', 'kind'],
    ['Duration', 'duration'],
    ['Mins', 'duration'],
    ['Equipment', 'equipment'],
    ['Gear', 'equipment'],
    ['Weight', 'weight'],
    ['Load', 'weight'],
    ['kg', 'weight'],
    ['%1RM', 'weight'],
    ['RPE', 'weight'],
    ['Sets', 'sets'],
    ['Set', 'sets'],
    ['Reps', 'reps'],
    ['Rep', 'reps'],
    ['Notes', 'ignore'],
    ['', 'ignore'],
  ] as const)('maps header %j to %s', (header, field) => {
    expect(guessField(header)).toBe(field);
  });

  it('detectColumns keeps the original header text and order', () => {
    expect(detectColumns(['Day', 'Weight', '??'])).toEqual([
      { header: 'Day', field: 'day' },
      { header: 'Weight', field: 'weight' },
      { header: '??', field: 'ignore' },
    ]);
  });
});

describe('splitSetsReps', () => {
  it('accepts x, x with spaces, multiplication sign and star, case-insensitively', () => {
    expect(splitSetsReps('3x8')).toEqual({ sets: 3, reps: 8 });
    expect(splitSetsReps(' 4 × 10 ')).toEqual({ sets: 4, reps: 10 });
    expect(splitSetsReps('5*5')).toEqual({ sets: 5, reps: 5 });
    expect(splitSetsReps('3X12')).toEqual({ sets: 3, reps: 12 });
  });

  it('rejects anything that is not exactly N x M', () => {
    expect(splitSetsReps('')).toEqual({});
    expect(splitSetsReps('3x')).toEqual({});
    expect(splitSetsReps('3x8x2')).toEqual({});
    expect(splitSetsReps('3-8')).toEqual({});
    expect(splitSetsReps('3 sets of 8')).toEqual({});
  });
});

describe('levenshtein / nearest', () => {
  it('computes the classic edit distance', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('abc', 'abc')).toBe(0);
    expect(levenshtein('', 'abcd')).toBe(4);
    expect(levenshtein('abcd', '')).toBe(4);
    expect(levenshtein('flaw', 'lawn')).toBe(2);
  });

  it('suggests within tolerance, case- and whitespace-insensitively, returning the known spelling', () => {
    expect(nearest('  bech PRESS ', ['Bench Press', 'Squat'])).toBe('Bench Press');
  });

  it('allows an absolute tolerance of 2 for short names, not 3', () => {
    expect(nearest('squt', ['Squat'])).toBe('Squat'); // distance 1
    expect(nearest('sqt', ['squat'])).toBe('squat'); // distance 2 == tolerance
    expect(nearest('sq', ['squat'])).toBeNull(); // distance 3 > 2
  });

  it('scales tolerance with length (34 percent) for long names', () => {
    // 20 chars -> tolerance 6
    const target = 'abcdefghijklmnopqrst';
    expect(nearest(target, ['abcdefghijklmnopqrXXXXXX'.slice(0, 20)])).toBe('abcdefghijklmnopqrXX');
    expect(nearest(target, ['XXXXXXXabcdefghijklm'])).toBeNull(); // far more than 6 edits
  });

  it('returns null for an empty target or an empty vocabulary', () => {
    expect(nearest('   ', ['Squat'])).toBeNull();
    expect(nearest('Squat', [])).toBeNull();
  });

  it('keeps the first of equally close candidates', () => {
    expect(nearest('cat', ['bat', 'hat'])).toBe('bat');
  });
});

describe('buildRows', () => {
  it('maps a full row, defaulting kind to strength and ignoring weight', () => {
    const { rows } = rowsFor('Day,Exercise,Sets,Reps,Weight\n2,Squat,5,5,140');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      index: 1,
      day: 2,
      name: 'Squat',
      kind: 'strength',
      sets: 5,
      reps: 5,
      durationMin: null,
      equipment: [],
      problems: [],
    });
  });

  it('numbers rows from 1 in file order', () => {
    const { rows } = rowsFor('Day,Exercise,Reps\n1,A,5\n1,B,5\n1,C,5');
    expect(rows.map((r) => r.index)).toEqual([1, 2, 3]);
  });

  it('defaults sets to 3 when absent or zero', () => {
    expect(rowsFor('Day,Exercise,Reps\n1,Curl,10').rows[0].sets).toBe(3);
    expect(rowsFor('Day,Exercise,Sets,Reps\n1,Curl,0,10').rows[0].sets).toBe(3);
  });

  it('clamps sets to 1..12 and reps to 0..100', () => {
    const { rows } = rowsFor('Day,Exercise,Sets,Reps\n1,A,99,500\n1,B,-4,-9\n1,C,12,100\n1,D,1,1');
    expect(rows.map((r) => [r.sets, r.reps])).toEqual([
      [12, 100],
      [1, 0],
      [12, 100],
      [1, 1],
    ]);
    expect(rows[1].problems).toContain('missing-reps');
  });

  it('truncates decimals and treats non-numeric cells as missing', () => {
    const { rows } = rowsFor('Day,Exercise,Sets,Reps\n1,A,3.9,8.7\n1,B,abc,xyz');
    expect([rows[0].sets, rows[0].reps]).toEqual([3, 8]);
    expect([rows[1].sets, rows[1].reps]).toEqual([3, 0]);
  });

  it('fills missing sets/reps from a combined column but never overrides complete ones', () => {
    const only = rowsFor('Day,Exercise,Sets x Reps\n1,Row,4x12').rows[0];
    expect([only.sets, only.reps]).toEqual([4, 12]);
    const both = rowsFor('Day,Exercise,Sets,Reps,Sets x Reps\n1,Row,5,6,3x8').rows[0];
    expect([both.sets, both.reps]).toEqual([5, 6]);
    const partial = rowsFor('Day,Exercise,Sets,Reps,Sets x Reps\n1,Row,,,2x15').rows[0];
    expect([partial.sets, partial.reps]).toEqual([2, 15]);
  });

  it('ignores an unparsable combined column', () => {
    const r = rowsFor('Day,Exercise,Sets x Reps\n1,Row,lots').rows[0];
    expect([r.sets, r.reps]).toEqual([3, 0]);
    expect(r.problems).toContain('missing-reps');
  });

  it('accepts the four kinds case-insensitively and falls back to strength', () => {
    const { rows } = rowsFor(
      'Day,Exercise,Kind,Reps\n1,A,CARDIO,\n1,B,Warmup,\n1,C,cooldown,\n1,D,strength,5\n1,E,mystery,5\n1,F,,5',
    );
    expect(rows.map((r) => r.kind)).toEqual([
      'cardio',
      'warmup',
      'cooldown',
      'strength',
      'strength',
      'strength',
    ]);
  });

  it('gives non-strength rows a duration (default 10 when unparsable) and strength none', () => {
    const { rows } = rowsFor(
      'Day,Exercise,Kind,Duration,Reps\n1,Run,cardio,25,\n1,Jog,cardio,abc,\n1,Lift,strength,40,5',
    );
    expect(rows.map((r) => r.durationMin)).toEqual([25, 10, null]);
  });

  it('does not require reps for non-strength rows', () => {
    const r = rowsFor('Day,Exercise,Kind,Duration\n3,Run,cardio,20').rows[0];
    expect(r.problems).toEqual([]);
  });

  it('flags a missing or blank name', () => {
    const { rows } = rowsFor('Day,Exercise,Reps\n1,   ,5\n1,,5');
    expect(rows.every((r) => r.problems.includes('missing-name'))).toBe(true);
  });

  it('flags bad days (0, blank, 8, text) and clamps them into 1..7 on the row', () => {
    const { rows } = rowsFor('Day,Exercise,Reps\n0,A,5\n,B,5\n8,C,5\nmon,D,5\n7,E,5\n1,F,5');
    expect(rows.map((r) => r.day)).toEqual([1, 1, 7, 1, 7, 1]);
    expect(rows.map((r) => r.problems.includes('bad-day'))).toEqual([
      true,
      true,
      true,
      true,
      false,
      false,
    ]);
  });

  it('treats a file without a day column as bad-day on every row', () => {
    const { rows } = rowsFor('Exercise,Reps\nSquat,5');
    expect(rows[0].day).toBe(1);
    expect(rows[0].problems).toEqual(['bad-day']);
  });

  it('matches equipment ids loosely, de-duplicates and reports unknown tokens', () => {
    const { rows } = rowsFor(
      'Day,Exercise,Reps,Equipment\n1,A,5,"Dumb Bell; ez-bar | BARBELL / barbell; unicorn; "',
    );
    expect(rows[0].equipment).toEqual(['dumbbell', 'ezBar', 'barbell']);
    expect(rows[0].unknownEquipment).toEqual(['unicorn']);
    expect(rows[0].problems).toEqual(['unknown-equipment']);
  });

  it('copes with short rows (missing trailing cells)', () => {
    const { rows } = rowsFor('Day,Exercise,Reps,Equipment\n1,Squat');
    expect(rows[0]).toMatchObject({ name: 'Squat', reps: 0, equipment: [] });
  });

  it('suggests the nearest known exercise and flags the unmatched name', () => {
    const { rows } = rowsFor('Day,Exercise,Reps\n1,Bech Press,5\n1,Zzzzzzzz,5\n1,squat,5', [
      'Bench Press',
      'Squat',
    ]);
    expect(rows[0].suggestion).toBe('Bench Press');
    expect(rows[0].problems).toContain('unmatched-exercise');
    expect(rows[1].suggestion).toBeNull();
    expect(rows[1].problems).toContain('unmatched-exercise');
    // exact (case-insensitive) match -> no flag, no suggestion
    expect(rows[2].problems).toEqual([]);
    expect(rows[2].suggestion).toBeNull();
  });

  it('does not flag names when no vocabulary is supplied', () => {
    expect(rowsFor('Day,Exercise,Reps\n1,Anything,5').rows[0].problems).toEqual([]);
  });

  it('returns no rows for a header-only grid', () => {
    expect(rowsFor('Day,Exercise,Reps').rows).toEqual([]);
  });
});

describe('revalidate', () => {
  it('recomputes problems from scratch after an inline edit', () => {
    const bad = row({ name: '', reps: 0, day: 9, unknownEquipment: ['x'], problems: ['bad-day'] });
    expect(revalidate(bad).problems).toEqual([
      'missing-name',
      'missing-reps',
      'bad-day',
      'unknown-equipment',
    ]);
    const fixed = { ...bad, name: 'Squat', reps: 5, day: 3, unknownEquipment: [] };
    expect(revalidate(fixed).problems).toEqual([]);
  });

  it('accepts day 1 and 7, rejects 0 and 8', () => {
    expect(revalidate(row({ day: 1 })).problems).toEqual([]);
    expect(revalidate(row({ day: 7 })).problems).toEqual([]);
    expect(revalidate(row({ day: 0 })).problems).toEqual(['bad-day']);
    expect(revalidate(row({ day: 8 })).problems).toEqual(['bad-day']);
  });

  it('clears a stale suggestion once the name matches the vocabulary', () => {
    const r = revalidate(row({ name: 'Squat', suggestion: 'Old' }), ['squat ']);
    expect(r.suggestion).toBeNull();
    expect(r.problems).toEqual([]);
  });

  it('does not mutate its input', () => {
    const input = row({ name: '' });
    revalidate(input);
    expect(input.problems).toEqual([]);
  });
});

describe('summarize', () => {
  const cols: CsvColumn[] = [{ header: 'Day', field: 'day' }];

  it('counts rows, distinct days, valid vs problem rows', () => {
    const rows = [
      row({ day: 1 }),
      row({ day: 1, problems: ['missing-reps'] }),
      row({ day: 3, problems: ['bad-day', 'missing-name'] }),
    ];
    expect(summarize(rows, cols)).toEqual({
      rows: 3,
      days: 2,
      weeks: 1,
      valid: 1,
      problems: 2,
      discardedWeight: false,
    });
  });

  it('reports a discarded weight column only when one was mapped', () => {
    expect(summarize([], [{ header: 'kg', field: 'weight' }]).discardedWeight).toBe(true);
    expect(summarize([], [{ header: 'kg', field: 'ignore' }]).discardedWeight).toBe(false);
    expect(summarize([], [])).toMatchObject({ rows: 0, days: 0, valid: 0, problems: 0 });
  });
});

describe('rowsToItems', () => {
  it('numbers positions per day, drops nameless rows and clamps day', () => {
    const items = rowsToItems([
      row({ day: 2, name: 'A' }),
      row({ day: 2, name: '' }),
      row({ day: 5, name: 'B' }),
      row({ day: 2, name: 'C' }),
      row({ day: 9, name: 'D' }),
      row({ day: 0, name: 'E' }),
    ]);
    expect(items.map((i) => [i.day, i.position, i.name])).toEqual([
      [2, 0, 'A'],
      [5, 0, 'B'],
      [2, 1, 'C'],
      [7, 0, 'D'],
      [1, 0, 'E'],
    ]);
  });

  it('carries sets, reps, kind, duration and equipment through', () => {
    const [it0] = rowsToItems([
      row({ kind: 'cardio', sets: 1, reps: 0, durationMin: 25, equipment: ['body'] }),
    ]);
    expect(it0).toEqual({
      day: 1,
      position: 0,
      name: 'Squat',
      kind: 'cardio',
      sets: 1,
      reps: 0,
      durationMin: 25,
      equipment: ['body'],
    });
  });
});

describe('templateCsv / programToCsv', () => {
  it('the template parses back to its headers and three example rows', () => {
    const grid = parseCsv(templateCsv());
    expect(grid[0]).toEqual([...TEMPLATE_HEADERS]);
    expect(grid).toHaveLength(4);
    expect(grid[2]).toEqual(['1', 'Row', 'strength', '3', '8', '', 'barbell;cable']);
    expect(templateCsv()).toContain('\r\n');
  });

  it('the template imports without any problems', () => {
    const { rows } = rowsFor(templateCsv(), ['Back Squat', 'Row', 'Easy Run']);
    expect(rows.every((r) => r.problems.length === 0)).toBe(true);
    expect(rows[2]).toMatchObject({ kind: 'cardio', durationMin: 25, equipment: ['body'] });
    expect(rows[1].equipment).toEqual(['barbell', 'cable']);
  });

  const items: ProgramItemLike[] = [
    {
      day: 3,
      position: 1,
      name: 'Plank, long',
      kind: 'cooldown',
      sets: 1,
      reps: 0,
      durationMin: null,
      equipment: [],
    },
    {
      day: 1,
      position: 1,
      name: 'Bench "Pro"',
      kind: 'strength',
      sets: 4,
      reps: 6,
      durationMin: null,
      equipment: ['barbell', 'body'],
    },
    {
      day: 1,
      position: 0,
      name: 'Squat',
      kind: 'strength',
      sets: 5,
      reps: 5,
      durationMin: null,
      equipment: ['barbell'],
    },
    {
      day: 3,
      position: 0,
      name: 'Run',
      kind: 'cardio',
      sets: 1,
      reps: 0,
      durationMin: 30,
      equipment: ['body'],
    },
  ];

  it('sorts by day then position, quotes special characters and omits load', () => {
    const lines = programToCsv(items).split('\r\n');
    expect(lines[0]).toBe('Day,Exercise,Kind,Sets,Reps,Duration,Equipment');
    expect(lines.slice(1)).toEqual([
      '1,Squat,strength,5,5,,barbell',
      '1,"Bench ""Pro""",strength,4,6,,barbell;body',
      '3,Run,cardio,,,30,body',
      '3,"Plank, long",cooldown,,,10,',
    ]);
  });

  it('does not reorder the caller array', () => {
    const copy = items.map((i) => i.name);
    programToCsv(items);
    expect(items.map((i) => i.name)).toEqual(copy);
  });

  it('round-trips: export then import reproduces the same program', () => {
    const { rows } = rowsFor(programToCsv(items));
    const back = rowsToItems(rows);
    const expected = [...items]
      .sort((a, b) => a.day - b.day || a.position - b.position)
      .map((i, n, arr) => ({
        ...i,
        position: arr.slice(0, n).filter((x) => x.day === i.day).length,
        sets: i.kind === 'strength' ? i.sets : 3,
        reps: i.kind === 'strength' ? i.reps : 0,
        durationMin: i.kind === 'strength' ? null : (i.durationMin ?? 10),
      }));
    expect(back).toEqual(expected);
  });

  it('exports an empty program as just the header', () => {
    expect(programToCsv([])).toBe('Day,Exercise,Kind,Sets,Reps,Duration,Equipment');
  });
});
