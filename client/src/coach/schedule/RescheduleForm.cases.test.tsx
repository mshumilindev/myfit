/**
 * The reschedule form: the three ways in (known session, pick, counter), shared-session scope, clash notice, free-time chips,
 * validation errors mapped to messages, and the sent state. Real store over the fixture schedule port.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scheduleEn as t } from '../../i18n/coachSchedule.en';
import { FIXTURE_NOW } from '../data/__fixtures__/fixtures';
import type { CoachClient } from '../domain/types';
import { setViewport } from '../testViewport';
import { createFixturesSchedulePort, scheduleSeed, WEEK0 } from './__fixtures__/fixtures';
import { generateSlots } from './model';
import { opaqueSlotKey } from './ids';
import type { People } from './people';
import { RescheduleForm, type RescheduleFormProps } from './RescheduleForm';
import { createScheduleStore } from './scheduleStore';
import { dayOfTs, tsOf } from './time';
import type { RescheduleRequest, ScheduleSlot } from './types';

beforeEach(() => setViewport(1440));
afterEach(cleanup);

const client = (id: string, name: string): CoachClient =>
  ({ id, name, hasPhoto: false }) as unknown as CoachClient;
const LIST = [
  client('c1', 'Oleh Bondar'),
  client('c2', 'Sofiia Koval'),
  client('c5', 'Maria Hnatiuk'),
  client('c10', 'Dmytro Lys'),
];
const people: People = {
  list: LIST,
  byId: new Map(LIST.map((c) => [c.id, c])),
  name: (id) => LIST.find((c) => c.id === id)?.name ?? id,
  first: (id) => (LIST.find((c) => c.id === id)?.name ?? id).split(' ')[0],
  loading: false,
};
const TODAY = dayOfTs(FIXTURE_NOW);

function setup(over: Partial<RescheduleFormProps> = {}, requests: RescheduleRequest[] = []) {
  const seed = scheduleSeed();
  const port = createFixturesSchedulePort({ seed: { ...seed, requests }, now: () => FIXTURE_NOW });
  const posted: RescheduleRequest[] = [];
  const store = createScheduleStore(port, {
    isOnline: () => true,
    onRequest: (r) => posted.push(r),
  });
  store.start();
  const slots = generateSlots(store.getState().docs, store.getState().requests, {
    fromDay: WEEK0 - 7,
    toDay: WEEK0 + 40,
    now: FIXTURE_NOW,
  });
  const props: RescheduleFormProps = {
    store,
    people,
    slots,
    requests: store.getState().requests,
    t,
    locale: 'en',
    now: FIXTURE_NOW,
    today: TODAY,
    mode: 'pick',
    onClose: vi.fn(),
    ...over,
  };
  const view = render(<RescheduleForm {...props} />);
  return { port, store, slots, posted, props, ...view };
}
const slotOf = (slots: ScheduleSlot[], id: string) => slots.find((s) => s.id === id)!;
const pickDay = (day: number) => {
  const grid = screen.getAllByRole('gridcell');
  const btn = grid.map((g) => within(g).queryByRole('button')).filter(Boolean) as HTMLElement[];
  const target = btn.find(
    (b) =>
      b.getAttribute('data-day') === String(day) ||
      b.getAttribute('aria-label')?.includes(longEn(day)),
  );
  if (!target) throw new Error(`no day button for ${day}`);
  fireEvent.click(target);
};
const longEn = (day: number) =>
  new Date(day * 86_400_000).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
const setTime = (hhmm: string) =>
  fireEvent.change(screen.getByLabelText(t.rfStart), { target: { value: hhmm } });

describe('known session, solo', () => {
  const FRI = WEEK0 + 4;
  const id = `r-c1-fri:${FRI}`;

  it('is titled with the person, shows the current time, and Send is disabled until day and time are chosen', async () => {
    const { slots } = setup({ mode: 'known', slot: undefined });
    cleanup();
    const s = slotOf(slots, id);
    setup({ mode: 'known', slot: s, clientId: 'c1' });
    expect(screen.getByRole('form', { name: t.rfTitleKnown('Oleh') })).toBeTruthy();
    expect(screen.getByText(t.rfNow)).toBeTruthy();
    const send = screen.getByRole('button', { name: t.rfSend }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    pickDay(FRI + 1);
    expect(send.disabled).toBe(true);
    setTime('10:00');
    expect(send.disabled).toBe(false);
  });

  it('sends one request from the trainer at the chosen wall-clock time, posts the card, and shows the sent state with Open chat', async () => {
    const { slots } = setup({ mode: 'known' });
    cleanup();
    const s = slotOf(slots, id);
    const onOpenChat = vi.fn();
    const { port, posted, props } = setup({ mode: 'known', slot: s, clientId: 'c1', onOpenChat });
    pickDay(FRI + 1);
    setTime('10:00');
    fireEvent.change(screen.getByLabelText(t.rfNote), {
      target: { value: '  Back from a trip  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: t.rfSend }));
    expect(await screen.findByText(t.rfSent)).toBeTruthy();
    expect(screen.getByText(t.rfSentB('Oleh'))).toBeTruthy();
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({
      clientId: 'c1',
      from: 'trainer',
      scope: 'all',
      toStart: tsOf(FRI + 1, 600),
      fromStart: s.start,
      note: 'Back from a trip',
      slotKey: opaqueSlotKey(s.key),
      status: 'pending',
    });
    expect(posted[0].groupKey).toBeUndefined();
    expect(port.dump().requests.some((r) => r.id === posted[0].id)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: t.rfOpenChat }));
    expect(onOpenChat).toHaveBeenCalledWith('c1');
    fireEvent.click(screen.getByRole('button', { name: t.rfDone }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('the client side asks in its own voice: from client, own copy, no client picker', async () => {
    const { slots } = setup({ mode: 'pick' });
    cleanup();
    const s = slotOf(slots, id);
    const { posted } = setup({
      mode: 'known',
      slot: s,
      clientId: 'c1',
      side: 'client',
      copy: {
        title: 'Ask to move',
        sub: 'Your trainer will see it',
        sent: 'Asked!',
        sentB: 'Wait for the answer',
      },
    });
    expect(screen.getByRole('form', { name: 'Ask to move' })).toBeTruthy();
    expect(screen.getByText('Your trainer will see it')).toBeTruthy();
    pickDay(FRI + 1);
    setTime('11:00');
    fireEvent.click(screen.getByRole('button', { name: t.rfSend }));
    expect(await screen.findByText('Asked!')).toBeTruthy();
    expect(screen.getByText('Wait for the answer')).toBeTruthy();
    expect(screen.queryByRole('button', { name: t.rfOpenChat })).toBeNull();
    await waitFor(() => expect(posted[0]?.from).toBe('client'));
  });

  it('a time equal to the current one and a time in the past are refused with their own messages; nothing is created', async () => {
    const { slots } = setup({ mode: 'pick' });
    cleanup();
    const s = slotOf(slots, id);
    const { posted, port } = setup({ mode: 'known', slot: s, clientId: 'c1' });
    pickDay(FRI);
    setTime('18:00');
    fireEvent.click(screen.getByRole('button', { name: t.rfSend }));
    expect(await screen.findByText(t.rfSame)).toBeTruthy();
    pickDay(TODAY);
    setTime('08:00'); // today 08:00 is before the fixture clock (09:05)
    fireEvent.click(screen.getByRole('button', { name: t.rfSend }));
    await waitFor(() => expect(screen.getByText(t.rfPast)).toBeTruthy());
    expect(posted).toEqual([]);
    expect(port.dump().requests).toEqual([]);
  });

  it('a second request for the same session says there is an open one', async () => {
    const { slots } = setup({ mode: 'pick' });
    cleanup();
    const s = slotOf(slots, id);
    const existing: RescheduleRequest = {
      id: 'open1',
      clientId: 'c1',
      from: 'trainer',
      slotKey: opaqueSlotKey(s.key),
      fromStart: s.start,
      toStart: s.start + 86_400_000,
      status: 'pending',
      createdAt: FIXTURE_NOW - 1000,
      expiresAt: FIXTURE_NOW + 86_400_000,
      scope: 'all',
    };
    setup({ mode: 'known', slot: s, clientId: 'c1' }, [existing]);
    pickDay(FRI + 2);
    setTime('10:00');
    fireEvent.click(screen.getByRole('button', { name: t.rfSend }));
    expect(await screen.findByText(t.rfDup)).toBeTruthy();
  });

  it('a request the port refuses reads "not sent" and can be retried', async () => {
    const { slots } = setup({ mode: 'pick' });
    cleanup();
    const s = slotOf(slots, id);
    const { port } = setup({ mode: 'known', slot: s, clientId: 'c1' });
    port.createRequest = async () => {
      throw new Error('offline');
    };
    pickDay(FRI + 1);
    setTime('10:00');
    fireEvent.click(screen.getByRole('button', { name: t.rfSend }));
    expect(await screen.findByText(t.rfFailed)).toBeTruthy();
    expect((screen.getByRole('button', { name: t.rfSend }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('suggests free full-hour times on the chosen day (never one that clashes) and a chosen chip fills the time', async () => {
    const { slots } = setup({ mode: 'pick' });
    cleanup();
    const s = slotOf(slots, id);
    setup({ mode: 'known', slot: s, clientId: 'c1' });
    pickDay(FRI + 1);
    const group = screen.getByRole('group', { name: t.rfSuggested });
    const chips = within(group)
      .getAllByRole('button')
      .map((b) => b.textContent);
    // Saturday 09:00 is another client's session: that hour is left out
    expect(chips).toEqual(['08:00', '10:00', '11:00', '12:00', '13:00']);
    fireEvent.click(within(group).getByRole('button', { name: '10:00' }));
    expect((screen.getByLabelText(t.rfStart) as HTMLInputElement).value).toBe('10:00');
    expect(within(group).getByRole('button', { name: '10:00' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('warns (without blocking) when the new time overlaps another session of the trainer', async () => {
    const { slots } = setup({ mode: 'pick' });
    cleanup();
    const s = slotOf(slots, id);
    setup({ mode: 'known', slot: s, clientId: 'c1' });
    // Thursday 12:00 is the mobility class (c2, c5, c10)
    pickDay(WEEK0 + 3);
    setTime('12:15');
    expect(await screen.findByText(t.rfClashH)).toBeTruthy();
    expect(screen.getByText(/Sofiia, Maria, Dmytro, 12:00/)).toBeTruthy();
    expect((screen.getByRole('button', { name: t.rfSend }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    // the suggestion list leaves the clashing hour out
    const chips = within(screen.getByRole('group', { name: t.rfSuggested }))
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(chips).not.toContain('12:00');
  });
});

describe('shared session', () => {
  const THU = WEEK0 + 3;
  const id = `r-mob:${THU}`;

  it('lists who moves: Everyone sends one request per attendee sharing a group key; Only one sends one with scope one', async () => {
    const { slots } = setup({ mode: 'pick' });
    cleanup();
    const s = slotOf(slots, id);
    expect(s.kind).toBe('group');
    const a = setup({ mode: 'known', slot: s, clientId: 'c2' });
    // the form was opened for one person of the group: "Only Sofiia" is preselected
    const scope = screen.getByRole('group', { name: t.rfScope });
    expect(
      within(scope)
        .getByRole('button', { name: t.rfScopeOne('Sofiia') })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(screen.getByText(t.rfScopeOneHint)).toBeTruthy();
    fireEvent.click(within(scope).getByRole('button', { name: t.rfScopeAll(3) }));
    expect(screen.getByText(t.rfScopeAllHint)).toBeTruthy();
    pickDay(THU + 1);
    setTime('12:00');
    fireEvent.click(screen.getByRole('button', { name: t.rfSend }));
    expect(await screen.findByText(t.rfSentGroup(3))).toBeTruthy();
    expect(screen.getByText(t.rfSentGroupB)).toBeTruthy();
    await waitFor(() => expect(a.posted).toHaveLength(3));
    expect(a.posted.map((r) => r.clientId).sort()).toEqual(['c10', 'c2', 'c5']);
    expect(new Set(a.posted.map((r) => r.groupKey)).size).toBe(1);
    expect(a.posted[0].groupKey).toMatch(/^gk-/);
    expect(a.posted.every((r) => r.scope === 'all')).toBe(true);
  });

  it('Only one person: a single request with scope one for that person and no group key', async () => {
    const { slots } = setup({ mode: 'pick' });
    cleanup();
    const s = slotOf(slots, id);
    const { posted } = setup({ mode: 'known', slot: s, clientId: 'c5' });
    pickDay(THU + 1);
    setTime('12:00');
    fireEvent.click(screen.getByRole('button', { name: t.rfSend }));
    expect(await screen.findByText(t.rfSent)).toBeTruthy();
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({ clientId: 'c5', scope: 'one' });
    expect(posted[0].groupKey).toBeUndefined();
  });
});

describe('pick mode', () => {
  it("lists the client's upcoming sessions (not the ones already asked about), choosing one reveals the time controls; switching client clears it", async () => {
    const asked = `r-c1-fri:${WEEK0 + 4}`;
    const { slots } = setup({ mode: 'pick' });
    cleanup();
    const first = slotOf(slots, asked);
    const open: RescheduleRequest = {
      id: 'open1',
      clientId: 'c1',
      from: 'client',
      slotKey: opaqueSlotKey(first.key),
      fromStart: first.start,
      toStart: first.start + 86_400_000,
      status: 'pending',
      createdAt: FIXTURE_NOW - 1000,
      expiresAt: FIXTURE_NOW + 86_400_000,
      scope: 'all',
    };
    setup({ mode: 'pick', clientId: 'c1' }, [open]);
    const list = screen.getByRole('region', { name: t.rfWhichHint });
    const rows = within(list).getAllByRole('button');
    expect(rows.length).toBeLessThanOrEqual(8);
    expect(rows.some((r) => r.textContent?.includes('Fri, 9 Oct'))).toBe(false);
    expect(screen.queryByText(t.rfNewTime)).toBeNull();
    fireEvent.click(rows[0]);
    expect(screen.getByText(t.rfNewTime)).toBeTruthy();
    expect(
      rows[0].getAttribute('aria-selected') ?? rows[0].getAttribute('aria-pressed') ?? 'x',
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText(t.rfClient), { target: { value: 'c2' } });
    expect(screen.queryByText(t.rfNewTime)).toBeNull();
  });

  it('the client side has no client picker; a member without upcoming sessions gets the empty copy given', async () => {
    setup({
      mode: 'pick',
      clientId: 'c13',
      side: 'client',
      copy: { noSessions: 'Nothing planned', noSessionsB: 'Ask your trainer' },
    });
    expect(screen.queryByLabelText(t.rfClient)).toBeNull();
    expect(screen.getByText('Nothing planned')).toBeTruthy();
    expect(screen.getByText('Ask your trainer')).toBeTruthy();
  });

  it('without a chosen session Send is disabled', () => {
    setup({ mode: 'pick', clientId: 'c1' });
    expect((screen.getByRole('button', { name: t.rfSend }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});

describe('counter mode', () => {
  it("answers the client's request: the proposed day and time are prefilled, the old request becomes countered, a new one supersedes it", async () => {
    const { slots } = setup({ mode: 'pick' });
    cleanup();
    const s = slotOf(slots, `r-c1-fri:${WEEK0 + 4}`);
    const theirs: RescheduleRequest = {
      id: 'theirs',
      clientId: 'c1',
      from: 'client',
      slotKey: opaqueSlotKey(s.key),
      fromStart: s.start,
      toStart: tsOf(WEEK0 + 5, 10 * 60),
      status: 'pending',
      createdAt: FIXTURE_NOW - 1000,
      expiresAt: FIXTURE_NOW + 86_400_000,
      scope: 'all',
    };
    const { port, posted } = setup({ mode: 'counter', counterOf: theirs }, [theirs]);
    expect(screen.getByRole('form', { name: t.rfTitleCounter })).toBeTruthy();
    expect(screen.getByText(/You are replying to a request for/)).toBeTruthy();
    expect((screen.getByLabelText(t.rfStart) as HTMLInputElement).value).toBe('10:00');
    setTime('11:30');
    fireEvent.click(screen.getByRole('button', { name: t.rfSend }));
    expect(await screen.findByText(t.rfSent)).toBeTruthy();
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({
      supersedes: 'theirs',
      from: 'trainer',
      toStart: tsOf(WEEK0 + 5, 11 * 60 + 30),
      clientId: 'c1',
    });
    expect(port.dump().requests.find((r) => r.id === 'theirs')!.status).toBe('countered');
  });

  it('a counter the store refuses (the request is no longer open) reads "not sent"', async () => {
    const { slots } = setup({ mode: 'pick' });
    cleanup();
    const s = slotOf(slots, `r-c1-fri:${WEEK0 + 4}`);
    const closed: RescheduleRequest = {
      id: 'closed',
      clientId: 'c1',
      from: 'client',
      slotKey: opaqueSlotKey(s.key),
      fromStart: s.start,
      toStart: tsOf(WEEK0 + 5, 10 * 60),
      status: 'declined',
      createdAt: FIXTURE_NOW - 1000,
      expiresAt: FIXTURE_NOW + 86_400_000,
      scope: 'all',
    };
    setup({ mode: 'counter', counterOf: closed }, [closed]);
    setTime('11:30');
    fireEvent.click(screen.getByRole('button', { name: t.rfSend }));
    expect(await screen.findByText(t.rfFailed)).toBeTruthy();
  });
});

describe('panel and chat', () => {
  it('the title can be left to the panel; Cancel closes without sending', () => {
    const { props } = setup({ mode: 'pick', clientId: 'c1', titleInPanel: true });
    expect(screen.queryByRole('heading', { name: t.rfTitle })).toBeNull();
    expect(screen.getByRole('form', { name: t.rfTitle })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t.rfCancel }));
    expect(props.onClose).toHaveBeenCalled();
  });
});
