import { useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';
import { CallPreflight } from '../components/ui/CallPreflight';
import { CallVideo } from '../components/ui/CallVideo';
import { Dialog } from '../ui';
import { useCallsT } from '../i18n/calls';
import { mediaConstraints, readCallPrefs, writeCallPrefs } from './callPrefs';
import type { CallSession } from './callSession';
import { newCallId, openPreflight, type PreflightRequest } from './callsStore';
import { useAudioLevel } from './useAudioLevel';

interface Dev {
  id: string;
  label: string;
}

/**
 * "Check before the call" (SPO-446): your own picture, a live microphone level and the device pickers, shown before the
 * first call on this device. Start saves the choices and places the call; Close places nothing.
 */
export function CallPreflightDialog({
  session,
  req,
}: {
  session: CallSession;
  req: PreflightRequest;
}) {
  const { cl } = useCallsT();
  const [prefs, setPrefs] = useState(readCallPrefs);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mics, setMics] = useState<Dev[]>([]);
  const [cams, setCams] = useState<Dev[]>([]);
  const [failed, setFailed] = useState(false);
  const withVideo = req.kind === 'video' && prefs.camOn;
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

  const patch = (p: Partial<typeof prefs>) => setPrefs(writeCallPrefs(p));
  const close = () => openPreflight(null);
  const start = () => {
    writeCallPrefs({ seen: true });
    stream?.getTracks().forEach((t) => t.stop());
    openPreflight(null);
    void session.dial(req.peerId, req.kind, newCallId());
  };

  // the kit Dialog has no Escape handling of its own
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <Dialog
      title={cl.callPreTitle}
      icon="video-camera"
      onClose={close}
      actions={
        <>
          <Button variant="secondary" onClick={close}>
            {cl.callClose}
          </Button>
          <Button variant="primary" onClick={start}>
            {cl.callPreStart}
          </Button>
        </>
      }
    >
      {failed ? (
        <p role="alert">{cl.callPermDeniedB}</p>
      ) : (
        <CallPreflight
          preview={
            withVideo && stream ? <CallVideo stream={stream} self label={cl.callYou} /> : null
          }
          level={level}
          levelLabel={cl.callPreLevel}
          cameraLabel={cl.callPreCam}
          cameraOn={prefs.camOn}
          onCamera={(on) => patch({ camOn: on })}
          micLabel={cl.callPreMic}
          micDevice={prefs.mic}
          micDevices={mics.length ? mics : [{ id: '', label: cl.callPreNoDevices }]}
          onMicDevice={(id) => patch({ mic: id })}
          camLabel={cl.callPreCam}
          camDevice={prefs.cam}
          camDevices={cams.length ? cams : [{ id: '', label: cl.callPreNoDevices }]}
          onCamDevice={(id) => patch({ cam: id })}
        />
      )}
    </Dialog>
  );
}
