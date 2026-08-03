/**
 * CSV import/export for program authoring (AC-CSV-01…10, board PG-02).
 *
 * All pure, side-effect-free helpers so the two-stage dialog (map → preview)
 * and a node test can share them. A weight/load column is always detected and
 * discarded — an imported file can never introduce load into a program
 * (AC-CSV-03). Export is round-trip safe and carries no weight (AC-CSV-10).
 */
import type { ExerciseKind } from '../types';
import { EQUIPMENT_IDS, type EquipmentId } from './equipment';

export type CsvField =
  | 'day'
  | 'name'
  | 'sets'
  | 'reps'
  | 'setsReps'
  | 'equipment'
  | 'kind'
  | 'duration'
  | 'weight'
  | 'ignore';

export interface CsvColumn {
  header: string;
  field: CsvField;
}

export type RowProblem =
  'missing-name' | 'missing-reps' | 'bad-day' | 'unknown-equipment' | 'unmatched-exercise';

export interface ParsedRow {
  index: number;
  day: number;
  name: string;
  kind: ExerciseKind;
  sets: number;
  reps: number;
  durationMin: number | null;
  equipment: EquipmentId[];
  suggestion: string | null;
  unknownEquipment: string[];
  problems: RowProblem[];
}

export interface ImportShape {
  rows: number;
  days: number;
  weeks: number;
  valid: number;
  problems: number;
  discardedWeight: boolean;
}

export interface ProgramItemLike {
  day: number;
  position: number;
  name: string;
  kind: ExerciseKind;
  sets: number;
  reps: number;
  durationMin: number | null;
  equipment: EquipmentId[];
}

const KINDS: ExerciseKind[] = ['strength', 'cardio', 'warmup', 'cooldown'];

/** RFC-4180-ish parse: comma-separated, double-quote quoting, CRLF tolerant. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += c;
      }
      continue;
    }
    if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += c;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

/** Guess a field for a header by keyword. */
export function guessField(header: string): CsvField {
  const h = header.trim().toLowerCase();
  if (/\b(set)s?\s*[x×*]\s*rep|reps?\s*[x×*]\s*set|scheme/.test(h)) return 'setsReps';
  if (/(^|\b)(day|dow|weekday)\b/.test(h)) return 'day';
  if (/(exercise|movement|lift|name)/.test(h)) return 'name';
  if (/(kind|type|category)/.test(h)) return 'kind';
  if (/(duration|minutes|mins?|time)/.test(h)) return 'duration';
  if (/(equipment|gear|kit)/.test(h)) return 'equipment';
  if (/(weight|load|kg|lbs?|%1?rm|rpe)/.test(h)) return 'weight';
  if (/\bsets?\b/.test(h)) return 'sets';
  if (/\breps?\b/.test(h)) return 'reps';
  return 'ignore';
}

export function detectColumns(headers: string[]): CsvColumn[] {
  return headers.map((header) => ({ header, field: guessField(header) }));
}

/** Split "3x8" / "3 × 8" / "4*10" into sets and reps. */
export function splitSetsReps(value: string): { sets?: number; reps?: number } {
  const m = value.trim().match(/^(\d+)\s*[x×*]\s*(\d+)$/i);
  if (!m) return {};
  return { sets: Number(m[1]), reps: Number(m[2]) };
}

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Nearest known exercise within a spelling tolerance, else null. */
export function nearest(name: string, known: string[]): string | null {
  const target = name.trim().toLowerCase();
  if (!target) return null;
  let best: string | null = null;
  let bestDist = Infinity;
  for (const k of known) {
    const d = levenshtein(target, k.trim().toLowerCase());
    if (d < bestDist) {
      bestDist = d;
      best = k;
    }
  }
  const tolerance = Math.max(2, Math.floor(target.length * 0.34));
  return best && bestDist <= tolerance ? best : null;
}

function matchEquipment(raw: string): { ids: EquipmentId[]; unknown: string[] } {
  const ids: EquipmentId[] = [];
  const unknown: string[] = [];
  const tokens = raw
    .split(/[;|/]/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const token of tokens) {
    const key = token.toLowerCase().replace(/[\s_-]/g, '');
    const hit = EQUIPMENT_IDS.find((id) => id.toLowerCase() === key);
    if (hit) ids.push(hit);
    else unknown.push(token);
  }
  return { ids: [...new Set(ids)], unknown };
}

function toInt(value: string | undefined): number | null {
  if (value === undefined) return null;
  const n = Number(value.trim());
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * Build validated rows from the grid + a column mapping. `known` is the
 * author's exercise vocabulary for nearest-spelling matching (AC-CSV-05).
 * Rows with problems are still returned so they can import as draft days
 * the author finishes by hand (AC-CSV-07).
 */
export function buildRows(
  grid: string[][],
  columns: CsvColumn[],
  known: string[] = [],
): ParsedRow[] {
  const dataRows = grid.slice(1);
  const col = (field: CsvField) => columns.findIndex((c) => c.field === field);
  const iDay = col('day');
  const iName = col('name');
  const iSets = col('sets');
  const iReps = col('reps');
  const iSR = col('setsReps');
  const iEquip = col('equipment');
  const iKind = col('kind');
  const iDur = col('duration');
  return dataRows.map((cells, r): ParsedRow => {
    const get = (i: number) => (i >= 0 ? (cells[i] ?? '').trim() : '');
    const name = get(iName);

    const rawKind = get(iKind).toLowerCase();
    const kind: ExerciseKind = (KINDS as string[]).includes(rawKind)
      ? (rawKind as ExerciseKind)
      : 'strength';

    let sets = toInt(get(iSets)) ?? 0;
    let reps = toInt(get(iReps)) ?? 0;
    if ((!sets || !reps) && iSR >= 0) {
      const sr = splitSetsReps(get(iSR));
      if (sr.sets) sets = sr.sets;
      if (sr.reps) reps = sr.reps;
    }
    if (!sets) sets = 3;

    const durationMin = kind === 'strength' ? null : (toInt(get(iDur)) ?? 10);

    const day = toInt(get(iDay)) ?? 0;
    const equip = iEquip >= 0 ? matchEquipment(get(iEquip)) : { ids: [], unknown: [] };

    const validated = revalidate(
      {
        index: r + 1,
        day,
        name,
        kind,
        sets: Math.max(1, Math.min(12, sets)),
        reps: Math.max(0, Math.min(100, reps)),
        durationMin,
        equipment: equip.ids,
        suggestion: null,
        unknownEquipment: equip.unknown,
        problems: [],
      },
      known,
    );
    return { ...validated, day: Math.min(7, Math.max(1, validated.day)) };
  });
}

/** Recompute a row's problems + nearest-match suggestion after an inline edit. */
export function revalidate(row: ParsedRow, known: string[] = []): ParsedRow {
  const problems: RowProblem[] = [];
  if (!row.name.trim()) problems.push('missing-name');
  if (row.kind === 'strength' && !row.reps) problems.push('missing-reps');
  if (row.day < 1 || row.day > 7) problems.push('bad-day');
  if (row.unknownEquipment.length > 0) problems.push('unknown-equipment');
  let suggestion: string | null = null;
  const knownLower = known.map((k) => k.trim().toLowerCase());
  if (
    row.name.trim() &&
    knownLower.length > 0 &&
    !knownLower.includes(row.name.trim().toLowerCase())
  ) {
    suggestion = nearest(row.name, known);
    problems.push('unmatched-exercise');
  }
  return { ...row, suggestion, problems };
}

export function summarize(rows: ParsedRow[], columns: CsvColumn[]): ImportShape {
  const days = new Set(rows.map((r) => r.day));
  const problems = rows.filter((r) => r.problems.length > 0).length;
  return {
    rows: rows.length,
    days: days.size,
    weeks: 1,
    valid: rows.length - problems,
    problems,
    discardedWeight: columns.some((c) => c.field === 'weight'),
  };
}

/** Turn accepted rows into program items with per-day positions. */
export function rowsToItems(rows: ParsedRow[]): ProgramItemLike[] {
  const pos = new Map<number, number>();
  return rows
    .filter((r) => r.name)
    .map((r) => {
      const position = pos.get(r.day) ?? 0;
      pos.set(r.day, position + 1);
      return {
        day: Math.min(7, Math.max(1, r.day)),
        position,
        name: r.name,
        kind: r.kind,
        sets: r.sets,
        reps: r.reps,
        durationMin: r.durationMin,
        equipment: r.equipment,
      };
    });
}

export const TEMPLATE_HEADERS = [
  'Day',
  'Exercise',
  'Kind',
  'Sets',
  'Reps',
  'Duration',
  'Equipment',
] as const;

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function csvLine(cells: string[]): string {
  return cells.map(csvCell).join(',');
}

export function templateCsv(): string {
  return [
    csvLine([...TEMPLATE_HEADERS]),
    csvLine(['1', 'Back Squat', 'strength', '5', '5', '', 'barbell']),
    csvLine(['1', 'Row', 'strength', '3', '8', '', 'barbell;cable']),
    csvLine(['3', 'Easy Run', 'cardio', '', '', '25', 'body']),
  ].join('\r\n');
}

/** Export a program to CSV that re-imports to an identical program (AC-CSV-10). */
export function programToCsv(items: ProgramItemLike[]): string {
  const ordered = [...items].sort((a, b) => a.day - b.day || a.position - b.position);
  const lines = [csvLine([...TEMPLATE_HEADERS])];
  for (const it of ordered) {
    lines.push(
      csvLine([
        String(it.day),
        it.name,
        it.kind,
        it.kind === 'strength' ? String(it.sets) : '',
        it.kind === 'strength' ? String(it.reps) : '',
        it.kind === 'strength' ? '' : String(it.durationMin ?? 10),
        it.equipment.join(';'),
      ]),
    );
  }
  return lines.join('\r\n');
}
