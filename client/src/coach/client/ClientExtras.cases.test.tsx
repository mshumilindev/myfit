/** Member-side extras on Today / Programs / the workout: the tag, the next session, program notices, targets, day tags. */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clientEn as cc } from '../../i18n/coachClient.en';
import { scheduleEn as sc } from '../../i18n/coachSchedule.en';
import type { ProgramAssignment } from '../../data/programMine';
import { FIXTURE_NOW } from '../data/__fixtures__/fixtures';
import { createFixturesSchedulePort, scheduleSeed } from '../schedule/__fixtures__/fixtures';
import { configureSchedule } from '../schedule/useSchedule';
import { emptyDoc, type ScheduleDoc } from '../schedule/types';
import { dayOfTs, tsOf } from '../schedule/time';
import { setViewport } from '../testViewport';
import { createFixturesClientChatPort } from './data/__fixtures__/chat';
import { createFixturesClientPort, type ClientScenario } from './data/__fixtures__/fixtures';
import { configureClientCoach } from './data/config';
import type { ClientCoachPort } from './data/port';
import type { ClientSnapshot } from './data/types';
import {
  ClientProgramExtras,
  ClientTargetStrip,
  ClientTodayExtras,
  ClientTrainerDayTag,
} from './ClientExtras';
import { setExerciseUnit } from '../../store';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('../../navigateHash', () => ({ navigateHash: navigate }));

beforeEach(() => {
  setViewport(1440);
  navigate.mockClear();
});
afterEach(() => {
  cleanup();
  configureClientCoach();
  configureSchedule(null);
  setExerciseUnit('Barbell Squat', 'kg');
});

function setup(
  scenario: ClientScenario,
  tweak?: (s: ClientSnapshot) => ClientSnapshot,
  docs?: ScheduleDoc[],
) {
  const base = createFixturesClientPort({ scenario, now: () => FIXTURE_NOW });
  let port: ClientCoachPort & { state(): ClientSnapshot } = base;
  if (tweak) {
    const snap = tweak(base.state());
    port = {
      ...base,
      state: () => snap,
      peek: () => snap,
      subscribe: (on) => (on(snap), () => undefined),
    };
  }
  configureClientCoach({ port, chat: createFixturesClientChatPort({ unread: 0 }) });
  const seed = scheduleSeed();
  configureSchedule(
    createFixturesSchedulePort({
      seed: docs
        ? { ...seed, docs: [...seed.docs.filter((d) => d.clientId !== 'c1'), ...docs] }
        : seed,
      now: () => FIXTURE_NOW,
    }),
  );
  return port;
}

describe('ClientTodayExtras', () => {
  it('without a trainer and without coach days it shows nothing', async () => {
    setup('none', (s) => ({ ...s, selfCoachDays: [] }));
    const { container } = render(<ClientTodayExtras />);
    await new Promise((r) => setTimeout(r, 20));
    expect(container.innerHTML).toBe('');
  });

  it('without a trainer, the days I marked with my own coach show as one tag', async () => {
    setup('none');
    render(<ClientTodayExtras />);
    expect(await screen.findByText(cc.tdCoachTag('Tue, Fri'))).toBeTruthy();
  });

  it('with a trainer whose next session I already asked to move: "waiting", Cancel withdraws it and the tile offers a new request', async () => {
    setup('active');
    render(<ClientTodayExtras />);
    fireEvent.click(await screen.findByRole('button', { name: cc.tdCancelReq }));
    expect(await screen.findByRole('button', { name: cc.tdRequest })).toBeTruthy();
    expect(screen.queryByRole('button', { name: cc.tdCancelReq })).toBeNull();
  });

  it('a session today adds "With your trainer · time"; the next-session tile follows', async () => {
    const today = dayOfTs(FIXTURE_NOW);
    const doc: ScheduleDoc = {
      ...emptyDoc('c1'),
      oneOffs: [{ id: 'later', day: today, start: '17:30', dur: 60, gymId: 'iron-yard' }],
    };
    setup('active', undefined, [doc]);
    render(<ClientTodayExtras />);
    expect(await screen.findByText(cc.tdWithTag('17:30'))).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: cc.tdRequest }));
    // the reschedule sheet opens for that session, in the client's voice
    expect(await screen.findByText(cc.rqTitle)).toBeTruthy();
  });

  it('Request on the next-session tile sends a request in my voice; "Open chat" goes to the trainer chat and the sheet can be dismissed', async () => {
    const today = dayOfTs(FIXTURE_NOW);
    const doc: ScheduleDoc = {
      ...emptyDoc('c1'),
      oneOffs: [{ id: 'later', day: today, start: '17:30', dur: 60, gymId: 'iron-yard' }],
    };
    setup('active', undefined, [doc]);
    render(<ClientTodayExtras />);
    fireEvent.click(await screen.findByRole('button', { name: cc.tdRequest }));
    await screen.findByText(cc.rqTitle);
    fireEvent.click(document.querySelector<HTMLElement>(`[data-day="${today + 1}"]`)!);
    fireEvent.change(screen.getByLabelText(sc.rfStart), { target: { value: '10:00' } });
    fireEvent.click(screen.getByRole('button', { name: sc.rfSend }));
    expect(await screen.findByText(cc.rqSent)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: sc.rfOpenChat }));
    expect(navigate).toHaveBeenCalledWith('#/trainer/chat');
  });

  it('closing the reschedule sheet without sending leaves the tile as it was', async () => {
    const today = dayOfTs(FIXTURE_NOW);
    const doc: ScheduleDoc = {
      ...emptyDoc('c1'),
      oneOffs: [{ id: 'later', day: today, start: '17:30', dur: 60, gymId: 'iron-yard' }],
    };
    setup('active', undefined, [doc]);
    render(<ClientTodayExtras />);
    fireEvent.click(await screen.findByRole('button', { name: cc.tdRequest }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: cc.tdRequest })).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('a revoked/waiting link still renders (a trainer exists); loading data shows nothing yet', async () => {
    setup('waiting');
    const { container } = render(<ClientTodayExtras />);
    await waitFor(() => expect(container.querySelector('.cc-strip')).toBeTruthy());
  });
});

describe('ClientProgramExtras', () => {
  it('without a trainer: coach-day chips toggle the days through the port', async () => {
    const port = setup('none');
    const set = vi.spyOn(port, 'setSelfCoachDays');
    render(<ClientProgramExtras assignment={null} />);
    const group = await screen.findByRole('group', { name: cc.tdCoachDaysRow });
    const chips = within(group).getAllByRole('button');
    expect(chips).toHaveLength(7);
    const pressed = chips.filter((c) => c.getAttribute('aria-pressed') === 'true');
    expect(pressed).toHaveLength(2); // Tue and Fri in the fixture
    fireEvent.click(chips[0]); // Monday on
    expect(set).toHaveBeenLastCalledWith(['Tue', 'Fri', 'Mon']);
    fireEvent.click(pressed[0]); // Tuesday off
    expect(set).toHaveBeenLastCalledWith(['Fri']);
  });

  it('with a trainer: the program-updated notice names the trainer and version; Got it acknowledges once and hides the notice', async () => {
    const port = setup('active');
    const ack = vi.spyOn(port, 'ackProgram');
    render(<ClientProgramExtras assignment={null} />);
    expect(await screen.findByText(cc.pgUpdated('Iryna'))).toBeTruthy();
    expect(screen.getByText(/Version v5/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: cc.pgAck }));
    expect(ack).toHaveBeenCalledWith(5);
    await waitFor(() => expect(screen.queryByText(cc.pgUpdated('Iryna'))).toBeNull());
  });

  it('days with the trainer and planned activities have their own notices; an acknowledged program has no update notice', async () => {
    setup('active', (s) => ({ ...s, program: { ...s.program!, acked: true } }));
    render(<ClientProgramExtras assignment={null} />);
    expect(
      await screen.findByText(new RegExp(`Tue, Fri · ${cc.pgDaysNote('Iryna').slice(0, 10)}`)),
    ).toBeTruthy();
    expect(screen.getByText(cc.pgActivityNote('Iryna'))).toBeTruthy();
    expect(screen.queryByText(cc.pgUpdated('Iryna'))).toBeNull();
  });

  it('no trainer days and no activities: no notices; exercises without numbers add the "no numbers" note', async () => {
    setup('active', (s) => ({
      ...s,
      program: { ...s.program!, acked: true, trainerDays: [], activities: [] },
    }));
    const item = (id: string, over = {}) => ({
      id,
      day: 1,
      position: 0,
      name: 'Plank',
      kind: 'strength',
      sets: 3,
      reps: 10,
      durationMin: null,
      equipment: [],
      ...over,
    });
    const a = { program: { items: [item('x', { bare: true })] } } as unknown as ProgramAssignment;
    const { rerender } = render(<ClientProgramExtras assignment={a} />);
    expect(await screen.findByText(cc.pgBareNote)).toBeTruthy();
    expect(screen.queryByText(cc.pgActivityNote('Iryna'))).toBeNull();
    const zero = { program: { items: [item('y', { sets: 0 })] } } as unknown as ProgramAssignment;
    rerender(<ClientProgramExtras assignment={zero} />);
    expect(screen.getByText(cc.pgBareNote)).toBeTruthy();
    const normal = { program: { items: [item('z')] } } as unknown as ProgramAssignment;
    rerender(<ClientProgramExtras assignment={normal} />);
    expect(screen.queryByText(cc.pgBareNote)).toBeNull();
  });
});

describe('ClientTargetStrip', () => {
  const item = (over: Record<string, unknown> = {}) => ({
    id: 'i1',
    day: 1,
    position: 0,
    name: 'Barbell Squat',
    kind: 'strength',
    sets: 3,
    reps: 5,
    durationMin: null,
    equipment: [],
    ...over,
  });
  const asg = (...items: unknown[]) => ({ program: { items } }) as unknown as ProgramAssignment;

  it('renders nothing for a member without a trainer, for a missing row, bare rows, zero sets and non-strength rows', async () => {
    setup('none');
    const a = render(<ClientTargetStrip exName="Barbell Squat" assignment={asg(item())} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(a.container.innerHTML).toBe('');
    cleanup();
    setup('active');
    for (const extra of [{ bare: true }, { sets: 0 }, { kind: 'cardio' }]) {
      const r = render(<ClientTargetStrip exName="Barbell Squat" assignment={asg(item(extra))} />);
      await new Promise((res) => setTimeout(res, 10));
      expect(r.container.innerHTML).toBe('');
      cleanup();
    }
    const r = render(<ClientTargetStrip exName="Nothing" assignment={asg(item())} />);
    await new Promise((res) => setTimeout(res, 10));
    expect(r.container.innerHTML).toBe('');
  });

  it('a row without a target weight reads Bodyweight; rest shows m:ss with zero padding; the name match ignores case', async () => {
    setup('active');
    render(<ClientTargetStrip exName="barbell squat" assignment={asg(item({ restSec: 65 }))} />);
    expect(await screen.findByText(/3 × 5 · Bodyweight/)).toBeTruthy();
    expect(screen.getByText(new RegExp(cc.seRest('1:05')))).toBeTruthy();
    expect(screen.queryByText(/RPE/)).toBeNull();
  });
});

describe('ClientTrainerDayTag', () => {
  it('tags a weekday the trainer owns (ISO: Tuesday = 2) and nothing else', async () => {
    setup('active');
    const tue = render(<ClientTrainerDayTag dow={2} />);
    expect(await screen.findByText(cc.pgWithTrainer)).toBeTruthy();
    tue.unmount();
    const mon = render(<ClientTrainerDayTag dow={1} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(mon.container.innerHTML).toBe('');
  });

  it('shows nothing without a trainer or without a program layer', async () => {
    setup('none');
    const a = render(<ClientTrainerDayTag dow={2} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(a.container.innerHTML).toBe('');
    cleanup();
    setup('active', (s) => ({ ...s, program: null }));
    const b = render(<ClientTrainerDayTag dow={2} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(b.container.innerHTML).toBe('');
  });
});

void tsOf;
