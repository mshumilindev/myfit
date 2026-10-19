/** The program editor host: what it saves and sends, how it reports a failed save, who may change the trainer days. */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pgEn as p } from '../../i18n/coachProgram.en';
import { rosterEn as r } from '../../i18n/coachRoster.en';
import { setRole } from '../../api';
import { createFixturesPort } from '../data/__fixtures__/fixtures';
import { configureCoachData } from '../data/config';
import { programPageRoute, type CoachRoute } from '../routes';
import { setViewport } from '../testViewport';
import { configureProgramData } from './config';
import { EditorScreen, type EditorScreenProps } from './EditorScreen';
import { fixtureWorldLite } from './__fixtures__/fixtures';
import { createFixturesProgramPort } from './__fixtures__/programPort';
import type { ProgramPort } from './port';
import { ProgramPortError } from './types';

// c8 (Yulia) has nothing to fix, trains with the trainer on Tuesdays and shares her program with c1 (Oleh)
const CLEAN = 'c8';
const FIXING = 'c1';

function setup(cid = CLEAN, o: Partial<EditorScreenProps> = {}) {
  const base = createFixturesProgramPort({ world: fixtureWorldLite(), warm: true });
  const save = vi.fn(base.saveDraft);
  const send = vi.fn(base.send);
  const copy = vi.fn(base.copyTo);
  const load = vi.fn(base.load);
  const port: ProgramPort = { ...base, saveDraft: save, send, copyTo: copy, load };
  const nav: CoachRoute[] = [];
  configureProgramData({ port });
  const ui = render(
    <EditorScreen cid={cid} from="client" onNavigate={(x) => nav.push(x)} port={port} {...o} />,
  );
  return { port, save, send, copy, load, nav, ui };
}
const toggle = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }));

beforeEach(() => {
  setViewport(1440);
  setRole('trainer');
  configureCoachData({ world: createFixturesPort({ warm: true }) });
});
afterEach(() => {
  cleanup();
  configureCoachData();
  configureProgramData();
  setRole('member');
});

describe('saving the draft', () => {
  it('Save draft is off until something changed; a change shows "Unsaved", Save writes it once and says "Draft saved"', async () => {
    const t = setup();
    const save = await screen.findByRole('button', { name: p.edSaveDraft });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    toggle(/Thursday/);
    await screen.findByText(p.edUnsaved);
    expect((save as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(save);
    await screen.findByText(p.edSaved);
    expect(t.save).toHaveBeenCalledTimes(1);
    const [cid, input] = t.save.mock.calls[0];
    expect(cid).toBe(CLEAN);
    expect(input.trainerDays).toContain('Thu');
    expect(input.trainerDays).toContain('Tue');
    expect((save as HTMLButtonElement).disabled).toBe(true);
  });

  it('turning a day off removes only that day', async () => {
    const t = setup();
    await screen.findByRole('button', { name: p.edSaveDraft });
    toggle(/Tuesday/);
    fireEvent.click(screen.getByRole('button', { name: p.edSaveDraft }));
    await waitFor(() => expect(t.save).toHaveBeenCalledTimes(1));
    expect(t.save.mock.calls[0][1].trainerDays).toEqual([]);
  });

  it.each([
    [new ProgramPortError('offline'), p.edErrOffline],
    [new ProgramPortError('vault-locked'), p.edErrLocked],
    [new ProgramPortError('forbidden'), p.edErrForbidden],
    [new ProgramPortError('unavailable'), p.edErrUnavailable],
  ])('a failed save (%s) keeps the edit and says why; Try again saves again', async (err, text) => {
    const t = setup();
    await screen.findByRole('button', { name: p.edSaveDraft });
    toggle(/Thursday/);
    t.save.mockRejectedValueOnce(err);
    fireEvent.click(screen.getByRole('button', { name: p.edSaveDraft }));
    expect(await screen.findByText(text)).toBeTruthy();
    expect(screen.getByText(p.edUnsaved)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: p.edRetry }));
    await screen.findByText(p.edSaved);
    expect(t.save).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(text)).toBeNull();
  });
});

describe('a save that lost the race', () => {
  async function lose() {
    const t = setup();
    await screen.findByRole('button', { name: p.edSaveDraft });
    toggle(/Thursday/);
    t.save.mockRejectedValueOnce(new ProgramPortError('conflict'));
    fireEvent.click(screen.getByRole('button', { name: p.edSaveDraft }));
    await screen.findByText(p.edConflictTitle + '.', { exact: false });
    return t;
  }

  it('says someone else saved and keeps my edit; "Keep editing" hides the note without touching the draft', async () => {
    const t = await lose();
    expect(screen.getByText(p.edUnsaved)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: p.edConflictKeep }));
    expect(screen.queryByText(p.edConflictTitle + '.', { exact: false })).toBeNull();
    expect(screen.getByText(p.edUnsaved)).toBeTruthy();
    expect(t.load).toHaveBeenCalledTimes(1);
  });

  it('"Load the saved version" drops my edit and takes the server\'s draft', async () => {
    const t = await lose();
    fireEvent.click(screen.getByRole('button', { name: p.edConflictReload }));
    await waitFor(() => expect(t.load).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText(p.edUnsaved)).toBeNull());
    expect(screen.queryByText(p.edConflictTitle + '.', { exact: false })).toBeNull();
    // the Thursday I added is gone again
    expect(screen.getByRole('button', { name: /Thursday/ }).getAttribute('aria-pressed')).not.toBe(
      'true',
    );
  });
});

describe('sending', () => {
  it("Send publishes once; the page says which version went to whom and the notice's button returns to the client's Program tab", async () => {
    const t = setup(CLEAN, { from: 'list' });
    const sendBtn = await screen.findByRole('button', { name: p.edSendTo('Yulia') });
    expect(sendBtn.getAttribute('aria-disabled')).not.toBe('true');
    fireEvent.click(sendBtn);
    await waitFor(() => expect(t.send).toHaveBeenCalledTimes(1));
    expect(t.send.mock.calls[0][0]).toBe(CLEAN);
    expect((await screen.findAllByText(/^v\d+ sent to Yulia$/)).length).toBeGreaterThan(0);
    // opened from the list, yet the notice returns to THIS client's Program tab
    fireEvent.click(screen.getByRole('button', { name: r.roBack }));
    expect(t.nav).toEqual([{ screen: 'client', cid: CLEAN, tab: 'program' }]);
    expect(t.save).not.toHaveBeenCalled();
  });

  it('a failed send says so and Try again sends, not saves', async () => {
    const t = setup();
    const sendBtn = await screen.findByRole('button', { name: p.edSendTo('Yulia') });
    t.send.mockRejectedValueOnce(new ProgramPortError('offline'));
    fireEvent.click(sendBtn);
    expect(await screen.findByText(p.edErrOffline)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: p.edRetry }));
    await waitFor(() => expect(t.send).toHaveBeenCalledTimes(2));
    expect(t.save).not.toHaveBeenCalled();
  });

  it('with items to fix Send is blocked: the gate dialog lists them and opens the check; nothing is sent', async () => {
    const t = setup(FIXING);
    const sendBtn = await screen.findByRole('button', { name: p.edSendTo('Oleh') });
    fireEvent.click(sendBtn);
    const dlg = await screen.findByRole('alertdialog');
    expect(within(dlg).getByText(p.edGateTitle(2))).toBeTruthy();
    fireEvent.click(within(dlg).getByRole('button', { name: p.edGateBack }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    fireEvent.click(await screen.findByRole('button', { name: p.edSendTo('Oleh') }));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: p.edGateOpen }),
    );
    expect(t.nav.at(-1)).toEqual(programPageRoute(FIXING, 'check', 'client'));
    expect(t.send).not.toHaveBeenCalled();
  });

  it('the Check button goes to the check of this client, remembering where the page was opened from', async () => {
    const t = setup(FIXING, { from: 'list' });
    fireEvent.click(await screen.findByRole('button', { name: p.edCheck(2) }));
    expect(t.nav.at(-1)).toEqual(programPageRoute(FIXING, 'check', 'list'));
  });
});

describe('the versions row', () => {
  it('opens the list of changes since the live version and closes it again', async () => {
    setup(FIXING);
    const row = await screen.findByRole('button', { name: p.edVersionRow(5, 1, 4, 'Oleh') });
    expect(row.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(row);
    expect(row.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(row);
    expect(row.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('the program shared with another client', () => {
  it('"Copy" saves nothing new when clean, copies the draft to that client only and confirms with the version', async () => {
    const t = setup();
    const copyBtn = await screen.findByRole('button', { name: /^Copy v\d+ to Oleh$/ });
    fireEvent.click(copyBtn);
    await waitFor(() => expect(t.copy).toHaveBeenCalledTimes(1));
    expect(t.copy).toHaveBeenCalledWith(CLEAN, FIXING);
    expect(await screen.findByText(/^v\d+ copied to Oleh$/)).toBeTruthy();
    expect(t.save).not.toHaveBeenCalled();
  });

  it('the confirmation disappears after four seconds', async () => {
    const timers = vi.spyOn(window, 'setTimeout');
    setup();
    fireEvent.click(await screen.findByRole('button', { name: /^Copy v\d+ to Oleh$/ }));
    await screen.findByText(/^v\d+ copied to Oleh$/);
    const hide = timers.mock.calls.find((c) => c[1] === 4000)![0] as () => void;
    act(() => hide());
    expect(screen.queryByText(/^v\d+ copied to Oleh$/)).toBeNull();
    timers.mockRestore();
  });
});

describe('days marked "with the trainer" that the program no longer trains', () => {
  it('are called out; the fix button clears only those days and Save sends the rest', async () => {
    const base = createFixturesProgramPort({ world: fixtureWorldLite(), warm: true });
    const withStale = (b: Awaited<ReturnType<typeof base.load>>) => ({
      ...b,
      trainerDays: [...b.trainerDays, 'Wed' as const],
    });
    const save = vi.fn(base.saveDraft);
    const port: ProgramPort = {
      ...base,
      saveDraft: save,
      peek: (c) => {
        const b = base.peek(c);
        return b && withStale(b);
      },
      load: async (c, o) => withStale(await base.load(c, o)),
    };
    configureProgramData({ port });
    render(<EditorScreen cid={CLEAN} from="client" onNavigate={() => undefined} port={port} />);
    expect(await screen.findByText(p.edAsgStale('Wed', 'Iryna'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: p.edAsgStaleFix }));
    expect(screen.queryByText(p.edAsgStale('Wed', 'Iryna'))).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: p.edSaveDraft }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][1].trainerDays).toEqual(['Tue']);
  });
});

describe('who may change the days', () => {
  it('a member account sees the days read-only and cannot set times', async () => {
    setRole('member');
    setup();
    await screen.findByRole('button', { name: p.edSaveDraft });
    expect(screen.queryByRole('button', { name: p.edSetTimes })).toBeNull();
    expect(screen.getByText(p.edOnlyTrainer('Yulia'))).toBeTruthy();
  });

  it('a trainer can set times, which opens the schedule', async () => {
    const t = setup();
    fireEvent.click(await screen.findByRole('button', { name: p.edSetTimes }));
    expect(t.nav.at(-1)).toEqual({ screen: 'schedule' });
  });
});

describe('states around the editor', () => {
  it('a client that is not in the roster gets the empty state with a way back to the clients', async () => {
    const t = setup('nobody');
    expect(await screen.findByText(p.edNoClientTitle)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: p.edToClients }));
    expect(t.nav.at(-1)).toEqual({ screen: 'clients' });
    fireEvent.click(screen.getByRole('button', { name: p.edBack }));
    expect(t.nav.at(-1)).toEqual({ screen: 'client', cid: 'nobody', tab: 'program' });
  });

  it('an invited client who has not joined has no editor either', async () => {
    setup('c15');
    expect(await screen.findByText(p.edNoClientTitle)).toBeTruthy();
  });

  it('while the roster loads it is a skeleton, never an empty state', async () => {
    configureCoachData({ world: createFixturesPort({ delayMs: 200 }) });
    const t = setup();
    expect(screen.queryByText(p.edNoClientTitle)).toBeNull();
    expect(t.nav).toEqual([]);
    await screen.findByRole('button', { name: p.edSaveDraft });
  });

  it('a draft that cannot load says so with Try again, which loads again', async () => {
    const base = createFixturesProgramPort({ world: fixtureWorldLite() });
    const load = vi.fn(base.load).mockRejectedValueOnce(new ProgramPortError('offline'));
    const port: ProgramPort = { ...base, load, peek: () => null };
    configureProgramData({ port });
    render(<EditorScreen cid={CLEAN} from="list" onNavigate={() => undefined} port={port} />);
    expect(await screen.findByText(p.edLoadFailedTitle)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: p.edRetry }));
    await screen.findByRole('button', { name: p.edSaveDraft });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('Back from the Programs list goes to the list', async () => {
    const t = setup(CLEAN, { from: 'list' });
    fireEvent.click(await screen.findByRole('button', { name: p.edBack }));
    expect(t.nav.at(-1)).toEqual({ screen: 'programs' });
  });

  it('on a phone the days are summarised in words; on a wide screen there is no such line', async () => {
    setViewport(390);
    setup();
    await screen.findByRole('button', { name: p.edSaveDraft });
    expect(screen.getByText(p.edTdSummary('Iryna', 'Tue', 'Thu, Fri, Sat'))).toBeTruthy();
    cleanup();
    setViewport(1440);
    setup();
    await screen.findByRole('button', { name: p.edSaveDraft });
    expect(screen.queryByText(/Other days are rest/)).toBeNull();
  });
});

describe('landing on an issue from the "Send unlocks when…" list', () => {
  it('every line of the list is a button that either lands on its place in the editor or opens the check; the draft is kept', async () => {
    const t = setup(FIXING);
    const list = await screen.findByRole('list', { name: p.edSendUnlocks });
    const lines = within(list).getAllByRole('button');
    expect(lines).toHaveLength(2);
    for (const line of lines) fireEvent.click(line);
    await screen.findByRole('button', { name: p.edSendTo('Oleh') });
    expect(screen.queryByText(p.edUnsaved)).toBeNull();
    expect(t.send).not.toHaveBeenCalled();
    expect(t.nav.every((x) => x.screen === 'programs')).toBe(true);
  });
});
