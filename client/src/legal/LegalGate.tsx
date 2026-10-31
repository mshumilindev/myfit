/**
 * The legal gate for EXISTING signed-in users (SPO-295 N12). Mounted once, next to the app (main.tsx).
 * ONE full page (`LegalGatePage`, owner decision 22.10) shows when the server confirmed a required consent is missing
 * (`useLegalGate() === 'needed'`): step 1 the Terms + Privacy Policy + 18+ (and, for a trainer, manager or admin, the
 * Trainer Terms + DPA, showing only what is missing; a role change re-asks at once), step 2 the optional consents (all off,
 * once per account on this device). Continue waits until the server has the agreement. While the state is not known
 * (loading, offline, error) the app stays usable only if this device already saw the server confirm the consents for the
 * current document versions; otherwise `LegalGateUnverified` (a loading page) blocks it until the server answers.
 * When no gate is due, `PolicyUpdateHost` tells the person about a new Terms / Privacy Policy version (N8).
 * `?gatepreview=1` shows the page without writing anything.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  currentUid,
  getRole,
  isSigningIn,
  onAuthChange,
  onRoleChange,
  onSigningInChange,
  signOut,
} from '../api';
import { canUseCoach } from '../coach/access';
import { currentHash } from '../route';
import { gateNeedsOf, legalGateOf, useConsentRecords } from './consentApi';
import { REQUIRED_KINDS } from './consents';
import { choicesShown, hasOptionalRecord, markChoicesShown } from './gateChoices';
import { GateLoading } from './GateLoading';
import { setLegalGateUp } from './gateUp';
import { LegalGatePage } from './LegalGatePage';
import { LegalGateUnverified } from './LegalGateUnverified';
import { clearVerified, markVerifiedClear, wasVerifiedClear } from './gateVerified';
import { PolicyUpdateHost } from './PolicyUpdateHost';
import { legalRoute } from './route';
import { pendingConsentKinds } from './signupConsents';

/** The public legal pages and the invite sign-up own the screen: the gate must not cover what is being read or signed. */
export function ownsScreen(hash: string): boolean {
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

/** `?gatepreview=1`: shows the page as it looks, writing nothing (the owner's way to see the steps again). */
function previewRequested(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('gatepreview') === '1';
  } catch {
    return false;
  }
}

/** The loading page after the agreement never stays longer than this, whatever the records say. */
const OPENING_MAX_MS = 4000;

interface Flow {
  parts: { base: boolean; trainer: boolean };
  withChoices: boolean;
  preview: boolean;
}

function GateFor({ uid }: { uid: string }) {
  const state = useConsentRecords();
  const hash = useHash();
  // The one-page gate is on screen from the moment something is missing until the person is through every step.
  const [flow, setFlow] = useState<Flow | null>(null);
  // The page was finished: a loading page until the records show the agreement (and at most a few seconds).
  const [opening, setOpening] = useState(false);
  // Finished for this part: the page stays down while the records catch up (the snapshot lags the write).
  // Cleared when the records show the part as accepted (so a later withdrawal / promotion asks again).
  const [submitted, setSubmitted] = useState({ base: false, trainer: false });
  const role = useRole();
  const coach = canUseCoach(role);
  const gate = legalGateOf(state, wasVerifiedClear(uid, coach), role);
  // What the page still asks for: whatever the records lack and this device has not already queued.
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

  if (!flow && previewRequested()) {
    setFlow({ parts: { base: true, trainer: coach }, withChoices: true, preview: true });
  } else if (!flow && gate === 'needed' && !ownsScreen(hash) && (need.base || need.trainer)) {
    // The optional step follows the terms once per account on this device, and not for a trainer part alone.
    const withChoices = need.base && !choicesShown(uid) && !hasOptionalRecord(state.records);
    setFlow({ parts: { base: need.base, trainer: need.trainer }, withChoices, preview: false });
  }

  const waitingForRecords =
    (submitted.base && lacking.base) || (submitted.trainer && lacking.trainer);
  useEffect(() => {
    if (!opening || !waitingForRecords) return;
    const id = window.setTimeout(() => setOpening(false), OPENING_MAX_MS);
    return () => window.clearTimeout(id);
  }, [opening, waitingForRecords]);

  const unverifiedUp =
    gate === 'unverified' &&
    !ownsScreen(hash) &&
    !(requiredQueued(uid) && (!coach || pendingConsentKinds(uid).includes('trainer-terms')));
  const pageUp = !!flow || (opening && waitingForRecords) || unverifiedUp;
  useEffect(() => {
    setLegalGateUp(pageUp);
    return () => setLegalGateUp(false);
  }, [pageUp]);

  if (flow) {
    return (
      <LegalGatePage
        parts={flow.parts}
        withChoices={flow.withChoices}
        preview={flow.preview}
        onFinished={() => {
          if (flow.preview) {
            const u = new URL(window.location.href);
            u.searchParams.delete('gatepreview');
            window.history.replaceState(null, '', u.toString());
          } else {
            markChoicesShown(uid);
            setOpening(true);
            setSubmitted((s) => ({
              base: s.base || flow.parts.base,
              trainer: s.trainer || flow.parts.trainer,
            }));
          }
          setFlow(null);
        }}
        onSignOut={() => void signOut()}
      />
    );
  }
  if (opening && waitingForRecords && !flow) return <GateLoading stage="open" withRecord />;
  // Nothing to verify the consents against yet, and this device never saw them confirmed: a loading page, never the app.
  // A device that already saw the server confirm the current versions skips this (stale-while-revalidate): no loader.
  if (unverifiedUp) {
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
  const signingIn = useSyncExternalStore(onSigningInChange, isSigningIn, isSigningIn);
  if (!uid && signingIn) return <GateLoading stage="signin" />;
  return uid ? <GateFor key={uid} uid={uid} /> : null;
}
