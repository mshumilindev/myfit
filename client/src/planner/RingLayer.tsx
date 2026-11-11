import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ReminderAlert } from '../components/ui/ReminderAlert';
import { COACH_BREAKPOINT, useMinWidth } from '../components/ui/breakpoints';
import type { Tone } from '../components/ui/tones';
import { useT } from '../i18n';
import { dueRings, nextWake } from './alertsCore';
import { useSharedAlerts, writeAlert } from './alertsSync';
import { fill, STRINGS } from './strings';
import { usePlans } from './sync';
import { localParts } from './zoned';
import './RingLayer.css';

const KEY = 'planner.ring.v1';
interface Store {
  handled: string[];
  snoozed: Record<string, number>;
}
const load = (): Store => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '') as Store;
    return { handled: v.handled ?? [], snoozed: v.snoozed ?? {} };
  } catch {
    return { handled: [], snoozed: {} };
  }
};
const save = (st: Store, now: number) => {
  // Keep it tiny: only what can still matter (a moment older than a day never rings again).
  const cut = now - 86_400_000;
  const keep = (k: string) => Number(k.slice(k.lastIndexOf(':') + 1)) > cut;
  const next: Store = {
    handled: st.handled.filter(keep),
    snoozed: Object.fromEntries(Object.entries(st.snoozed).filter(([k]) => keep(k))),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode: the ring still works for this run */
  }
  return next;
};

/**
 * Persistent reminders on this device: while the app is open, a ring-mode plan whose moment has come takes the screen (phone) or
 * floats as a card (desktop) until it is snoozed or dismissed. A closed app gets the one visible push from the server instead.
 */
export function RingLayer() {
  const { locale } = useT();
  const s = STRINGS[locale];
  const plans = usePlans();
  const wide = useMinWidth(COACH_BREAKPOINT);
  const [st, setSt] = useState<Store>(load);
  const [now, setNow] = useState(() => Date.now());
  // What the owner's other devices already did (dismissed / snoozed there) counts here too.
  const shared = useSharedAlerts();
  const handled = useMemo(
    () => new Set([...st.handled, ...shared.handled]),
    [st.handled, shared.handled],
  );
  const snoozed = useMemo(() => {
    const out = { ...st.snoozed };
    for (const [k, t] of Object.entries(shared.snoozed)) out[k] = Math.max(out[k] ?? 0, t);
    return out;
  }, [st.snoozed, shared.snoozed]);

  // Wake exactly when something changes (a moment, a window end, a snooze end); never a polling tick.
  useEffect(() => {
    const at = nextWake(plans, now, snoozed);
    if (at === null) return;
    const id = window.setTimeout(() => setNow(Date.now()), Math.min(at - now, 2 ** 31 - 1) + 50);
    const wake = () => setNow(Date.now());
    document.addEventListener('visibilitychange', wake);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [plans, now, snoozed]);

  const ring = useMemo(
    () => dueRings(plans, now, handled, snoozed)[0],
    [plans, now, handled, snoozed],
  );
  const ringKeyNow = ring?.key;
  useEffect(() => {
    if (!ringKeyNow) return;
    try {
      navigator.vibrate?.([400, 200, 400, 200, 400]);
    } catch {
      /* no vibration here */
    }
  }, [ringKeyNow]);

  if (!ring) return null;
  const { plan } = ring;
  const time = plan.timing.time;
  const lead = plan.timing.lead;
  const startAt = ring.at + lead * 60_000;
  const day = localParts(startAt, plan.timing.tz).day;
  const today = localParts(now, plan.timing.tz).day;
  const set = (patch: Partial<Store>) => setSt((cur) => save({ ...cur, ...patch }, Date.now()));
  const dismiss = () => {
    set({ handled: [...st.handled, ring.key] });
    void writeAlert(ring.key, plan.id, ring.at, { state: 'dismissed' });
  };
  const snooze = (m: number) => {
    const until = Date.now() + m * 60_000;
    set({ snoozed: { ...st.snoozed, [ring.key]: until } });
    void writeAlert(ring.key, plan.id, ring.at, { state: 'snoozed', snoozeUntil: until });
  };
  return createPortal(
    <div className={`plr${wide ? ' plr--card' : ''}`}>
      <ReminderAlert
        variant={wide ? 'card' : 'screen'}
        state="ringing"
        title={plan.title}
        icon={plan.icon}
        tone={plan.color as Tone}
        kind={s.alertKind}
        sub={day === today ? fill(s.alertSub, { t: time }) : `${day} ${time}`}
        labels={{
          snooze: s.snooze,
          dismiss: s.dismiss,
          close: s.dismiss,
          minutes: (n) => `${n} ${s.min}`,
        }}
        onSnooze={snooze}
        onDismiss={dismiss}
      />
    </div>,
    document.body,
  );
}
