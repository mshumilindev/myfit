/**
 * What Atlas remembers → how he builds your day. Keeps his words and his plan
 * consistent: if he said "I'll go easier on the knee", the day really is
 * lighter for the quads; if you said "no more bench", bench never shows up.
 */
import type { MuscleGroup } from '../data/exercises';
import { soreParts, type AtlasMemory, type BodyPart } from './memory';

/** Muscles a sore part mostly belongs to. */
export const PART_MUSCLES: Record<BodyPart, MuscleGroup[]> = {
  lower_back: ['lower_back'],
  knee: ['quads'],
  shoulder: ['shoulders'],
  elbow: ['biceps', 'triceps'],
  wrist: ['forearms'],
  neck: ['traps', 'neck'],
  hip: ['glutes', 'adductors'],
  ankle: ['calves'],
  hamstring: ['hamstrings'],
};

/** Weight share for a sore part's muscles (20% lighter). */
export const SORE_CAP = 0.8;

export function memoryBuildHints(
  mem: AtlasMemory | undefined,
  caps: Map<MuscleGroup, number>,
  now: number,
): { loadCaps: Map<MuscleGroup, number>; avoid: string[]; prefer: string[] } {
  const out = new Map(caps);
  for (const part of soreParts(mem, now))
    for (const m of PART_MUSCLES[part]) out.set(m, Math.min(out.get(m) ?? 1, SORE_CAP));
  return {
    loadCaps: out,
    avoid: [...(mem?.avoid ?? []), ...(mem?.prefer ?? []).map((x) => x.from)],
    prefer: (mem?.prefer ?? []).map((x) => x.to),
  };
}
