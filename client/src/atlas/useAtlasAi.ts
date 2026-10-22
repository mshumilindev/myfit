/**
 * Atlas AI consent, live (SPO-286): the state the sending code checks, and the two writes. The state comes from the
 * consent records (`useConsentRecords`) plus what this device just did (`aiConsent.ts`), never from `coach.chatConsent`.
 */
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { currentUid } from '../api';
import { grantConsent, useConsentRecords } from '../legal/consentApi';
import { currentVersion, type ConsentRecord } from '../legal/consents';
import { ATLAS_AI_CATEGORIES, ATLAS_AI_ENGINES, ATLAS_PUTER_ENGINES } from '../legal/gateChoices';
import { clearLocalOff, markLocalOff } from '../legal/localOff';
import { prepareDirectGrant, sendConsentDurably } from '../legal/signupConsents';
import {
  AI_KIND,
  effectiveAiState,
  getAiOverride,
  grantFor,
  bindAiOverrideUid,
  setAiOverride,
  settleAiOverride,
  subscribeAiOverride,
  type AiEngine,
  type AiGrant,
  type AiState,
} from './aiConsent';

export interface AtlasAi {
  state: AiState;
  records: ConsentRecord[];
  /** The records have not answered yet (nothing is sent meanwhile). */
  loading: boolean;
  grant: (engine: AiEngine) => AiGrant | null;
}

export function useAtlasAi(): AtlasAi {
  const { records, loading, confirmed } = useConsentRecords();
  const uid = currentUid();
  // In the same render, not in an effect: account B must never see account A's override, not even for one render.
  bindAiOverrideUid(uid);
  const ov = useSyncExternalStore(subscribeAiOverride, getAiOverride);
  useEffect(() => {
    settleAiOverride(records, confirmed);
  }, [records, confirmed]);
  return useMemo(() => {
    const state = effectiveAiState(records, ov);
    // `grant` reads the override fresh, so a tap that just turned it on or off counts before the next render.
    const grant = (engine: AiEngine) =>
      grantFor(effectiveAiState(records, getAiOverride()), engine);
    return { state, records, loading, grant };
  }, [records, ov, loading]);
}

const covered = (engine: AiEngine) => ({
  categories: [...ATLAS_AI_CATEGORIES],
  engines: [...(engine === 'gemini' ? ATLAS_AI_ENGINES : ATLAS_PUTER_ENGINES)],
});

/** Record the consent for exactly what is sent. True once it is saved; this device then sends at once. */
export async function grantAtlas(engine: AiEngine): Promise<boolean> {
  try {
    const commit = await prepareDirectGrant(AI_KIND[engine]);
    await grantConsent({ kind: AI_KIND[engine], ...covered(engine) });
    commit(); // only now may an unsent withdrawal of this kind be dropped
  } catch {
    return false;
  }
  clearLocalOff(currentUid(), AI_KIND[engine]);
  setAiOverride(engine, true);
  return true;
}

/**
 * Withdraw. Sending stops FIRST, on this device, whatever the network does (the stop is kept across a reload until the
 * record is confirmed); the records follow through the persisted consent queue, so an offline withdrawal is sent later,
 * not lost. Turning the AI chat off also withdraws Puter (it only runs while the chat is on), so one tap leaves nothing
 * sending. False when a record is not on the server yet (this device still sends nothing).
 */
export async function withdrawAtlas(engine: AiEngine): Promise<boolean> {
  setAiOverride(engine, false);
  // Puter's withdrawal is queued whatever the passed records show: the server treats a withdrawal with nothing to
  // withdraw as success, while a stale cache that hid a granted Puter consent would leave it recorded as on.
  const engines: AiEngine[] = engine === 'gemini' ? ['gemini', 'puter'] : [engine];
  for (const e of engines) markLocalOff(currentUid(), AI_KIND[e]);
  let ok = true;
  for (const e of engines) {
    const kind = AI_KIND[e];
    ok =
      (await sendConsentDurably({
        kind,
        action: 'withdraw',
        version: currentVersion(kind),
        ...covered(e),
      })) && ok;
  }
  return ok;
}
