/**
 * This device's call choices (SPO-446): which microphone and camera, whether the camera starts on, and whether the
 * pre-call check was done. Device-local, no personal content, so it is plain localStorage (registered in
 * localKeys.registry). Every access is guarded: storage can be unavailable.
 */
export interface CallPrefs {
  /** The pre-call check has been done on this device. */
  seen: boolean;
  mic: string;
  cam: string;
  camOn: boolean;
  /** "Direct connection": allow a peer-to-peer path that shows each side's address to the other. Default off = relay. */
  direct: boolean;
}

export const CALL_PREFS_KEY = 'gym.callPrefs';
export const DEFAULT_CALL_PREFS: CallPrefs = {
  seen: false,
  mic: '',
  cam: '',
  camOn: true,
  direct: false,
};

export function readCallPrefs(): CallPrefs {
  try {
    const raw = localStorage.getItem(CALL_PREFS_KEY);
    if (!raw) return DEFAULT_CALL_PREFS;
    const o = JSON.parse(raw) as Partial<CallPrefs>;
    return {
      seen: o.seen === true,
      mic: typeof o.mic === 'string' ? o.mic : '',
      cam: typeof o.cam === 'string' ? o.cam : '',
      camOn: o.camOn !== false,
      direct: o.direct === true,
    };
  } catch {
    return DEFAULT_CALL_PREFS;
  }
}

export function writeCallPrefs(patch: Partial<CallPrefs>): CallPrefs {
  const next = { ...readCallPrefs(), ...patch };
  try {
    localStorage.setItem(CALL_PREFS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: the choice lasts for this page only */
  }
  return next;
}

/** getUserMedia constraints for a call from the saved choices. */
export function mediaConstraints(kind: 'voice' | 'video', p: CallPrefs): MediaStreamConstraints {
  return {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      ...(p.mic ? { deviceId: { exact: p.mic } } : {}),
    },
    video:
      kind === 'video'
        ? { facingMode: 'user', ...(p.cam ? { deviceId: { exact: p.cam } } : {}) }
        : false,
  };
}
