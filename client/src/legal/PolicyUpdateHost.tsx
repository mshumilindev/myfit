/**
 * Tells an existing user about a new version of the Terms / Privacy Policy (SPO-295 N8). Mounted by the legal gate when no
 * full gate is due. Editorial change: a dismissible banner. Material change: a blocking confirm sheet. Either way the
 * acknowledgement / consent is recorded for the new version (queued first, so offline is fine; never waits for the network).
 * Shows nothing while the records are loading, errored or unconfirmed by the server (a cache miss must not nag or lock out),
 * on the public legal pages and the invite sign-up, and for a document whose grant is already queued on this device.
 */
import { useState } from 'react';
import { signOut } from '../api';
import { getLocale } from '../i18n';
import type { ConsentRecordsState } from './consentApi';
import { DEFAULT_LEGAL_CTX, type LegalCtx } from './consents';
import { PolicyUpdateBanner } from './PolicyUpdateBanner';
import { PolicyUpdateSheet } from './PolicyUpdateSheet';
import { pendingUpdates, type PendingUpdate } from './policyUpdate';
import {
  buildUpdateGrant,
  enqueueConsents,
  flushPendingConsents,
  pendingConsentKinds,
} from './signupConsents';

export function PolicyUpdateHost({
  uid,
  state,
  hidden,
  ctx = DEFAULT_LEGAL_CTX,
}: {
  uid: string;
  state: ConsentRecordsState;
  /** The screen belongs to something else (a public legal page, the invite sign-up). */
  hidden: boolean;
  ctx?: LegalCtx;
}) {
  // Kinds answered in this visit: the banner / sheet closes at once, before the server echoes the new record back.
  const [answered, setAnswered] = useState<readonly string[]>([]);
  if (hidden || state.loading || state.error || !state.confirmed) return null;
  const queued = pendingConsentKinds(uid, ctx.versions);
  const todo = pendingUpdates(state.records, ctx).filter(
    (x) => !answered.includes(x.kind) && !queued.includes(x.kind),
  );
  if (todo.length === 0) return null;

  const record = async (list: readonly PendingUpdate[]) => {
    setAnswered((a) => [...a, ...list.map((x) => x.kind)]);
    const grants = await Promise.all(
      list.map((x) => buildUpdateGrant(x.kind, x.version, getLocale())),
    );
    enqueueConsents(uid, grants);
    await flushPendingConsents();
  };

  const material = todo.filter((x) => x.level === 'material');
  if (material.length > 0) {
    return (
      <PolicyUpdateSheet
        updates={material}
        onContinue={() => void record(material)}
        onSignOut={() => void signOut()}
      />
    );
  }
  return (
    <PolicyUpdateBanner
      updates={todo}
      onSeen={(docs) => void record(todo.filter((x) => docs.includes(x.doc)))}
    />
  );
}
