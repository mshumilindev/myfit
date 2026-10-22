/**
 * Shown instead of the app when the person's required consents cannot be verified and this device has no earlier
 * server-confirmed "clear" for the current document versions (first run offline, new document version while offline).
 * Three honest states: checking (online, waiting on the loading ladder, never given up on, says so after 4 s), offline (navigator.onLine false) and a
 * service problem (the listener errored or timed out while online) with "Try again" and a muted error code, so a missing
 * deploy is told apart from a bad network. Opaque full page (kit `FullPage`) like the gate page, so the app never shows behind it; the only way out besides connecting is "Sign out" / "Delete my account". It closes by
 * itself the moment the server answers (either the app opens or drawer 1 asks for the agreement).
 */
import { useEffect, useRef, useState } from 'react';
import { useGateT } from '../i18n/legalGate';
import { Button } from '../components/ui/Button';
import { IconTile } from '../components/ui/IconTile';
import { FullPage } from '../components/ui/FullPage';
import { GateLoading } from './GateLoading';
import { errorCode } from './consentApi';
import { useGateLeave } from './GateLeaveActions';
import './LegalGate.css';

/** After this the loading page says it is slow and shows Sign out. */
const SLOW_MS = 4000;
/** While waiting, the consent listener is re-subscribed this often (the loading page stays). */
const RESUBSCRIBE_MS = 15000;

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

  // Online and no error: keep waiting for the server, however long it takes (it is never turned into an error by a timer).
  const waiting = online && error === null;
  // Still waiting after a few seconds: say so on the loading page, and offer the way out.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!waiting) return;
    const id = window.setTimeout(() => setSlow(true), SLOW_MS);
    return () => {
      window.clearTimeout(id);
      setSlow(false);
    };
  }, [waiting]);
  // Still no answer: quietly ask again now and then, in case the first listener never connected.
  useEffect(() => {
    if (!waiting) return;
    const id = window.setInterval(onRetry, RESUBSCRIBE_MS);
    return () => window.clearInterval(id);
  }, [waiting, onRetry]);

  const retry = () => {
    setSlow(false);
    onRetry();
  };
  // Back online after being offline: ask again by itself.
  const wasOnline = useRef(online);
  useEffect(() => {
    if (online && !wasOnline.current) retry();
    wasOnline.current = online;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts to the connection change only
  }, [online]);

  const phase = !online ? 'offline' : error ? 'problem' : 'checking';
  const code = phase === 'problem' ? errorCode(error) : null;
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
  if (phase === 'checking')
    return (
      <GateLoading
        stage="check"
        detail={slow ? g.page.loadSlow : undefined}
        aside={leave.dialogs}
        extra={slow ? leave.buttons : undefined}
      />
    );
  return (
    <FullPage label={title} aside={leave.dialogs}>
      <div className="lgg">
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
            <Button variant="primary" size="md" onClick={retry}>
              {g.unverifiedRetry}
            </Button>
          )}
          {leave.buttons}
        </div>
      </div>
    </FullPage>
  );
}
