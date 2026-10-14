/**
 * Smaller parity checks on the shared store: the member reads the trainer's shared notes (and never the private ones),
 * the trainer's time zone travels with the schedule and the member's device shows the same wall-clock times.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { configureCoachData } from '../config';
import { configureClientCoach } from '../../client/data/config';
import { scheduleStoreFor } from '../../schedule/useSchedule';
import { generateSlots } from '../../schedule/model';
import { sealSchedule } from '../../schedule/scheduleCodec';
import { dayOfTs, minOfTs, tsOf, weekStartDay } from '../../schedule/time';
import {
  coachClock,
  coachTimeZone,
  initCoachTimeZone,
  saveCoachTimeZone,
  setCoachTimeZone,
} from '../../format';
import { C, NOW, T } from './parity/harness';
import { latest, linkUp, settle } from './parity/flow';

afterEach(() => {
  setCoachTimeZone('UTC');
  try {
    window.localStorage.removeItem('spotter.coach.tz');
  } catch {
    /* none */
  }
});

describe('shared notes on the client install', () => {
  it('the member sees the shared note and never the private one', async () => {
    const w = await linkUp();
    await w.tr.notes.add({
      clientId: C,
      text: 'Knee is better, add depth',
      vis: 'shared',
      anchor: null,
    } as never);
    await w.tr.notes.add({
      clientId: C,
      text: 'private: pays late',
      vis: 'private',
      anchor: null,
    } as never);
    const seen =
      (await latest<{ text: string; vis: string }[]>(
        (on, er) => w.cl.notes.subscribe(C, (n) => on(n as never), er),
        120,
      )) ?? [];
    expect(seen.map((n) => n.text)).toEqual(['Knee is better, add depth']);
    expect(w.cl.fs.denied).toEqual([]);
  });
});

describe('time zone', () => {
  it('init takes the stored setting, else the browser zone; a bad value falls back', () => {
    saveCoachTimeZone('Europe/Kyiv');
    setCoachTimeZone('UTC');
    expect(initCoachTimeZone()).toBe('Europe/Kyiv');
    expect(coachTimeZone()).toBe('Europe/Kyiv');
    window.localStorage.setItem('spotter.coach.tz', 'Not/AZone');
    expect(initCoachTimeZone()).toBe(new Intl.DateTimeFormat().resolvedOptions().timeZone);
    saveCoachTimeZone('Mars/Base');
    expect(window.localStorage.getItem('spotter.coach.tz')).toBe('Not/AZone'); // refused, nothing stored
  });

  it("a session made at 18:00 in the trainer's zone is 18:00 on the member's device, and the right instant", async () => {
    const w = await linkUp();
    configureCoachData({ chat: w.tr.chat, uid: T });
    configureClientCoach({ chat: w.cl.chatClient, port: w.cl.port });
    saveCoachTimeZone('Europe/Kyiv'); // the trainer's device
    const ts = scheduleStoreFor(w.tr.schedule);
    const cs = scheduleStoreFor(w.cl.schedule);
    ts.start();
    cs.start();
    await settle(50);
    const today = dayOfTs(NOW);
    expect(
      await ts.save({
        clientIds: [C],
        label: 'weekly',
        pattern: {
          id: 'p1',
          fromDay: today,
          weeks: 4,
          rows: [{ id: 'r1', dow: 2, start: '18:00', dur: 60, gymId: 'iron-yard' }],
        },
      }),
      String(ts.getState().failed),
    ).toBe(true);
    await settle(80);
    expect(ts.getState().docs[0].tz).toBe('Europe/Kyiv');
    const wed = weekStartDay(today) + 2; // dow 2 = Wednesday
    const expected = tsOf(wed >= today ? wed : wed + 7, 18 * 60, 'Europe/Kyiv');

    // the member's phone starts in its own zone (UTC here) and adopts the zone the trainer wrote the schedule in
    setCoachTimeZone('UTC');
    cs.stop();
    const cs2 = scheduleStoreFor(w.cl.schedule);
    cs2.start();
    await settle(120);
    expect(coachTimeZone()).toBe('Europe/Kyiv');
    const slots = generateSlots(cs2.getState().docs, cs2.getState().requests, {
      fromDay: today,
      toDay: today + 21,
      now: NOW,
    }).filter((s) => s.status === 'planned');
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].start).toBe(expected);
    expect(coachClock(slots[0].start)).toBe('18:00');
    expect(minOfTs(slots[0].start)).toBe(18 * 60);
  });

  it('a schedule written before zones were stored (no tz in the sealed document) still opens on the member device, read in the zone the app already uses', async () => {
    const w = await linkUp();
    // build the old shape for real: sealed with the same codec, but without `tz`
    const legacy = {
      clientId: C,
      rev: 1,
      patterns: [],
      oneOffs: [
        { id: 'o-old', day: dayOfTs(NOW) + 3, start: '09:00', dur: 45, gymId: 'iron-yard' },
      ],
      exceptions: [],
      cancelled: [],
    };
    const ring = w.tr.book.ringFor(C)!;
    const raw = await sealSchedule({ vault: w.tr.vault, ring }, legacy, T, NOW);
    w.s.fs.seed(`schedules/${C}`, raw as never);
    const cs = scheduleStoreFor(w.cl.schedule);
    cs.start();
    await settle(100);
    const doc = cs.getState().docs.find((d) => d.clientId === C);
    expect(doc).toBeTruthy();
    expect(doc!.tz).toBeUndefined();
    expect(doc!.oneOffs.map((o) => o.id)).toEqual(['o-old']);
    expect(coachTimeZone()).toBe('UTC'); // nothing to adopt: the zone stays what the app already used
  });
});
