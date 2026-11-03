import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { CallActions } from '../../components/ui/CallActions';
import { CallLogRow } from '../../components/ui/CallLogRow';
import { useCallsT } from '../../i18n/calls';
import {
  newCallId,
  openPreflight,
  rememberPeer,
  useCallsPublished,
  useCallState,
} from '../../calls/callsStore';
import { readCallPrefs } from '../../calls/callPrefs';
import { isLive } from '../../calls/callMachine';

/**
 * SPO-433 design slot: where a screen can start a call. Without a provider (production today) it draws nothing, so the
 * embedding is visible only in the design stories. The real build replaces the value with the calls store + i18n.
 */
export interface CallEntryValue {
  voiceLabel: string;
  videoLabel: string;
  /** Neutral reason the buttons are off ("Offline", "No access"); never reveals a schedule. */
  disabledReason?: string;
  callLabel: string;
  onVoice: () => void;
  onVideo: () => void;
  /** Design stories: draw sample call-history rows at the end of the thread. */
  showLog?: boolean;
}

const Ctx = createContext<CallEntryValue | null>(null);

export function CallEntryProvider({
  value,
  children,
}: {
  value: CallEntryValue;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export interface CallEntryProps {
  size?: 'sm' | 'md';
  compact?: boolean;
  labeled?: boolean;
  /** The other person's account id (a client for a trainer, the trainer for a client) and their name. */
  peerId?: string;
  peerName?: string;
}

/**
 * Voice and video call buttons for one person (SPO-445). Draws nothing unless calls are on (signed in, not a manager, the
 * server switch is on). Design stories can still supply a fixed value through `CallEntryProvider`.
 */
export function CallEntry(p: CallEntryProps) {
  const design = useContext(Ctx);
  if (design)
    return <CallActions {...design} size={p.size} compact={p.compact} labeled={p.labeled} />;
  if (!p.peerId) return null;
  return <LiveCallEntry {...p} peerId={p.peerId} />;
}

function LiveCallEntry({
  size = 'md',
  compact,
  labeled,
  peerId,
  peerName,
}: CallEntryProps & { peerId: string }) {
  const { cl } = useCallsT();
  const { session, enabled } = useCallsPublished();
  const state = useCallState();
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  useEffect(() => {
    if (peerName) rememberPeer(peerId, peerName);
  }, [peerId, peerName]);
  if (!enabled || !session) return null;
  const name = peerName ?? '';
  const busy = isLive(state);
  // the first call on a device starts with the check of microphone and camera (kit CallPreflight)
  const dial = (kind: 'voice' | 'video') =>
    readCallPrefs().seen
      ? void session.dial(peerId, kind, newCallId())
      : openPreflight({ peerId, kind });
  return (
    <CallActions
      voiceLabel={cl.callVoice}
      videoLabel={cl.callVideo}
      callLabel={name ? cl.callTo(name) : cl.callCall}
      disabledReason={!online ? cl.callReasonOffline : busy ? cl.callBusyT : undefined}
      onVoice={() => dial('voice')}
      onVideo={() => dial('video')}
      size={size}
      compact={compact}
      labeled={labeled}
    />
  );
}

/** SPO-433 design slot: the call history rows inside a chat thread (the real build maps sealed system messages). */
export function CallLogRows() {
  const v = useContext(Ctx);
  if (!v?.showLog) return null;
  return (
    <>
      <CallLogRow kind="done" video text="Video call · 12 min" time="08:50" />
      <CallLogRow
        kind="missed"
        video={false}
        text="Missed call"
        time="09:12"
        callBackLabel="Call back"
        onCallBack={v.onVoice}
      />
    </>
  );
}
