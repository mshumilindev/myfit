import { useCallback, useEffect, useRef, useState } from 'react';
import {
  acknowledge,
  isVerified,
  observe,
  trustStore,
  unverify,
  verify,
  type TrustRecord,
  type TrustStore,
} from './trustStore';
import { getTrustPort, type TrustPort } from './trustPort';

export interface SecurityState {
  /** The trainer's current code (six groups of four digits) or null while it is not known. */
  code: string | null;
  /** The person confirmed THIS code. */
  verified: boolean;
  /** The code changed since it was last shown and nobody has looked at it yet. */
  changed: boolean;
  loading: boolean;
  verify(): void;
  unverify(): void;
  /** "Review code" was opened / the banner was acknowledged. */
  acknowledge(): void;
}

/**
 * The security code of a trainer's key for one conversation, with the device's own memory of it. `onChange` fires once
 * per change noticed in this session (the chat toast). Pass `trainerUid = null` to switch it off.
 */
export function useSecurity(
  trainerUid: string | null,
  cid: string | null,
  opts: {
    port?: TrustPort;
    store?: TrustStore;
    onChange?: (code: string) => void;
  } = {},
): SecurityState {
  const port = opts.port ?? getTrustPort();
  const store = opts.store ?? trustStore();
  const key = trainerUid && cid ? `${trainerUid}|${cid}` : null;
  /* State is tagged with the conversation it belongs to, so switching conversation never needs a reset in an effect. */
  const [recState, setRecState] = useState<{ key: string | null; rec: TrustRecord | null }>({
    key: null,
    rec: null,
  });
  const rec = recState.key === key ? recState.rec : null;
  const [code, setCode] = useState<string | null>(() =>
    trainerUid ? (port.peek(trainerUid)?.code ?? null) : null,
  );
  const [settled, setSettled] = useState<string | null>(null);
  const loading = key !== null && settled !== key;
  const recRef = useRef<TrustRecord | null>(null);
  const onChange = useRef(opts.onChange);
  useEffect(() => {
    onChange.current = opts.onChange;
  });

  const write = useCallback(
    (next: TrustRecord) => {
      recRef.current = next;
      setRecState({ key, rec: next });
      if (cid) void store.save(cid, next).catch(() => undefined);
    },
    [cid, store, key],
  );

  useEffect(() => {
    if (!trainerUid || !cid) return;
    let live = true;
    recRef.current = null;
    let stored: Promise<TrustRecord | null> = store.load(cid).catch(() => null);
    const off = port.subscribe(
      trainerUid,
      (k) => {
        if (!live) return;
        setCode(k.code);
        if (!k.code) return setSettled(key);
        const c = k.code;
        void stored.then((s) => {
          if (!live) return;
          const base = recRef.current ?? s;
          const { rec: next, changed } = observe(base, c);
          stored = Promise.resolve(next);
          if (next !== base) write(next);
          else {
            recRef.current = next;
            setRecState({ key, rec: next });
          }
          if (changed) onChange.current?.(c);
          setSettled(key);
        });
      },
      () => live && setSettled(key),
    );
    return () => {
      live = false;
      off();
    };
  }, [trainerUid, cid, port, store, write, key]);

  const mutate = (f: (r: TrustRecord) => TrustRecord) => {
    const cur = recRef.current ?? rec;
    if (cur) write(f(cur));
  };
  return {
    code,
    verified: isVerified(rec),
    changed: !!rec?.pending,
    loading,
    verify: () => mutate(verify),
    unverify: () => mutate(unverify),
    acknowledge: () => mutate(acknowledge),
  };
}
