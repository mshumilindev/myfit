/** Planner reminders in the desktop shell (SPO-552 I8): the pure scheduler, the prefs and the tray menu. */
import { describe, expect, it } from 'vitest';
import {
  createAlarmScheduler,
  GRACE_MS,
  MAX_ALARMS,
  MAX_TIMER_MS,
  parseAlarms,
  type Alarm,
} from '../desktop/src/alarms';
import { DEFAULT_PREFS, parsePrefs, patchPrefs } from '../desktop/src/prefs';
import { parseTrayState, trayItems } from '../desktop/src/trayMenu';

function rig(start = 1_000_000) {
  let now = start;
  const timers = new Map<number, { at: number; fn: () => void }>();
  let seq = 0;
  const due: Alarm[] = [];
  const sched = createAlarmScheduler(
    {
      now: () => now,
      setTimer: (fn, ms) => {
        timers.set(++seq, { at: now + ms, fn });
        return seq;
      },
      clearTimer: (h) => void timers.delete(h as number),
    },
    (a) => due.push(a),
  );
  const advance = (ms: number) => {
    const to = now + ms;
    for (;;) {
      const next = [...timers.entries()]
        .filter(([, t]) => t.at <= to)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      timers.delete(next[0]);
      now = next[1].at;
      next[1].fn();
    }
    now = to;
  };
  return { sched, due, advance, setNow: (t: number) => (now = t), timers, now: () => now };
}

describe('parseAlarms', () => {
  it('keeps well-formed alarms only', () => {
    expect(
      parseAlarms([
        { id: 'a', at: 5.9, mode: 'ring' },
        { id: '', at: 5, mode: 'ring' },
        { id: 'b', at: NaN, mode: 'ring' },
        { id: 'c', at: 5, mode: 'loud' },
        { id: 'd', at: 5, mode: 'quiet', title: 'secret' },
        null,
        'x',
      ]),
    ).toEqual([
      { id: 'a', at: 5, mode: 'ring' },
      { id: 'd', at: 5, mode: 'quiet' },
    ]);
    expect(parseAlarms('nope')).toEqual([]);
  });
  it('caps how many it takes', () => {
    const many = Array.from({ length: MAX_ALARMS + 50 }, (_, i) => ({
      id: `i${i}`,
      at: i,
      mode: 'ring',
    }));
    expect(parseAlarms(many)).toHaveLength(MAX_ALARMS);
  });
});

describe('alarm scheduler', () => {
  it('fires each alarm once at its moment', () => {
    const r = rig();
    r.sched.schedule([{ id: 'a', at: r.now() + 5000, mode: 'ring' }]);
    r.advance(4999);
    expect(r.due).toEqual([]);
    r.advance(1);
    expect(r.due.map((a) => a.id)).toEqual(['a']);
    r.advance(60_000);
    expect(r.due).toHaveLength(1);
    expect(r.sched.pending()).toEqual([]);
  });

  it('replaces the set: what is gone is cancelled, an unchanged alarm keeps its timer', () => {
    const r = rig();
    const t = r.now();
    r.sched.schedule([
      { id: 'a', at: t + 1000, mode: 'ring' },
      { id: 'b', at: t + 2000, mode: 'quiet' },
    ]);
    const timersBefore = r.timers.size;
    r.sched.schedule([{ id: 'a', at: t + 1000, mode: 'ring' }]);
    expect(r.timers.size).toBe(timersBefore - 1);
    r.advance(3000);
    expect(r.due.map((a) => a.id)).toEqual(['a']);
  });

  it('a moved alarm fires at the new moment only', () => {
    const r = rig();
    const t = r.now();
    r.sched.schedule([{ id: 'a', at: t + 1000, mode: 'ring' }]);
    r.sched.schedule([{ id: 'a', at: t + 3000, mode: 'ring' }]);
    r.advance(2000);
    expect(r.due).toEqual([]);
    r.advance(1000);
    expect(r.due).toHaveLength(1);
  });

  it('cancel stops an alarm', () => {
    const r = rig();
    r.sched.schedule([{ id: 'a', at: r.now() + 1000, mode: 'ring' }]);
    r.sched.cancel(['a']);
    r.advance(5000);
    expect(r.due).toEqual([]);
  });

  it('rings an alarm that is just past, leaves an old one to the page', () => {
    const r = rig();
    r.sched.schedule([
      { id: 'recent', at: r.now() - 1000, mode: 'ring' },
      { id: 'old', at: r.now() - GRACE_MS - 1, mode: 'ring' },
    ]);
    expect(r.due.map((a) => a.id)).toEqual(['recent']);
    expect(r.sched.pending()).toEqual([]);
  });

  it('re-arms an alarm farther than one timer can wait', () => {
    const r = rig();
    const at = r.now() + MAX_TIMER_MS * 2 + 5000;
    r.sched.schedule([{ id: 'far', at, mode: 'ring' }]);
    r.advance(MAX_TIMER_MS * 2);
    expect(r.due).toEqual([]);
    r.advance(5000);
    expect(r.due.map((a) => a.id)).toEqual(['far']);
  });

  it('recheck after sleep fires what came due while the computer slept', () => {
    const r = rig();
    r.sched.schedule([{ id: 'a', at: r.now() + 60_000, mode: 'ring' }]);
    r.setNow(r.now() + 90_000); // woke 30 s late, timers did not run
    r.sched.recheck();
    expect(r.due.map((a) => a.id)).toEqual(['a']);
  });
});

describe('shell prefs', () => {
  it('defaults: icon on, autostart off, hint not shown', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(DEFAULT_PREFS).toEqual({
      trayIcon: true,
      openAtLogin: false,
      autostartHintShown: false,
    });
  });
  it('ignores wrong types and unknown keys', () => {
    expect(parsePrefs({ trayIcon: 'no', openAtLogin: true, extra: 1 })).toEqual({
      ...DEFAULT_PREFS,
      openAtLogin: true,
    });
    expect(patchPrefs(DEFAULT_PREFS, { openAtLogin: 1, trayIcon: false, evil: true })).toEqual({
      ...DEFAULT_PREFS,
      trayIcon: false,
    });
  });
});

describe('tray menu', () => {
  it('shows the next reminder as a disabled line above Open / Quit', () => {
    const items = trayItems(parseTrayState({ next: { label: 'Mobility · 18:30' } }), false);
    expect(items[0]).toEqual({ kind: 'text', label: 'Mobility · 18:30' });
    expect(items.filter((i) => i.kind === 'item').map((i) => (i as { id: string }).id)).toEqual([
      'open',
      'quit',
    ]);
  });
  it('has no text line without a next reminder, and adds the update item when one is ready', () => {
    const items = trayItems(parseTrayState({ next: { label: '   ' } }), true);
    expect(items.some((i) => i.kind === 'text')).toBe(false);
    expect(items.filter((i) => i.kind === 'item').map((i) => (i as { id: string }).id)).toEqual([
      'open',
      'update',
      'quit',
    ]);
  });
  it('clips a very long label', () => {
    const s = parseTrayState({ next: { label: 'x'.repeat(300) } });
    expect(s.next!.label.length).toBeLessThanOrEqual(80);
  });
});
