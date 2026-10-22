/** The two writes of a health consent (SPO-290). Typed and UI-free, like `atlas/useAtlasAi.ts` grant/withdraw. */
import { settleHealthLocally, withdrawHealthLocally } from '../data/healthConsentGate';
import { currentUid } from '../api';
import { forgetShareLevel, type ForgettableShare } from '../store';
import { grantConsent } from './consentApi';
import { currentVersion, type HealthFeature } from './consents';
import { HEALTH_FEATURE_INFO } from './healthFeatures';
import { clearLocalOff, markLocalOff } from './localOff';
import { prepareDirectGrant, sendConsentDurably } from './signupConsents';

/** Records the grant for exactly the categories of the feature. True once saved. */
export async function grantHealth(f: HealthFeature): Promise<boolean> {
  const info = HEALTH_FEATURE_INFO[f];
  try {
    const commit = await prepareDirectGrant(info.kind);
    await grantConsent({ kind: info.kind, categories: [...info.categories] });
    commit(); // only now may an unsent withdrawal of this kind be dropped
  } catch {
    return false;
  }
  clearLocalOff(currentUid(), info.kind);
  settleHealthLocally(f);
  return true;
}

/**
 * The trainer-sharing category that carries a feature's data (`coach/domain/types` Category). Injuries and the food log
 * are shared as their own categories: the trainer reads their sealed documents server-side while the level is not
 * `off`. The other features reach the trainer only through the `meta/coachShare` view, which the store republishes
 * without them the moment their switch goes off (`store.ts`, `publishCoachShare`).
 */
const TRAINER_CATEGORY: Partial<Record<HealthFeature, 'injury' | 'nutrition'>> = {
  injuries: 'injury',
  nutrition: 'nutrition',
};

/**
 * Switches the trainer's access to the feature's data off through the existing sharing code (`setLevel`, the same call
 * as Trainer sharing: a downgrade also deletes the derived share and the trainer's evidence on the server). True when
 * there is nothing to switch or the level was set; false when it could not be (offline, or no trainer link): the person
 * can still do it in Trainer sharing, and the withdraw copy says so.
 */
async function stopTrainerShare(f: HealthFeature): Promise<boolean> {
  const category = TRAINER_CATEGORY[f];
  if (!category) return true;
  try {
    const { getClientPort } = await import('../coach/client/data/config');
    await getClientPort().setLevel(category, 'off');
    return true;
  } catch {
    return false;
  }
}

/**
 * The on-device sharing level a feature owns (`meta/coachShare`): zeroed on withdrawal, so a stored Full can never come
 * back with a later grant. Injuries and nutrition have none: their trainer grant is `TRAINER_CATEGORY` above.
 */
const SHARE_OF: Partial<Record<HealthFeature, ForgettableShare>> = {
  chronic: 'conditions',
  nicotine: 'nicotine',
  alcohol: 'alcohol',
  supplements: 'supplements',
};

/**
 * Withdraws. The feature stops FIRST, on this device, whatever the network does (the stop is kept across a reload until
 * the record is confirmed); the record follows through the persisted consent queue, so an offline withdrawal is sent
 * later, not lost. False when the record is not on the server yet (the feature stays off on this device meanwhile).
 * The trainer's access to the feature is switched off alongside (not awaited: it must not slow the withdrawal).
 */
export async function withdrawHealth(f: HealthFeature): Promise<boolean> {
  const { kind, categories } = HEALTH_FEATURE_INFO[f];
  markLocalOff(currentUid(), kind);
  withdrawHealthLocally(f);
  const share = SHARE_OF[f];
  if (share) forgetShareLevel(share); // on this device, before any network: fail to the private side
  void stopTrainerShare(f);
  return sendConsentDurably({
    kind,
    action: 'withdraw',
    version: currentVersion(kind),
    categories: [...categories],
  });
}
