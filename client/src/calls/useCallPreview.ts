import { useEffect, useState } from 'react';
import { mediaConstraints, type CallPrefs } from './callPrefs';
import { useAudioLevel } from './useAudioLevel';

export interface CallDevice {
  id: string;
  label: string;
}

/**
 * Your own picture, the microphone level and the device lists for the pre-call check and the call settings (SPO-446).
 * Opens the microphone (and the camera when `withVideo`) while mounted and releases it on unmount or when a choice changes.
 */
export function useCallPreview(prefs: CallPrefs, withVideo: boolean) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mics, setMics] = useState<CallDevice[]>([]);
  const [cams, setCams] = useState<CallDevice[]>([]);
  const [failed, setFailed] = useState(false);
  const level = useAudioLevel(stream);

  useEffect(() => {
    let live = true;
    let got: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia(mediaConstraints(withVideo ? 'video' : 'voice', prefs))
      .then(async (s) => {
        if (!live) return s.getTracks().forEach((t) => t.stop());
        got = s;
        setStream(s);
        const all = await navigator.mediaDevices.enumerateDevices();
        const pick = (k: MediaDeviceKind) =>
          all
            .filter((d) => d.kind === k)
            .map((d, i) => ({ id: d.deviceId, label: d.label || `${i + 1}` }));
        if (live) {
          setMics(pick('audioinput'));
          setCams(pick('videoinput'));
        }
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
      got?.getTracks().forEach((t) => t.stop());
      setStream(null);
    };
  }, [prefs, withVideo]);

  return { stream, mics, cams, failed, level };
}
