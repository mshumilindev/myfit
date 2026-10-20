/** The Storybook frames render the real shell / chat around a chosen schedule port; assert the structure they promise. */
import { currentHash } from '../../route';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scheduleEn as t } from '../../i18n/coachSchedule.en';
import { setViewport } from '../testViewport';
import { createFixturesSchedulePort } from './__fixtures__/fixtures';
import { ScheduleChatFrame, ScheduleStoryFrame } from './ScheduleStoryFrame';
import { configureSchedule } from './useSchedule';

beforeEach(() => setViewport(1440));
afterEach(() => {
  cleanup();
  configureSchedule(null);
  window.history.replaceState(null, '', '/');
});

describe('ScheduleStoryFrame', () => {
  it('opens the schedule route from the hash inside the coach shell, on a port made once per mount', async () => {
    const makePort = vi.fn(() => createFixturesSchedulePort());
    const { rerender } = render(<ScheduleStoryFrame makePort={makePort} hash="#/c/schedule" />);
    expect(await screen.findByRole('navigation')).toBeTruthy();
    await waitFor(() => expect(currentHash()).toBe('#/c/schedule'));
    expect((await screen.findAllByText(t.scTitle)).length).toBeGreaterThan(0);
    expect(makePort).toHaveBeenCalledTimes(1);
    rerender(<ScheduleStoryFrame makePort={makePort} hash="#/c/schedule" />);
    expect(makePort).toHaveBeenCalledTimes(1);
  });

  it('a form hash opens that form (the builder)', async () => {
    render(
      <ScheduleStoryFrame
        makePort={() => createFixturesSchedulePort()}
        hash="#/c/schedule?form=plan"
      />,
    );
    expect(await screen.findByRole('form', { name: t.bdTitle })).toBeTruthy();
  });

  it('the hash in the address bar follows the prop', async () => {
    const make = () => createFixturesSchedulePort();
    const { rerender } = render(
      <ScheduleStoryFrame makePort={make} hash="#/c/schedule?view=month" />,
    );
    await waitFor(() => expect(currentHash()).toBe('#/c/schedule?view=month'));
    rerender(<ScheduleStoryFrame makePort={make} hash="#/c/schedule?view=week" />);
    await waitFor(() => expect(currentHash()).toBe('#/c/schedule?view=week'));
  });
});

describe('ScheduleStoryFrame exits', () => {
  it('the exits of the shell (switch app, my workouts, profile) are inert in a story: the schedule stays on screen', async () => {
    setViewport(390);
    render(
      <ScheduleStoryFrame makePort={() => createFixturesSchedulePort()} hash="#/c/schedule" />,
    );
    await screen.findAllByText(t.scTitle);
    fireEvent.click(screen.getByRole('button', { name: 'Switch app' }));
    fireEvent.click(screen.getByRole('button', { name: 'Profile and mode' }));
    fireEvent.click(await screen.findByText('My workouts'));
    fireEvent.click(screen.getByRole('button', { name: 'Profile and mode' }));
    fireEvent.click(await screen.findByText('Profile'));
    expect(currentHash()).toBe('#/c/schedule');
    expect(screen.getAllByText(t.scTitle).length).toBeGreaterThan(0);
  });
});

describe('ScheduleChatFrame', () => {
  it("posts a request card per id into the client's conversation and puts client-asked ones on the client's side", async () => {
    const make = () => createFixturesSchedulePort();
    render(
      <ScheduleChatFrame
        makePort={make}
        clientId="c1"
        reqIds={['rq1', 'rq2']}
        fromClient={['rq1']}
      />,
    );
    const log = await screen.findByRole('log');
    await waitFor(() =>
      expect(within(log).getAllByText(/Oleh|move|Move|reschedul/i).length).toBeGreaterThan(0),
    );
    // two request cards, one per posted id: the client's own sits on the client's side (them), the other on the trainer's (me)
    await waitFor(() => expect(log.querySelector('#msg-msg-rq2')).not.toBeNull());
    expect(log.querySelector('#msg-msg-rq1')?.className).toContain('uimsg--them');
    expect(log.querySelector('#msg-msg-rq2')?.className).toContain('uimsg--me');
  });

  it('configures the schedule port for the cards', async () => {
    const make = vi.fn(() => createFixturesSchedulePort());
    render(<ScheduleChatFrame makePort={make} clientId="c1" reqIds={[]} />);
    await screen.findByRole('log');
    expect(make).toHaveBeenCalledTimes(1);
  });
});
