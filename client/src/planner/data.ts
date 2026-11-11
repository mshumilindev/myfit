/**
 * Planner data, sealed. A plan is written through the vault (`prepareWrite('plannerEvents', …)`), so the database holds only the
 * moment of the next reminder, its mode and a stamp in the open; the title, note, icon, repeat rule and lead time are inside one
 * envelope. Pure of Firestore: `sync.ts` moves the sealed documents.
 */
import type { Vault } from '../autoVault';
import { prepareWrite, readDocs, vault } from '../vaultIO';
import { nextFire } from './recurrence';
import type { PlanDoc, PlannerPrefs } from './types';

/** The plan as it will be stored: `nextFireAt` and `updatedAt` are refreshed, then it is sealed. */
export async function sealPlan(
  plan: PlanDoc,
  now: number,
  v: Vault = vault,
): Promise<Record<string, unknown>> {
  const next = plan.enabled ? nextFire(plan.timing, now) : null;
  return prepareWrite(
    'plannerEvents',
    { ...plan, nextFireAt: next?.fireAt ?? null, updatedAt: now },
    v,
  );
}

export async function openPlans(
  raws: Record<string, unknown>[],
  v: Vault = vault,
): Promise<{ plans: PlanDoc[]; locked: number }> {
  const { items, locked } = await readDocs<PlanDoc>(raws, v);
  return { plans: items, locked };
}

export async function sealPrefs(prefs: PlannerPrefs, now: number, v: Vault = vault) {
  return prepareWrite('planner', { ...prefs, updatedAt: now }, v);
}

export async function openPrefs(
  raw: Record<string, unknown>,
  v: Vault = vault,
): Promise<PlannerPrefs | null> {
  const { items } = await readDocs<PlannerPrefs>([raw], v);
  return items[0] ?? null;
}

export const DEFAULT_PREFS: PlannerPrefs = {
  updatedAt: 0,
  availability: { 0: [[18, 21]], 1: [[18, 21]], 2: [[18, 21]], 3: [[18, 21]], 4: [[18, 21]] },
  shareAvailability: false,
  defaults: { lead: 60, mode: 'quiet', durationMin: 60 },
};
