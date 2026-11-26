/**
 * Time blocks on a program day (Advanced training › Time blocks, SPO-608). A block is a timed set of exercises (AMRAP, EMOM,
 * For time, intervals) that sits beside a day's rows. It is NOT a program item: strength maths, volume and the rows' set counts
 * never see it, and a consumer that does not know `blocks` simply ignores it. Stored like the rows: catalog names and numbers.
 * The same every cycle week (as planned activities). Core file: no import of the add-on folder (types only, structurally).
 */
export interface ProgramBlockSpec {
  fmt: 'amrap' | 'emom' | 'fortime' | 'intervals';
  capSec?: number;
  everySec?: number;
  rounds?: number;
  workSec?: number;
  restSec?: number;
  scheme?: number[];
  targetRounds?: number;
}
export interface ProgramBlockMember {
  name: string;
  reps?: string;
}
export interface ProgramBlock {
  id: string;
  /** Weekday 1..7 (Mon = 1), as the rows. */
  day: number;
  /** Order among the day's blocks. */
  position: number;
  /** The row the block follows (null = before the first row). A missing row = the end of the day. Survives row moves and deletes, unlike an index. */
  afterItemId?: string | null;
  spec: ProgramBlockSpec;
  members: ProgramBlockMember[];
}

export const MAX_BLOCKS_PER_DAY = 4;
export const MAX_BLOCK_MEMBERS = 8;
const FORMATS = ['amrap', 'emom', 'fortime', 'intervals'] as const;
const MAX_SEC = 3 * 3600;

const sec = (n: unknown, min = 0): number | undefined =>
  typeof n === 'number' && Number.isFinite(n) && n >= min
    ? Math.min(MAX_SEC, Math.round(n))
    : undefined;
const count = (n: unknown): number | undefined =>
  typeof n === 'number' && Number.isFinite(n) && n >= 1 ? Math.min(99, Math.round(n)) : undefined;

function sanitizeSpec(raw: unknown): ProgramBlockSpec | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const fmt = FORMATS.find((f) => f === r.fmt);
  if (!fmt) return null;
  const out: ProgramBlockSpec = { fmt };
  const cap = sec(r.capSec, 5);
  const every = sec(r.everySec, 5);
  const rounds = count(r.rounds);
  const work = sec(r.workSec, 1);
  const rest = sec(r.restSec, 0);
  const target = count(r.targetRounds);
  const scheme = Array.isArray(r.scheme)
    ? r.scheme
        .map((n) => count(n))
        .filter((n): n is number => n !== undefined)
        .slice(0, 12)
    : [];
  if (fmt === 'amrap') {
    if (!cap) return null;
    out.capSec = cap;
    if (target) out.targetRounds = target;
  } else if (fmt === 'emom') {
    if (!rounds) return null;
    out.rounds = rounds;
    out.everySec = every ?? 60;
  } else if (fmt === 'intervals') {
    if (!work || !rounds) return null;
    out.workSec = work;
    out.restSec = rest ?? 0;
    out.rounds = rounds;
  } else {
    if (cap) out.capSec = cap;
    if (scheme.length) out.scheme = scheme;
  }
  return out;
}

/** Coerce stored (or absent / malformed) program blocks to a clean list: valid specs, 1..N members, a cap per day. */
export function sanitizeProgramBlocks(raw: unknown): ProgramBlock[] {
  if (!Array.isArray(raw)) return [];
  const perDay = new Map<number, number>();
  const out: ProgramBlock[] = [];
  for (const it of raw) {
    if (!it || typeof it !== 'object') continue;
    const r = it as Record<string, unknown>;
    const day = Number(r.day);
    const spec = sanitizeSpec(r.spec);
    if (!Number.isInteger(day) || day < 1 || day > 7 || !spec || !Array.isArray(r.members))
      continue;
    const members: ProgramBlockMember[] = [];
    for (const m of r.members) {
      const mm = m as { name?: unknown; reps?: unknown } | null;
      const name = typeof mm?.name === 'string' ? mm.name.trim().slice(0, 120) : '';
      if (!name) continue;
      const reps = typeof mm?.reps === 'string' ? mm.reps.trim().slice(0, 20) : '';
      members.push({ name, ...(reps ? { reps } : {}) });
      if (members.length >= MAX_BLOCK_MEMBERS) break;
    }
    const used = perDay.get(day) ?? 0;
    if (!members.length || used >= MAX_BLOCKS_PER_DAY) continue;
    perDay.set(day, used + 1);
    out.push({
      id: typeof r.id === 'string' && r.id ? r.id : crypto.randomUUID(),
      day,
      position: used,
      ...(typeof r.afterItemId === 'string' && r.afterItemId ? { afterItemId: r.afterItemId } : {}),
      spec,
      members,
    });
  }
  return out;
}

/** A day's blocks, in order. */
export function dayBlocks(p: { blocks?: ProgramBlock[] }, day: number): ProgramBlock[] {
  return (p.blocks ?? []).filter((b) => b.day === day).sort((a, b) => a.position - b.position);
}
