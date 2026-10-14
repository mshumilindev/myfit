import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scheduleEn as t } from '../../i18n/coachSchedule.en';
import { createFixturesPort } from '../data/__fixtures__/fixtures';
import { setViewport } from '../testViewport';
import { createFixturesSchedulePort } from './__fixtures__/fixtures';
import { ScheduleScreen } from './ScheduleScreen';

const WORLD = createFixturesPort({ warm: true });
afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '#/c/schedule');
});
beforeEach(() => setViewport(1440));

const open = (hash: string) => {
  window.history.replaceState(null, '', hash);
  const port = createFixturesSchedulePort();
  render(<ScheduleScreen onNavigate={() => undefined} port={port} worldPort={WORLD} />);
  return port;
};

describe('builder', () => {
  it('weekly plan: pick a client and a day, save, then Undo takes it back', async () => {
    open('#/c/schedule?form=plan');
    const form = await screen.findByRole('form', { name: t.bdTitle });
    const chips = within(form).getByRole('group', { name: t.bdPickClients });
    fireEvent.click(within(chips).getAllByRole('button')[0]);
    fireEvent.click(within(form).getByRole('button', { name: 'Saturday' }));
    expect(within(form).getByText(/sessions over 8 weeks/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t.bdSave }));
    const undo = await screen.findByRole('button', { name: t.scUndo });
    expect(screen.queryByRole('form', { name: t.bdTitle })).toBeNull();
    fireEvent.click(undo);
    await waitFor(() => expect(screen.queryByRole('button', { name: t.scUndo })).toBeNull());
  });

  it('a group is named and gets a capacity once three clients are picked', async () => {
    open('#/c/schedule?form=plan');
    const form = await screen.findByRole('form', { name: t.bdTitle });
    const chips = within(form).getByRole('group', { name: t.bdPickClients });
    const buttons = within(chips).getAllByRole('button');
    [0, 1, 2].forEach((i) => fireEvent.click(buttons[i]));
    expect(within(form).getByText(t.bdKindGroup)).toBeTruthy();
    expect(within(form).getByLabelText(new RegExp(t.bdGroupName))).toBeTruthy();
  });

  it('one-off needs a date and says so', async () => {
    open('#/c/schedule?form=oneoff');
    const form = await screen.findByRole('form', { name: t.bdTitle });
    const chips = within(form).getByRole('group', { name: t.bdPickClients });
    fireEvent.click(within(chips).getAllByRole('button')[0]);
    fireEvent.click(screen.getByRole('button', { name: t.bdSave }));
    expect(within(form).getByText(t.bdPickDate, { selector: 'p' })).toBeTruthy();
  });
});

describe('reschedule form', () => {
  it('from a client: lists the next sessions, Send stays disabled until a new time is chosen', async () => {
    open('#/c/schedule?form=pick&client=c1');
    const form = await screen.findByRole('form', { name: t.rfTitle });
    const list = within(form).getByRole('region', { name: t.rfWhichHint });
    const rows = within(list).getAllByRole('button');
    expect(rows.length).toBeGreaterThan(1);
    fireEvent.click(rows[0]);
    expect(await within(form).findByText(t.rfNewTime)).toBeTruthy();
    expect((screen.getByRole('button', { name: t.rfSend }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('a client with no upcoming sessions gets an empty state, not a dead form', async () => {
    open('#/c/schedule?form=pick&client=c13');
    const form = await screen.findByRole('form', { name: t.rfTitle });
    expect(await within(form).findByText(t.rfNoSessions)).toBeTruthy();
  });
});
