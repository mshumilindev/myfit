/**
 * Records the legal gate's required consents and WAITS until the server has them (owner decision 22.10: the page does
 * not move on, and never asks again, until the agreement is really recorded). States: saving -> done; offline -> waiting
 * (retried on `online` and every few seconds); a permanent refusal is retried twice on its own, then `failed` with a
 * button. The person's ticks are never reset.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { currentUid } from '../api';
import { getLocale } from '../i18n';
import { REQUIRED_KINDS, type ConsentKind } from './consents';
import { flushPendingConsents, pendingConsentKinds, recordGateConsents } from './signupConsents';

export type RecordState = 'idle' | 'saving' | 'waiting' | 'failed' | 'done';
const WAIT_MS = 4000;
const AUTO_RETRIES = 2;

function kindsOf(parts: { base: boolean; trainer: boolean }): ConsentKind[] {
  return [
    ...(parts.base ? REQUIRED_KINDS : []),
    ...(parts.trainer ? (['trainer-terms'] as const) : []),
  ];
}
function stillQueued(parts: { base: boolean; trainer: boolean }): boolean {
  const uid = currentUid();
  if (!uid) return false;
  const q = pendingConsentKinds(uid);
  return kindsOf(parts).some((k) => q.includes(k));
}

export function useGateRecorder(
  parts: { base: boolean; trainer: boolean },
  preview: boolean,
  onDone: () => void,
): { state: RecordState; start: () => void } {
  const [state, setState] = useState<RecordState>('idle');
  const partsRef = useRef(parts);
  const doneRef = useRef(onDone);
  useEffect(() => {
    partsRef.current = parts;
    doneRef.current = onDone;
  });
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => void (alive.current = false);
  }, []);

  const finishOrWait = useCallback(() => {
    if (!alive.current) return;
    if (stillQueued(partsRef.current)) setState('waiting');
    else {
      setState('done');
      doneRef.current();
    }
  }, []);

  const start = useCallback(() => {
    setState('saving');
    if (preview) {
      window.setTimeout(() => {
        if (!alive.current) return;
        setState('done');
        doneRef.current();
      }, 800);
      return;
    }
    void (async () => {
      let ok = false;
      for (let i = 0; i <= AUTO_RETRIES && !ok; i++) {
        ok = await recordGateConsents(getLocale(), partsRef.current).catch(() => false);
        if (!ok && i < AUTO_RETRIES) await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
        if (!alive.current) return;
      }
      if (!ok) setState('failed');
      else finishOrWait();
    })();
  }, [finishOrWait, preview]);

  // Saved on this device, not yet on the server (offline): keep trying until it is.
  useEffect(() => {
    if (state !== 'waiting') return;
    const tick = () => void flushPendingConsents().then(finishOrWait);
    const id = window.setInterval(tick, WAIT_MS);
    window.addEventListener('online', tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('online', tick);
    };
  }, [state, finishOrWait]);

  return { state, start };
}
