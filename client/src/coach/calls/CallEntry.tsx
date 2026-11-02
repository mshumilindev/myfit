import { createContext, useContext, type ReactNode } from 'react';
import { CallActions } from '../../components/ui/CallActions';
import { CallLogRow } from '../../components/ui/CallLogRow';

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

export function CallEntry({
  size = 'md',
  compact,
  labeled,
}: {
  size?: 'sm' | 'md';
  compact?: boolean;
  labeled?: boolean;
}) {
  const v = useContext(Ctx);
  if (!v) return null;
  return <CallActions {...v} size={size} compact={compact} labeled={labeled} />;
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
