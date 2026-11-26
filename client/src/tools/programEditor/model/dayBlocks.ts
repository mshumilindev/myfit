import type { ProgramBlockDoc, ProgramDoc } from './doc';

/** `p` without the blocks of `day` (the key goes when none are left, so a program without blocks stays without it). */
export function dropDayBlocks<P extends ProgramDoc>(p: P, day: number): P {
  const { blocks, ...rest } = p;
  const kept = (blocks ?? []).filter((b) => b.day !== day);
  return (kept.length ? { ...rest, blocks: kept } : rest) as P;
}

/** The blocks of `from` as new blocks of `to` (new ids; a block keeps following the copy of its row). */
export function copyBlocks(
  src: ProgramDoc,
  from: number,
  to: number,
  idMap: Map<string, string>,
  newId: () => string,
): ProgramBlockDoc[] {
  return (src.blocks ?? [])
    .filter((b) => b.day === from)
    .map((b) => ({
      ...b,
      id: newId(),
      day: to,
      ...(b.afterItemId ? { afterItemId: idMap.get(b.afterItemId) ?? null } : {}),
    }));
}

/** `{ blocks }` of `base` plus `extra`, or nothing when there are none (an empty list is not stored). */
export function withBlocks(base: ProgramDoc, extra: ProgramBlockDoc[]): Pick<ProgramDoc, 'blocks'> {
  const all = [...(base.blocks ?? []), ...extra];
  return all.length ? { blocks: all } : {};
}

/** A day's blocks, in order. */
export function dayBlocks(p: ProgramDoc, day: number): ProgramBlockDoc[] {
  return (p.blocks ?? []).filter((b) => b.day === day).sort((a, b) => a.position - b.position);
}

/** Change a block's numbers and members. */
export function updateBlock<P extends ProgramDoc>(
  p: P,
  id: string,
  patch: Partial<Pick<ProgramBlockDoc, 'spec' | 'members'>>,
): P {
  return { ...p, blocks: (p.blocks ?? []).map((b) => (b.id === id ? { ...b, ...patch } : b)) };
}

export function removeBlock<P extends ProgramDoc>(p: P, id: string): P {
  const { blocks, ...rest } = p;
  const kept = (blocks ?? []).filter((b) => b.id !== id);
  return (kept.length ? { ...rest, blocks: kept } : rest) as P;
}
