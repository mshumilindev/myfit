import { useEffect, useRef } from 'react';
import { nativeBridge, nextUp, planAlarms, planOfAlarm, type NativeAlarm } from './desktopBridge';
import { fill, STRINGS } from './strings';
import type { PlanDoc } from './types';
import { localParts } from './zoned';
import type { LocaleId } from '../i18n';

/**
 * The desktop shell's reminder engine (SPO-552 I8): hands the shell the moments to wake for, keeps the tray line current and, when
 * the shell wakes the page, shows the notification and asks the layer to look at the clock again. Does nothing outside the shell.
 */
export function useDesktopEngine(
  plans: readonly PlanDoc[],
  now: number,
  handled: ReadonlySet<string>,
  snoozed: Readonly<Record<string, number>>,
  locale: LocaleId,
  wake: () => void,
): void {
  const plansRef = useRef(plans);
  const localeRef = useRef(locale);
  const wakeRef = useRef(wake);
  // The due-handler below lives as long as the layer, so it reads the latest values through refs.
  useEffect(() => {
    plansRef.current = plans;
    localeRef.current = locale;
    wakeRef.current = wake;
  });

  useEffect(() => {
    const n = nativeBridge();
    if (!n?.scheduleAlarms) return;
    void n.scheduleAlarms(planAlarms(plans, now, handled, snoozed)).catch(() => undefined);
  }, [plans, now, handled, snoozed]);

  useEffect(() => {
    const n = nativeBridge();
    if (!n?.setTray) return;
    const label = nextUp(plans, now, handled);
    void n.setTray({ next: label ? { label } : null }).catch(() => undefined);
  }, [plans, now, handled]);

  useEffect(() => {
    const n = nativeBridge();
    if (!n?.onAlarmDue) return;
    const off = n.onAlarmDue((a: NativeAlarm) => {
      wakeRef.current();
      const plan = planOfAlarm(plansRef.current, a.id);
      // A ring on a visible, focused window already has its own screen; everything else gets the system notification.
      const watching =
        a.mode === 'ring' && document.visibilityState === 'visible' && document.hasFocus();
      if (!plan || watching || !n.showAlarm) return;
      const s = STRINGS[localeRef.current];
      const start =
        Number(a.id.split('#')[0].slice(plan.id.length + 1)) + plan.timing.lead * 60_000;
      void n
        .showAlarm({
          id: a.id,
          title: plan.title,
          body: fill(s.alertSub, { t: localParts(start, plan.timing.tz).time }),
          mode: a.mode,
        })
        .catch(() => undefined);
    });
    return () => {
      off();
      // The Planner is gone (removed, signed out): leave nothing ticking and no stale line in the tray.
      void n.scheduleAlarms?.([]).catch(() => undefined);
      void n.setTray?.({ next: null }).catch(() => undefined);
    };
  }, []);
}
