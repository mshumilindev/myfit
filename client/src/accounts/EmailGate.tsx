/**
 * The email gate (SPO-423): while the server says a confirmed email is required and this account has none, one full page
 * asks for it and checks the letter. Mounted next to the app (main.tsx); it waits while the legal gate page is up
 * (`useLegalGateUp`): the agreement comes first and two full pages never stack. The app stays open until the server has answered (offline is a
 * normal state, the gate appears at the first connection). `?emailgatepreview=1` shows the page, writing nothing.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { currentUid, onAuthChange, signOut } from '../api';
import { ownsScreen } from '../legal/LegalGate';
import { useLegalGateUp } from '../legal/gateUp';
import { currentHash } from '../route';
import { useEmailT } from '../i18n/emailAuth';
import {
  attachEmail,
  emailErrorKind,
  emailStatus,
  refreshEmailState,
  sendConfirmation,
  type EmailErrorKind,
  type EmailState,
} from './emailApi';
import { cooldownLeft, emailGateView } from './emailGate';
import { EmailGatePage } from './EmailGatePage';

/** Focus / visibility / online events re-read the status at most this often (the switch is off for most people). */
const RELOAD_MIN_MS = 30_000;

/** While "check your inbox" is on screen the status is re-read this often (and on every return to the tab). */
const POLL_MS = 8000;

function previewRequested(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('emailgatepreview') === '1';
  } catch {
    return false;
  }
}

function useHash(): string {
  const [hash, setHash] = useState(currentHash);
  useEffect(() => {
    const on = () => setHash(currentHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

function GateFor() {
  const t = useEmailT();
  const hash = useHash();
  const preview = previewRequested();
  const legalUp = useLegalGateUp();
  const [state, setState] = useState<EmailState | null>(null);
  const [override, setOverride] = useState<'add' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<EmailErrorKind | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  // A newer write (attach, check) wins over a slower read that started before it.
  const seq = useRef(0);
  const lastLoad = useRef(0);
  const load = useCallback(
    async (force = false) => {
      if (preview) return;
      const at = Date.now();
      if (!force && at - lastLoad.current < RELOAD_MIN_MS) return;
      lastLoad.current = at;
      const mine = ++seq.current;
      try {
        const s = await emailStatus();
        if (alive.current && mine === seq.current) setState(s);
      } catch {
        /* offline or a server hiccup: the app stays open, the next try (focus, interval, online) asks again */
      }
    },
    [preview],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the server state once at mount
    void load(true);
    const again = () => {
      if (!document.hidden) void load();
    };
    window.addEventListener('online', again);
    window.addEventListener('focus', again);
    document.addEventListener('visibilitychange', again);
    return () => {
      window.removeEventListener('online', again);
      window.removeEventListener('focus', again);
      document.removeEventListener('visibilitychange', again);
    };
  }, [load]);

  const view = preview ? 'add' : emailGateView(state);
  const shown = override === 'add' && view === 'sent' ? 'add' : view;
  const waiting = view === 'sent' && override === null;
  useEffect(() => {
    if (!waiting) return;
    const id = window.setInterval(() => {
      // A forgotten background tab does not keep asking the server.
      if (document.hidden) return;
      setNow(Date.now());
      void load(true);
    }, POLL_MS);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(id);
      window.clearInterval(tick);
    };
  }, [waiting, load]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await fn();
    } catch (e) {
      if (alive.current) setError(emailErrorKind(e));
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  if (shown === 'clear' || legalUp || ownsScreen(hash)) return null;
  const onSend = (email: string, password: string) =>
    void run(async () => {
      if (preview) return;
      const next = await attachEmail(email.trim(), password);
      seq.current++;
      setState({ ...next, required: true });
      setOverride(null);
      // The cooldown starts with the attempt, so a refused send cannot be hammered either.
      setSentAt(Date.now());
      setNow(Date.now());
      await sendConfirmation();
      setNote(t.resendSent);
    });
  const onResend = () =>
    void run(async () => {
      await sendConfirmation();
      setSentAt(Date.now());
      setNow(Date.now());
      setNote(t.resendSent);
    });
  const onCheck = () =>
    void run(async () => {
      const s = await refreshEmailState();
      seq.current++;
      setState(s);
      if (!(s.verified && s.email)) setNote(t.stillPending);
    });
  return (
    <EmailGatePage
      view={shown}
      email={state?.email ?? null}
      busy={busy}
      error={error}
      note={note}
      cooldown={cooldownLeft(sentAt, now)}
      onSend={onSend}
      onResend={onResend}
      onCheck={onCheck}
      onChangeAddress={() => {
        setOverride('add');
        setError(null);
        setNote(null);
      }}
      onSignOut={() => void signOut()}
    />
  );
}

export function EmailGate() {
  const [uid, setUid] = useState<string | null>(currentUid);
  useEffect(() => onAuthChange((user) => setUid(user?.uid ?? null)), []);
  return uid ? <GateFor key={uid} /> : null;
}
