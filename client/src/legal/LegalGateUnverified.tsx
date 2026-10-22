/**
 * Shown instead of the app when the person's required consents cannot be verified and this device has no earlier
 * server-confirmed "clear" for the current document versions (first run offline, new document version while offline).
 * Three honest states: checking (online, waiting, spinner, gives up after 8 s), offline (navigator.onLine false) and a
 * service problem (the listener errored or timed out while online) with "Try again" and a muted error code, so a missing
 * deploy is told apart from a bad network. Blocking `Sheet` like drawer 1; the only way out besides connecting is "Sign out" / "Delete my account". It closes by
 * itself the moment the server answers (either the app opens or drawer 1 asks for the agreement).
 */
import { useEffect, useRef, useState } from 'react';
import { useGateT } from '../i18n/legalGate';
import { Button } from '../components/ui/Button';
import { IconTile } from '../components/ui/IconTile';
import { Sheet } from '../components/ui/Overlays';
import { errorCode } from './consentApi';
import { useGateLeave } from './GateLeaveActions';
import './LegalGate.css';

/** How long the sheet waits for the server while online before it calls it a service problem. */
export const CHECK_TIMEOUT_MS = 8000;

function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function LegalGateUnverified({
  error,
  onRetry,
  onSignOut,
}: {
  /** The consent records listener's error, if it failed. */
  error: Error | null;
  /** Subscribes to the consent records again. */
  onRetry: () => void;
  onSignOut: () => void;
}) {
  const g = useGateT();
  const leave = useGateLeave(onSignOut);
  const online = useOnline();
  const [timedOut, setTimedOut] = useState(false);

  // Online and still waiting: give the server CHECK_TIMEOUT_MS, then say so. Restarts on every retry / reconnect.
  const waiting = online && error === null && !timedOut;
  useEffect(() => {
    if (!waiting) return;
    const id = window.setTimeout(() => setTimedOut(true), CHECK_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [waiting]);

  const retry = () => {
    setTimedOut(false);
    onRetry();
  };
  // Back online after being offline: ask again by itself.
  const wasOnline = useRef(online);
  useEffect(() => {
    if (online && !wasOnline.current) retry();
    wasOnline.current = online;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts to the connection change only
  }, [online]);

  const phase = !online ? 'offline' : error || timedOut ? 'problem' : 'checking';
  const code = phase === 'problem' ? (errorCode(error) ?? (error ? null : 'timeout')) : null;
  const title = {
    offline: g.unverifiedTitle,
    checking: g.unverifiedCheckingTitle,
    problem: g.unverifiedErrorTitle,
  }[phase];
  const lead = {
    offline: g.unverifiedOffline,
    checking: g.unverifiedChecking,
    problem: g.unverifiedError,
  }[phase];
  return (
    <>
      <Sheet onClose={() => undefined} dismissible={false} padded role="alertdialog" label={title}>
        <div className="lgg" aria-busy={phase === 'checking' || undefined}>
          <div className="lgg-head">
            <IconTile
              tone="accent"
              size={44}
              icon={
                phase === 'offline'
                  ? 'cloud-slash'
                  : phase === 'problem'
                    ? 'warning-circle'
                    : 'shield-check'
              }
            />
            <h2 className="lgg-t ut-xl ut-w7">{title}</h2>
          </div>
          <p className="lgg-lead ut-base ut-muted" role="status">
            {lead}
          </p>
          {code && <p className="lgg-lead ut-sm ut-muted">{g.unverifiedCode(code)}</p>}
          <div className="lgg-acts">
            {phase !== 'offline' && (
              <Button variant="primary" size="md" loading={phase === 'checking'} onClick={retry}>
                {g.unverifiedRetry}
              </Button>
            )}
            {leave.buttons}
          </div>
        </div>
      </Sheet>
      {leave.dialogs}
    </>
  );
}
