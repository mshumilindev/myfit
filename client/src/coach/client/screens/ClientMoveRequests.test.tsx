/** SPO-205 (board C1): a trainer's or team manager's move request is answered on "My trainer" with the kit RequestCard. */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clientEn as cc } from '../../../i18n/coachClient.en';
import { scheduleEn as sc } from '../../../i18n/coachSchedule.en';
import { FIXTURE_NOW } from '../../data/__fixtures__/fixtures';
import { configureCoachData } from '../../data/config';
import { opaqueSlotKey } from '../../schedule/ids';
import {
  createFixturesSchedulePort,
  scheduleSeed,
  WEEK0,
} from '../../schedule/__fixtures__/fixtures';
import { tsOf } from '../../schedule/time';
import type { RescheduleRequest } from '../../schedule/types';
import { configureSchedule } from '../../schedule/useSchedule';
import { setViewport } from '../../testViewport';
import { createFixturesClientChatPort } from '../data/__fixtures__/chat';
import { createFixturesClientPort } from '../data/__fixtures__/fixtures';
import { configureClientCoach } from '../data/config';
import { ClientMoveRequests } from './ClientMoveRequests';
import { UpcomingSessions, useMySessions } from './ClientSchedule';
import { MyTrainerPage } from './MyTrainerPage';

beforeEach(() => setViewport(390));
afterEach(() => {
  cleanup();
  configureClientCoach();
  configureSchedule(null);
  configureCoachData();
});

const byManager: RescheduleRequest = {
  id: 'mq1',
  clientId: 'c2',
  from: 'trainer',
  via: 'manager',
  byName: 'Irina M.',
  slotKey: opaqueSlotKey(`r-c2-wed:${WEEK0 + 2}`),
  fromStart: tsOf(WEEK0 + 2, 18 * 60),
  toStart: tsOf(WEEK0 + 3, 10 * 60),
  note: 'Gym is closed.',
  status: 'pending',
  createdAt: FIXTURE_NOW - 1000,
  expiresAt: FIXTURE_NOW + 86_400_000,
  scope: 'all',
};

function setup(requests?: RescheduleRequest[]) {
  const base = createFixturesClientPort({ scenario: 'active', now: () => FIXTURE_NOW });
  const snap = { ...base.state(), link: { ...base.state().link, clientId: 'c2' } };
  const client = {
    ...base,
    peek: () => snap,
    subscribe: (on: (s: typeof snap) => void) => (on(snap), () => undefined),
  };
  configureClientCoach({ port: client, chat: createFixturesClientChatPort({ unread: 0 }) });
  const seed = scheduleSeed();
  const port = createFixturesSchedulePort({
    seed: requests ? { ...seed, requests } : seed,
    now: () => FIXTURE_NOW,
  });
  configureSchedule(port);
  return { port, client };
}

function Harness({ onPropose = () => undefined }: { onPropose?: (r: RescheduleRequest) => void }) {
  const my = useMySessions();
  if (!my) return null;
  return (
    <>
      <ClientMoveRequests my={my} trainerFirst="Olena" onPropose={onPropose} />
      <UpcomingSessions my={my} onMove={() => undefined} />
    </>
  );
}

describe('team move request on My trainer', () => {
  it("a manager's request names them and the team, shows Now -> Proposed and the note", async () => {
    setup([byManager]);
    render(<Harness />);
    expect(await screen.findByText(cc.mtReqTitleManager('Irina M.', 'Olena'))).toBeTruthy();
    expect(screen.getByText(cc.mtReqStatus)).toBeTruthy();
    expect(screen.getByText(/Gym is closed\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: new RegExp(`^${sc.rcAccept}`) })).toBeTruthy();
    expect(screen.getByRole('button', { name: new RegExp(`^${sc.rcDecline}`) })).toBeTruthy();
    expect(screen.getByRole('button', { name: new RegExp(`^${sc.rcCounter}`) })).toBeTruthy();
  });

  it("the trainer's own request reads as the trainer's", async () => {
    setup([{ ...byManager, id: 'tq1', via: undefined, byName: undefined }]);
    render(<Harness />);
    expect(await screen.findByText(cc.mtReqTitleTrainer('Olena'))).toBeTruthy();
  });

  it('Accept answers as the client through the schedule store and the card goes', async () => {
    const { port } = setup([byManager]);
    render(<Harness />);
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^${sc.rcAccept}`) }));
    await waitFor(() =>
      expect(port.dump().requests.find((r) => r.id === 'mq1')!.status).toBe('accepted'),
    );
    await waitFor(() =>
      expect(screen.queryByText(cc.mtReqTitleManager('Irina M.', 'Olena'))).toBeNull(),
    );
  });

  it('Decline answers no', async () => {
    const { port } = setup([byManager]);
    render(<Harness />);
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^${sc.rcDecline}`) }));
    await waitFor(() =>
      expect(port.dump().requests.find((r) => r.id === 'mq1')!.status).toBe('declined'),
    );
  });

  it('Suggest another time hands the request to the form (counter), nothing is answered yet', async () => {
    const { port } = setup([byManager]);
    const onPropose = vi.fn();
    render(<Harness onPropose={onPropose} />);
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^${sc.rcCounter}`) }));
    expect(onPropose).toHaveBeenCalledWith(expect.objectContaining({ id: 'mq1' }));
    expect(port.dump().requests.find((r) => r.id === 'mq1')!.status).toBe('pending');
  });

  it('a request I made myself is not a card to answer; a request waiting for ME is not "Waiting"', async () => {
    setup([{ ...byManager, id: 'mine', from: 'client', via: undefined, byName: undefined }]);
    render(<Harness />);
    await screen.findByText(cc.mtWaiting);
    expect(screen.queryByText(cc.mtReqStatus)).toBeNull();
    cleanup();
    setup([byManager]);
    render(<Harness />);
    await screen.findByText(cc.mtReqAnswer);
    expect(screen.queryByText(cc.mtWaiting)).toBeNull();
  });

  it('no open request: nothing is drawn', async () => {
    setup([]);
    render(<Harness />);
    await screen.findByText(cc.mtUpcomingHead('Iryna'));
    expect(screen.queryByText(cc.mtReqStatus)).toBeNull();
  });

  it('on the My trainer page: the card sits above the sessions and Suggest another time opens the counter form', async () => {
    const { port, client } = setup([byManager]);
    render(
      <MyTrainerPage
        port={client}
        schedulePort={port}
        onBack={() => undefined}
        onChat={() => undefined}
        onSharing={() => undefined}
        onProgram={() => undefined}
        onLeft={() => undefined}
      />,
    );
    expect(await screen.findByText(cc.mtReqTitleManager('Irina M.', 'Iryna'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${sc.rcCounter}`) }));
    expect(await screen.findByRole('form', { name: cc.rqTitle })).toBeTruthy();
  });
});
