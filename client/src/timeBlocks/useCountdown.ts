import { useCallback, useEffect, useRef, useState } from 'react';
import { COUNTDOWN_FROM, countdownCue, countdownLeft, type CuePrefs } from './cues';
import { playCue } from './blockAudio';

const GO_HOLD_MS = 800;

export interface CountdownState {
  /** Seconds left (COUNTDOWN_FROM..1); 0 on the GO beat. */
  n: number;
  go: boolean;
  /** Jump straight to GO (tap on the stage). */
  skip: () => void;
}

/**
 * Drives the pre-block countdown: deadline based (survives a throttled tab), one cue per whole second, `onStart`
 * exactly once when GO is reached (the block clock starts there), `onClose` after the GO beat has been shown.
 * The caller unmounts the overlay on `onClose`, or on cancel.
 */
export function useCountdown(opts: {
  prefs: CuePrefs;
  onStart: () => void;
  onClose: () => void;
  from?: number;
  now?: () => number;
}): CountdownState {
  const { prefs, onStart, onClose, from = COUNTDOWN_FROM, now = Date.now } = opts;
  const startRef = useRef<number | null>(null);
  const [n, setN] = useState(from);
  const startedRef = useRef(false);
  const lastRef = useRef<number>(from + 1);
  const holdRef = useRef<number | null>(null);
  const cb = useRef({ prefs, onStart, onClose });
  useEffect(() => {
    cb.current = { prefs, onStart, onClose };
  });

  const reach = useCallback((left: number) => {
    if (left === lastRef.current) return;
    lastRef.current = left;
    setN(left);
    const go = left === 0;
    playCue(countdownCue(left, go), cb.current.prefs);
    if (go && !startedRef.current) {
      startedRef.current = true;
      cb.current.onStart();
      holdRef.current = window.setTimeout(() => cb.current.onClose(), GO_HOLD_MS);
    }
  }, []);

  useEffect(() => {
    startRef.current = now();
    reach(from);
    const id = window.setInterval(() => {
      if (startRef.current == null) return;
      reach(countdownLeft(startRef.current, now(), from));
    }, 100);
    return () => {
      window.clearInterval(id);
      if (holdRef.current != null) window.clearTimeout(holdRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- started once per mount
  }, []);

  const skip = useCallback(() => {
    startRef.current = now() - from * 1000;
    reach(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, reach]);

  return { n, go: n === 0, skip };
}
