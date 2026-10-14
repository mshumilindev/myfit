/**
 * The per-row trainer layer of a plan (targets by item id). Pure and dependency-light on purpose: the sealed plan codec
 * (also bundled for the member's app and node-side tests) imports it, so it must not pull in the exercise catalogue.
 */
import type { Program } from '../../views/programs/model';

export type Targets = Record<
  string,
  { weight?: number; rpe?: number; restSec?: number; note?: string; bare?: boolean }
>;

/** The per-row trainer layer, keyed by item id. Everything a plain program item cannot carry on a client's own program. */
export function targetsOf(p: Program): Targets {
  const out: Targets = {};
  for (const i of p.items) {
    const t = {
      ...(i.targetWeight ? { weight: i.targetWeight } : {}),
      ...(i.targetRpe ? { rpe: i.targetRpe } : {}),
      ...(i.restSec ? { restSec: i.restSec } : {}),
      ...(i.note?.trim() ? { note: i.note.trim() } : {}),
      ...(i.bare ? { bare: true } : {}),
    };
    if (Object.keys(t).length) out[i.id] = t;
  }
  return out;
}
