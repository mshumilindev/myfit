/**
 * The legal gate for EXISTING signed-in users (SPO-295 N12). Mounted once, next to the app (main.tsx).
 * Drawer 1 (Terms + Privacy Policy, blocking) shows only when the server confirmed a required consent is missing
 * (`useLegalGate() === 'needed'`). For a trainer, manager or admin (the real role, `getRole()`) the Trainer Terms + DPA are
 * required too and ride in the SAME drawer, showing only what is missing (owner decision 22.10: the whole app is gated, no
 * separate sheet inside the coach app); a member never sees them, and a role change re-asks at once (cache key + role hook). While the state is not known (loading, offline, error) the app stays usable only if this
 * device already saw the server confirm the consents for the current document versions; otherwise `LegalGateUnverified` blocks
 * it until the server answers (SPO-295 decision, `docs/plans/SPO-295-dev-plan.md`).
 * Continue records terms / policy-ack / age-18 and / or trainer-terms, in one go (queued first, so offline is fine) and moves on WITHOUT waiting for the
 * network. Drawer 2 (optional consents, all off) is shown once per account on this device.
 * When no gate is due, `PolicyUpdateHost` tells the person about a new Terms / Privacy Policy version (N8).
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AtlasConsentPrompt } from '../atlas/AtlasConsentPrompt';
import { openGeoPrompt } from '../data/geoSearchGate';
import { currentUid, getRole, onAuthChange, onRoleChange, signOut } from '../api';
import { canUseCoach } from '../coach/access';
import { getLocale } from '../i18n';
import { currentHash } from '../route';
import { gateNeedsOf, legalGateOf, useConsentRecords } from './consentApi';
import { REQUIRED_KINDS, type ConsentKind } from './consents';
import { choiceGrants, choicesShown, hasOptionalRecord, markChoicesShown } from './gateChoices';
import { LegalGateChoices } from './LegalGateChoices';
import { LegalGateTerms } from './LegalGateTerms';
import { LegalGateUnverified } from './LegalGateUnverified';
import { clearVerified, markVerifiedClear, wasVerifiedClear } from './gateVerified';
import { PolicyUpdateHost } from './PolicyUpdateHost';
import { legalRoute } from './route';
import {
  enqueueConsents,
  flushPendingConsents,
  onConsentDropped,
  pendingConsentKinds,
  recordGateConsents,
} from './signupConsents';

type Stage = 'terms' | 'choices' | 'atlas' | 'done';

/** The public legal pages and the invite sign-up own the screen: the gate must not cover what is being read or signed. */
function ownsScreen(hash: string): boolean {
  return legalRoute(hash) !== null || /^#\/join\//i.test(hash);
}

/** The required consents are already queued on this device (just registered, not yet sent): nothing to ask. */
function requiredQueued(uid: string): boolean {
  const q = pendingConsentKinds(uid);
  return REQUIRED_KINDS.every((k) => q.includes(k));
}

/** The signed-in role, live: a promotion arrives with the next ID token (`setRole`) and the gate re-reads it. */
function useRole(): ReturnType<typeof getRole> {
  return useSyncExternalStore(onRoleChange, getRole, getRole);
}

function useHash(): string {
  const [hash, setHash] = useState(currentHash);
  useEffect(() => {
    const on = () => setHash(currentHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

function GateFor({ uid }: { uid: string }) {
  const state = useConsentRecords();
  const hash = useHash();
  // 'terms' / 'done' are both "no optional step in progress": drawer 1 is derived from the live need, so it comes back
  // when a required kind is missing again (a permanent refusal dropped it, or the role was promoted mid-session).
  const [stage, setStage] = useState<Stage>('terms');
  // Continue was pressed for this part: drawer 1 stays down while the records catch up (the snapshot lags the write).
  // Cleared when the records show the part as accepted (so a later withdrawal / promotion asks again) or when the
  // server refuses the consent for good (then the part is neither queued nor recorded and must be asked again).
  const [submitted, setSubmitted] = useState({ base: false, trainer: false });
  // The last Continue ended with a required consent neither queued nor recorded.
  const [refused, setRefused] = useState(false);
  // Gym search was switched on in drawer 2: its prompt opens once the Atlas one (if any) is answered.
  const [geoNext, setGeoNext] = useState(false);
  const role = useRole();
  const coach = canUseCoach(role);
  const gate = legalGateOf(state, wasVerifiedClear(uid, coach), role);
  // What drawer 1 still asks for: whatever the records lack and this device has not already queued.
  const lacking = gateNeedsOf(state.records, role);
  const need = {
    base: lacking.base && !requiredQueued(uid) && !submitted.base,
    trainer:
      lacking.trainer && !pendingConsentKinds(uid).includes('trainer-terms') && !submitted.trainer,
  };
  const serverAnswered = state.confirmed && !state.loading && !state.error;

  // Remember what the server said, for offline starts: clear = fail open next time, needed = no longer.
  useEffect(() => {
    if (!serverAnswered) return;
    if (gate === 'clear') markVerifiedClear(uid, coach);
    else if (gate === 'needed') clearVerified(uid);
  }, [gate, serverAnswered, uid, coach]);

  // The records caught up with a submitted part: forget the flag, so that part is asked again if it goes missing later.
  if ((submitted.base && !lacking.base) || (submitted.trainer && !lacking.trainer)) {
    setSubmitted({
      base: submitted.base && lacking.base,
      trainer: submitted.trainer && lacking.trainer,
    });
  }

  // A required consent was permanently refused and dropped (possibly long after Continue, once back online).
  useEffect(
    () =>
      onConsentDropped((droppedUid, kind) => {
        if (droppedUid !== uid) return;
        if (kind === 'trainer-terms') setSubmitted((s) => ({ ...s, trainer: false }));
        else if ((REQUIRED_KINDS as readonly ConsentKind[]).includes(kind))
          setSubmitted((s) => ({ ...s, base: false }));
        else return;
        setRefused(true);
      }),
    [uid],
  );

  // Drawer 2 counts as shown the moment it appears (it must not come back after a reload).
  useEffect(() => {
    if (stage === 'choices') markChoicesShown(uid);
  }, [stage, uid]);

  /** The prompted consents record themselves once accepted in their own prompt; declining there leaves them off. */
  const finish = (geo: boolean) => {
    if (geo) openGeoPrompt();
    setStage('done');
  };
  if (stage === 'atlas') {
    return <AtlasConsentPrompt engine="gemini" onDone={() => finish(geoNext)} />;
  }
  if (stage === 'choices') {
    const save = (on: ReadonlySet<ConsentKind>) => {
      const grants = choiceGrants(on);
      if (grants.length) {
        enqueueConsents(uid, grants);
        void flushPendingConsents();
      }
      const geo = on.has('geo-search');
      if (on.has('atlas-ai')) {
        setGeoNext(geo);
        setStage('atlas');
      } else finish(geo);
    };
    return <LegalGateChoices onSave={save} onLater={() => setStage('done')} />;
  }
  if (
    (stage === 'terms' || stage === 'done') &&
    gate === 'needed' &&
    !ownsScreen(hash) &&
    (need.base || need.trainer)
  ) {
    // Trainer part alone (an accepted member became a trainer): drawer 2 is not theirs to be asked again.
    const next = () =>
      !need.base || choicesShown(uid) || hasOptionalRecord(state.records) ? 'done' : 'choices';
    return (
      <LegalGateTerms
        parts={need}
        refused={refused}
        onContinue={() => {
          const parts = need;
          setRefused(false);
          setSubmitted((s) => ({
            base: s.base || parts.base,
            trainer: s.trainer || parts.trainer,
          }));
          setStage(next());
          void recordGateConsents(getLocale(), parts)
            .then((ok) => {
              if (ok) return;
              setSubmitted((s) => ({
                base: s.base && !parts.base,
                trainer: s.trainer && !parts.trainer,
              }));
              setRefused(true);
            })
            .catch(() => undefined); // unexpected: the queue keeps what it could
        }}
        onSignOut={() => void signOut()}
      />
    );
  }
  // Nothing to verify the consents against yet, and this device never saw them confirmed: the app waits for the server.
  if (
    (stage === 'terms' || stage === 'done') &&
    gate === 'unverified' &&
    !ownsScreen(hash) &&
    !(requiredQueued(uid) && (!coach || pendingConsentKinds(uid).includes('trainer-terms')))
  ) {
    return (
      <LegalGateUnverified
        error={state.error}
        onRetry={state.retry}
        onSignOut={() => void signOut()}
      />
    );
  }
  // No full gate is due (or it is not ours to show yet): tell the person about a new document version, if any.
  return <PolicyUpdateHost uid={uid} state={state} hidden={ownsScreen(hash)} />;
}

export function LegalGate() {
  const [uid, setUid] = useState<string | null>(currentUid);
  useEffect(() => onAuthChange((user) => setUid(user?.uid ?? null)), []);
  return uid ? <GateFor key={uid} uid={uid} /> : null;
}
