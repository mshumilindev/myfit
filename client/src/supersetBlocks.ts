/* Superset / circuit grouping of a session's exercises (pure). Leaf module: store.ts re-exports it. */
import type { Exercise, Workout } from './types';

export interface SupersetGroup {
  groupId: string;
  letter: string;
  exercises: Exercise[];
  /** A round-based circuit (F3) vs a plain back-to-back superset. */
  circuit: boolean;
}
export type SessionBlock =
  { kind: 'single'; exercise: Exercise } | { kind: 'group'; group: SupersetGroup };

export function sessionBlocks(w: Workout): SessionBlock[] {
  const sorted = [...w.exercises].sort((a, b) => a.position - b.position);
  const seen = new Set<string>();
  const blocks: SessionBlock[] = [];
  let letterIdx = 0;
  for (const ex of sorted) {
    const gid = ex.groupId ?? null;
    if (!gid) {
      blocks.push({ kind: 'single', exercise: ex });
      continue;
    }
    if (seen.has(gid)) continue;
    seen.add(gid);
    const members = sorted
      .filter((e) => (e.groupId ?? null) === gid)
      .sort((a, b) => (a.groupOrder ?? 0) - (b.groupOrder ?? 0));
    if (members.length < 2) {
      blocks.push({ kind: 'single', exercise: ex });
      continue;
    }
    blocks.push({
      kind: 'group',
      group: {
        groupId: gid,
        letter: String.fromCharCode(65 + letterIdx++),
        exercises: members,
        circuit: members.some((e) => e.groupKind === 'circuit'),
      },
    });
  }
  return blocks;
}

export function nextSupersetLetter(w: Workout): string {
  const used = sessionBlocks(w).filter((b) => b.kind === 'group').length;
  return String.fromCharCode(65 + used);
}
export function groupRounds(g: SupersetGroup): number {
  return Math.max(
    1,
    ...g.exercises.map((e) => Math.max(e.sets.length, Math.max(0, e.plannedSets ?? 0))),
  );
}
export function groupCurrentRound(g: SupersetGroup): number {
  const done = Math.min(...g.exercises.map((e) => e.sets.length));
  return Math.min(done + 1, groupRounds(g));
}
