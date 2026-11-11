/**
 * Planner data, sealed. A plan is written through the vault (`prepareWrite('plannerEvents', …)`), so the database holds only the
 * moment of the next reminder, its mode and a stamp in the open; the title, note, icon, repeat rule and lead time are inside one
 * envelope. Pure of Firestore: `sync.ts` moves the sealed documents.
 */
import type { Vault } from '../autoVault';
import { prepareWrite, readDocs, vault } from '../vaultIO';
import { upcomingFires } from './recurrence';
import type { PlanDoc, PlannerPrefs } from './types';
import { dropHourEra } from './availability';

/** The plan as it will be stored: `nextFireAt`, `fireAts` and `updatedAt` are refreshed, then it is sealed. */
export async function sealPlan(
  plan: PlanDoc,
  now: number,
  v: Vault = vault,
): Promise<Record<string, unknown>> {
  const fireAts = plan.enabled ? upcomingFires(plan.timing, now) : [];
  return prepareWrite(
    'plannerEvents',
    { ...plan, nextFireAt: fireAts[0] ?? null, fireAts, updatedAt: now },
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
  const got = items[0] ?? null;
  return got ? { ...got, availability: dropHourEra(got.availability ?? {}) } : null;
}

export const DEFAULT_PREFS: PlannerPrefs = {
  updatedAt: 0,
  // Nothing is assumed: no hours set means no data, and nothing is suggested or shared until the person sets some.
  availability: {},
  shareAvailability: false,
  defaults: { lead: 60, mode: 'quiet', durationMin: 60 },
};
