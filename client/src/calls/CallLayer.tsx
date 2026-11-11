import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '../components/ui/Button';
import { CallBar } from '../components/ui/CallBar';
import { CallControls } from '../components/ui/CallControls';
import { CallMini } from '../components/ui/CallMini';
import { CallScreen } from '../components/ui/CallScreen';
import { CallState as CallStateView } from '../components/ui/CallState';
import { CallSessionChip } from '../components/ui/CallSessionChip';
import { CallTile } from '../components/ui/CallTile';
import { CallVideo } from '../components/ui/CallVideo';
import { IncomingCall } from '../components/ui/IncomingCall';
import { useAddonOrBase } from '../addons/enabledSet';
import { CALL_SOUND, useLoopSound } from '../sound/useLoopSound';
import { Notice } from '../components/ui/Notice';
import { useCallsT } from '../i18n/calls';
import { elapsedSeconds, isLive, type CallEndReason, type CallState } from './callMachine';
import type { CallSession } from './callSession';
import { peerName, usePreflight } from './callsStore';
import { CallPreflightDialog } from './CallPreflightDialog';
import { useAudioLevel } from './useAudioLevel';
import { useWorkoutChip } from './workoutChip';

const DESKTOP = '(min-width: 45em)';
const BRAND = 'Spotter';

const mmss = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

function useDesktop(): boolean {
  return useSyncExternalStore(
    (f) => {
      const m = window.matchMedia(DESKTOP);
      m.addEventListener('change', f);
      return () => m.removeEventListener('change', f);
    },
    () => window.matchMedia(DESKTOP).matches,
    () => false,
  );
}

function useNow(on: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [on]);
  return now;
}

const VIDEO_FLOW = (s: CallState) => s.kind === 'video' && !s.voiceOnly;

/**
 * The calls UI (SPO-445): draws the current call from kit pieces. It owns only presentation state (minimised, full
 * screen); everything about the call itself is the `CallSession`.
 */
/** The other person's voice. Video calls play it through the remote <video>; a voice call has no picture, so without this element nothing would be heard. */
function RemoteAudio({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    if (stream) void el.play().catch(() => {});
    return () => {
      el.srcObject = null;
    };
  }, [stream]);
  return <audio ref={ref} autoPlay data-testid="call-remote-audio" />;
}

export function CallLayer({ session }: { session: CallSession }) {
  const s = useSyncExternalStore(session.subscribe, session.getState, session.getState);
  const remote = session.getRemoteStream();
  const playing = s.phase === 'active' || s.phase === 'reconnecting';
  const hasPicture =
    s.kind === 'video' && !s.voiceOnly && (remote?.getVideoTracks().length ?? 0) > 0;
  return (
    <>
      <CallLayerView session={session} />
      {playing && !hasPicture && <RemoteAudio stream={remote} />}
    </>
  );
}

function CallLayerView({ session }: { session: CallSession }) {
  const s = useSyncExternalStore(session.subscribe, session.getState, session.getState);
  const { cl } = useCallsT();
  const desktop = useDesktop();
  const [minFor, setMinFor] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const live = isLive(s);
  const now = useNow(s.phase === 'active' || s.phase === 'reconnecting');
  const remote = session.getRemoteStream();
  const local = session.getLocalStream();
  const level = useAudioLevel(remote, s.phase === 'active' && !VIDEO_FLOW(s));
  const name = peerName(s.peerId) ?? BRAND;
  const pre = usePreflight();
  const chip = useWorkoutChip();
  // With a workout open on desktop the call sits in the side dock and the session beside it stays usable (SPO-445).
  const dockOn =
    desktop && !!chip && !full && live && s.phase !== 'ringing-in' && minFor !== s.callId;
  useEffect(() => {
    if (!dockOn) return;
    const root = document.documentElement;
    root.setAttribute('data-call-dock', '');
    return () => root.removeAttribute('data-call-dock');
  }, [dockOn]);

  // an ended call that was just hung up closes itself; every other end state waits to be read
  useEffect(() => {
    if (s.phase !== 'ended' || s.endReason !== 'hangup') return;
    const id = setTimeout(() => session.dismiss(), 3000);
    return () => clearTimeout(id);
  }, [s.phase, s.endReason, session]);

  const ringingIn = s.phase === 'ringing-in';
  // The ringtone belongs to Gym and Coach (their offline media pack carries it): an account with neither never plays or fetches it.
  const gymOn = useAddonOrBase('gym');
  const coachOn = useAddonOrBase('coach');
  useLoopSound(gymOn || coachOn ? CALL_SOUND : null, ringingIn);
  useEffect(() => {
    if (!ringingIn) return;
    // a keyboard or screen-reader user lands on the primary action of the alert dialog
    const btns = document.querySelectorAll<HTMLElement>('[role="alertdialog"] button');
    [...btns]
      .find((b) => (b.getAttribute('aria-label') ?? b.textContent)?.trim() === cl.callAnswer)
      ?.focus();
  }, [ringingIn, cl.callAnswer]);

  if (s.phase === 'idle') {
    return pre ? <CallPreflightDialog session={session} req={pre} /> : null;
  }

  const time = mmss(elapsedSeconds(s, now));
  const kindLabel = s.kind === 'video' ? cl.callIncomingVideo : cl.callIncomingVoice;

  if (s.phase === 'ringing-in') {
    return (
      <IncomingCall
        name={name}
        kind={kindLabel}
        video={s.kind === 'video'}
        variant={desktop ? 'card' : 'screen'}
        answerLabel={cl.callAnswer}
        declineLabel={cl.callDecline}
        voiceOnlyLabel={s.kind === 'video' ? cl.callAnswerVoiceOnly : undefined}
        onAnswer={() => void session.answer()}
        onDecline={() => session.decline()}
        onVoiceOnly={
          s.kind === 'video' ? () => void session.answer({ voiceOnly: true }) : undefined
        }
      />
    );
  }

  if (s.phase === 'ended') {
    const view = endView(cl, s, time);
    return (
      <CallScreen
        name={name}
        status=""
        foot={<EndFoot cl={cl} onClose={() => session.dismiss()} reason={s.endReason} />}
      >
        <CallStateView name={name} icon={view.icon} title={view.title} body={view.body} />
      </CallScreen>
    );
  }

  const minimised = minFor === s.callId && live;
  const controls = {
    mic: cl.callMute,
    micOn: cl.callUnmute,
    cam: cl.callCamOff,
    camOn: cl.callCamOn,
    flip: cl.callFlip,
    speaker: cl.callSpeaker,
    end: cl.callEnd,
    minimize: cl.callMinimize,
  };
  const withVideo = s.kind === 'video' && !s.voiceOnly;
  const remoteVideo =
    withVideo && s.phase === 'active' && (remote?.getVideoTracks().length ?? 0) > 0 ? (
      <CallVideo stream={remote} label={name} />
    ) : undefined;
  const selfVideo =
    withVideo && s.camOn && local ? (
      <CallVideo stream={local} self label={cl.callYou} />
    ) : undefined;

  if (minimised) {
    return desktop || s.phase !== 'active' ? (
      <CallMini
        name={name}
        video={remoteVideo}
        time={time}
        expandLabel={cl.callBackToCall}
        endLabel={cl.callEnd}
        onExpand={() => setMinFor(null)}
        onEnd={() => session.hangup()}
      />
    ) : (
      <CallBar
        title={cl.callWith(name)}
        time={time}
        returnLabel={cl.callBackToCall}
        micOn={s.micOn}
        micLabel={s.micOn ? cl.callMute : cl.callUnmute}
        onMic={() => session.toggleMic()}
        endLabel={cl.callEnd}
        onEnd={() => session.hangup()}
        onReturn={() => setMinFor(null)}
      />
    );
  }

  const status =
    s.phase === 'ringing-out'
      ? cl.callCalling
      : s.phase === 'connecting'
        ? cl.callConnecting
        : s.phase === 'reconnecting'
          ? cl.callReconnecting
          : time;
  const notice =
    s.phase === 'reconnecting' ? (
      <Notice tone="neutral" icon="arrows-clockwise">
        {cl.callReconnecting}
      </Notice>
    ) : s.voiceOnly && s.phase === 'active' ? (
      <Notice tone="danger" icon="wifi-slash">
        {cl.callWeakVoiceOnly}
      </Notice>
    ) : undefined;

  return (
    <CallScreen
      name={name}
      status={status}
      note={cl.callNotRecorded}
      notice={notice}
      mode={desktop && full ? 'full' : dockOn ? 'dock' : 'auto'}
      session={
        chip && (
          <CallSessionChip
            title={chip.title}
            detail={chip.detail}
            time={chip.time}
            openLabel={cl.callBackToWorkout}
            onOpen={() => {
              if (!dockOn) setMinFor(s.callId);
              chip.open();
            }}
          />
        )
      }
      onToggleFull={desktop ? () => setFull((f) => !f) : undefined}
      fullLabel={full ? cl.callExitFullScreen : cl.callFullScreen}
      onMinimize={s.phase === 'reconnecting' ? undefined : () => setMinFor(s.callId)}
      minimizeLabel={cl.callMinimize}
      foot={
        <CallControls
          labels={controls}
          micOn={s.micOn}
          onMic={() => session.toggleMic()}
          camOn={withVideo ? s.camOn : undefined}
          onCam={withVideo ? () => session.toggleCam() : undefined}
          onEnd={() => session.hangup()}
        />
      }
    >
      <CallTile
        name={name}
        ringing={s.phase === 'ringing-out'}
        video={remoteVideo}
        wave={!remoteVideo && s.phase !== 'ringing-out'}
        waveLevel={level}
        micOff={false}
      />
      {withVideo && s.phase !== 'ringing-out' && (
        <CallTile name={cl.callYou} self video={selfVideo} micOff={!s.micOn} />
      )}
    </CallScreen>
  );
}

function EndFoot({
  cl,
  onClose,
  reason,
}: {
  cl: ReturnType<typeof useCallsT>['cl'];
  onClose: () => void;
  reason: CallEndReason | null;
}) {
  return (
    <>
      {reason === 'permission-denied' && <p>{cl.callPermHowTo}</p>}
      <Button variant="secondary" onClick={onClose}>
        {cl.callClose}
      </Button>
    </>
  );
}

function endView(
  cl: ReturnType<typeof useCallsT>['cl'],
  s: CallState,
  time: string,
): { icon: string; title: string; body: string } {
  const len =
    s.connectedAt && s.endedAt ? mmss(Math.floor((s.endedAt - s.connectedAt) / 1000)) : time;
  switch (s.endReason) {
    case 'declined':
      return { icon: 'phone-x', title: cl.callDeclinedT, body: cl.callDeclinedB };
    case 'missed':
      return { icon: 'phone-x', title: cl.callNoAnswerT, body: cl.callNoAnswerB };
    case 'busy':
      return { icon: 'phone-x', title: cl.callBusyT, body: cl.callBusyB };
    case 'unavailable':
      return { icon: 'phone-x', title: cl.callUnavailT, body: cl.callUnavailB };
    case 'offline':
      return { icon: 'wifi-slash', title: cl.callOfflineT, body: cl.callOfflineB };
    case 'permission-denied':
      return { icon: 'microphone-slash', title: cl.callPermDeniedT, body: cl.callPermDeniedB };
    case 'no-device':
      return { icon: 'microphone-slash', title: cl.callNoDeviceT, body: cl.callNoDeviceB };
    case 'disabled':
      return { icon: 'phone-x', title: cl.callsDisabled, body: '' };
    case 'hangup':
      return { icon: 'phone-disconnect', title: cl.callEndedT(len), body: cl.callEndedB };
    default:
      return { icon: 'wifi-slash', title: cl.callLostT, body: cl.callLostB };
  }
}
