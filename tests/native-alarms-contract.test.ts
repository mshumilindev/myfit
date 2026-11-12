/**
 * SPO-568: one contract for the Planner alarm port. The same behaviour tests run against every implementation behind
 * `window.spotterNative`: the Electron shell's scheduler (desktop/src/alarms.ts), the Android shell and the iOS shell
 * (mobile/shell/alarm-shim.js with each platform's native peer, simulated here by the same scheduler rules). The shell never
 * receives a plan's text in `schedule`/`cancel`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createAlarmScheduler, GRACE_MS, parseAlarms, type Alarm } from '../desktop/src/alarms';

interface Harness {
  native: {
    scheduleAlarms(list: Alarm[]): Promise<void>;
    cancelAlarms(ids: string[]): Promise<void>;
    onAlarmDue(cb: (a: Alarm) => void): () => void;
  };
  /** Everything the native side was sent. */
  sent: () => string[];
  advance(ms: number): void;
}

function clockRig(start = 1_000_000) {
  let now = start;
  const timers = new Map<number, { at: number; fn: () => void }>();
  let seq = 0;
  return {
    clock: {
      now: () => now,
      setTimer: (fn: () => void, ms: number) => {
        timers.set(++seq, { at: now + ms, fn });
        return seq;
      },
      clearTimer: (h: unknown) => void timers.delete(h as number),
    },
    advance(ms: number) {
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
    },
    now: () => now,
  };
}

const shimSource = readFileSync(join(__dirname, '../mobile/shell/alarm-shim.js'), 'utf8');

/** Electron: the preload forwards to the main process scheduler (the IPC hop adds nothing but structured cloning). */
function electron(): Harness {
  const rig = clockRig();
  const subs = new Set<(a: Alarm) => void>();
  const sched = createAlarmScheduler(rig.clock, (a) => subs.forEach((cb) => cb(a)));
  const sent: string[] = [];
  return {
    native: {
      scheduleAlarms: async (l) => {
        sent.push(JSON.stringify(l));
        sched.schedule(parseAlarms(l));
      },
      cancelAlarms: async (ids) => {
        sent.push(JSON.stringify(ids));
        sched.cancel(ids);
      },
      onAlarmDue: (cb) => {
        subs.add(cb);
        return () => subs.delete(cb);
      },
    },
    sent: () => sent,
    advance: rig.advance,
  };
}

/** Android / iOS: the shim posts JSON to a port; the native peer parses it with the same rules and answers with `due`. */
function viaShim(platform: 'android' | 'ios'): Harness {
  const rig = clockRig();
  const sent: string[] = [];
  const win: Record<string, unknown> = {};
  const port: { postMessage(m: string): void; onmessage?: (e: { data: string }) => void } = {
    postMessage(m) {
      sent.push(m);
      const msg = JSON.parse(m) as { t: string; list?: unknown; ids?: string[] };
      if (msg.t === 'schedule') sched.schedule(parseAlarms(msg.list));
      if (msg.t === 'cancel') sched.cancel(msg.ids ?? []);
    },
  };
  const sched = createAlarmScheduler(rig.clock, (a) => {
    const payload = JSON.stringify({ t: 'due', alarm: a });
    // Android answers on the web message port; iOS calls a global through evaluateJavaScript.
    if (platform === 'android') port.onmessage?.({ data: payload });
    else (win.__spotterAlarmDue as (s: string) => void)(payload);
  });
  const make = (0, eval)(shimSource) as (p: unknown, w: unknown) => Harness['native'];
  return { native: make(port, win), sent: () => sent, advance: rig.advance };
}

const IMPLS: [string, () => Harness][] = [
  ['Electron shell', electron],
  ['Android shell (shim + native peer)', () => viaShim('android')],
  ['iOS shell (shim + native peer)', () => viaShim('ios')],
];

describe.each(IMPLS)('alarm port contract: %s', (_name, make) => {
  const NOW = 1_000_000;
  it('tells the page when a scheduled moment is due, once', async () => {
    const h = make();
    const due: Alarm[] = [];
    h.native.onAlarmDue((a) => due.push(a));
    await h.native.scheduleAlarms([{ id: 'a', at: NOW + 60_000, mode: 'ring' }]);
    h.advance(59_000);
    expect(due).toEqual([]);
    h.advance(2_000);
    expect(due).toEqual([{ id: 'a', at: NOW + 60_000, mode: 'ring' }]);
    h.advance(120_000);
    expect(due).toHaveLength(1);
  });
  it('a cancelled moment never fires (dismissed on another device)', async () => {
    const h = make();
    const due: Alarm[] = [];
    h.native.onAlarmDue((a) => due.push(a));
    await h.native.scheduleAlarms([{ id: 'a', at: NOW + 60_000, mode: 'quiet' }]);
    await h.native.cancelAlarms(['a']);
    h.advance(120_000);
    expect(due).toEqual([]);
  });
  it('scheduling again replaces the list: moments no longer in it are dropped', async () => {
    const h = make();
    const due: Alarm[] = [];
    h.native.onAlarmDue((a) => due.push(a));
    await h.native.scheduleAlarms([
      { id: 'a', at: NOW + 60_000, mode: 'quiet' },
      { id: 'b', at: NOW + 90_000, mode: 'quiet' },
    ]);
    await h.native.scheduleAlarms([{ id: 'b', at: NOW + 90_000, mode: 'quiet' }]);
    h.advance(200_000);
    expect(due.map((a) => a.id)).toEqual(['b']);
  });
  it('a moment missed by less than the grace still rings; older is left to the page', async () => {
    const h = make();
    const due: Alarm[] = [];
    h.native.onAlarmDue((a) => due.push(a));
    await h.native.scheduleAlarms([
      { id: 'recent', at: NOW - 1000, mode: 'quiet' },
      { id: 'old', at: NOW - GRACE_MS - 1000, mode: 'quiet' },
    ]);
    expect(due.map((a) => a.id)).toEqual(['recent']);
  });
  it('unsubscribing stops the events', async () => {
    const h = make();
    const due: Alarm[] = [];
    const off = h.native.onAlarmDue((a) => due.push(a));
    off();
    await h.native.scheduleAlarms([{ id: 'a', at: NOW + 1000, mode: 'quiet' }]);
    h.advance(5000);
    expect(due).toEqual([]);
  });
  it('sends nothing but ids, moments and modes (no plan text)', async () => {
    const h = make();
    // what the page builds (desktopBridge.planAlarms): a plan's title and note are never in it
    await h.native.scheduleAlarms([{ id: 'a', at: NOW + 1000, mode: 'ring' }]);
    await h.native.cancelAlarms(['a']);
    const all = h.sent().join('');
    expect(
      Object.keys(JSON.parse(h.sent()[0]!).list?.[0] ?? JSON.parse(h.sent()[0]!)[0]).sort(),
    ).toEqual(['at', 'id', 'mode']);
    expect(all).not.toMatch(/Physio|secret|title|note/);
  });
});

describe('the shim on its own', () => {
  const win = (): Record<string, unknown> => ({});
  const mk = (port: unknown, w: Record<string, unknown>) =>
    (0, eval)(shimSource)(port, w) as Harness['native'] & {
      showAlarm(p: {
        id: string;
        title: string;
        body?: string;
        mode: 'quiet' | 'ring';
      }): Promise<void>;
    };
  it('showAlarm is the only message that carries text, and only what the page gives it', async () => {
    const sent: string[] = [];
    const n = mk({ postMessage: (m: string) => void sent.push(m) }, win());
    await n.showAlarm({ id: 'a', title: 'Physio visit', mode: 'quiet' });
    expect(JSON.parse(sent[0]!)).toEqual({
      t: 'show',
      id: 'a',
      title: 'Physio visit',
      body: '',
      mode: 'quiet',
    });
  });
  it('ignores malformed or unknown native messages and survives a listener that throws', () => {
    const w = win();
    const port: { postMessage(m: string): void; onmessage?: (e: { data: unknown }) => void } = {
      postMessage() {},
    };
    const n = mk(port, w);
    const got: Alarm[] = [];
    n.onAlarmDue(() => {
      throw new Error('listener bug');
    });
    n.onAlarmDue((a) => got.push(a));
    port.onmessage?.({ data: 'not json' });
    port.onmessage?.({ data: JSON.stringify({ t: 'nope' }) });
    port.onmessage?.({ data: JSON.stringify({ t: 'due', alarm: { id: 5 } }) });
    port.onmessage?.({
      data: JSON.stringify({ t: 'due', alarm: { id: 'x', at: 1, mode: 'weird' } }),
    });
    port.onmessage?.(undefined as never);
    expect(got).toEqual([{ id: 'x', at: 1, mode: 'quiet' }]);
  });
  it('drops any extra field of an alarm before it reaches native code', async () => {
    const sent: string[] = [];
    const n = mk({ postMessage: (m: string) => void sent.push(m) }, win());
    await n.scheduleAlarms([
      { id: 'a', at: 5, mode: 'ring', title: 'Physio visit', note: 'secret' } as unknown as Alarm,
    ]);
    expect(JSON.parse(sent[0]!)).toEqual({
      t: 'schedule',
      list: [{ id: 'a', at: 5, mode: 'ring' }],
    });
  });
  it('handles empty lists', async () => {
    const sent: string[] = [];
    const n = mk({ postMessage: (m: string) => void sent.push(m) }, win());
    await n.scheduleAlarms(undefined as never);
    await n.cancelAlarms(undefined as never);
    expect(sent.map((s) => JSON.parse(s))).toEqual([
      { t: 'schedule', list: [] },
      { t: 'cancel', ids: [] },
    ]);
  });
});
