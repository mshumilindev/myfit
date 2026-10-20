import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFixturesPort } from '../data/__fixtures__/fixtures';
import { setViewport } from '../testViewport';
import { TodayScreen } from './TodayScreen';
import { currentHash } from '../../route';

const OPTS = { refreshEveryMs: 0 };

async function openOlehDecision(port = createFixturesPort()) {
  const onNavigate = vi.fn();
  render(<TodayScreen port={port} worldOptions={OPTS} onNavigate={onNavigate} />);
  await screen.findByRole('heading', { level: 2, name: /Needs a decision/ });
  // phone: the first card is already expanded in place, desktop: select the row first
  const row = screen
    .getAllByRole('button')
    .find((b) => /Oleh Bondar: Bench press/.test(b.getAttribute('aria-label') ?? ''));
  if (row) fireEvent.click(row);
  fireEvent.click(screen.getByRole('button', { name: 'See evidence and options' }));
  await screen.findByRole('radiogroup', { name: 'Options' });
  return { port, onNavigate };
}

beforeEach(() => {
  setViewport(1440);
  window.history.replaceState(null, '', '#/c/agenda');
});
afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '#/c/agenda');
});

describe('Decision screen', () => {
  it('is deep-linkable and has Back "Agenda"', async () => {
    await openOlehDecision();
    expect(currentHash()).toContain('decision=');
    fireEvent.click(screen.getByRole('button', { name: /Agenda/ }));
    expect(currentHash()).not.toContain('decision=');
    expect(await screen.findByRole('heading', { level: 2, name: /Needs a decision/ })).toBeTruthy();
  });

  it('options are radios with the diff as description; Suggested is chosen; Message is never an option or a checkbox', async () => {
    await openOlehDecision();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    const first = radios[0] as HTMLInputElement;
    expect(first.checked).toBe(true);
    expect(screen.getByText('Suggested')).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Options' })).toBeTruthy();
    expect(first.getAttribute('aria-describedby')).toBeTruthy();
    const desc = document.getElementById(first.getAttribute('aria-describedby')!)!;
    expect(desc.textContent).toMatch(/Bench press: 3 to 4 sets\./);
    expect(desc.textContent).toMatch(/Adds 3 × 5 Paused bench press\./);
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('radio', { name: /message/i })).toBeNull();
    // Message to <name> is a row of "What happens next", not a decision option
    const next = screen.getByRole('list', { name: 'What happens next' });
    expect(within(next).getByText('Message to Oleh')).toBeTruthy();
    expect(within(next).getByText(/Hi Oleh, quick question/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Message Oleh' })).toBeTruthy();
  });

  it('what happens next: program, result check with the one threshold, sees', async () => {
    await openOlehDecision();
    const next = screen.getByRole('list', { name: 'What happens next' });
    expect(within(next).getByText('Program')).toBeTruthy();
    expect(
      within(next).getByText(
        /In 14 days\. Counted as improved only if estimated 1RM moves by 2\.5 kg or more\./,
      ),
    ).toBeTruthy();
    expect(within(next).getByText('Oleh sees')).toBeTruthy();
  });

  it('evidence: chart with a text table, locked nutrition with Ask to share, shares line', async () => {
    const { onNavigate } = await openOlehDecision();
    const ev = screen.getByRole('complementary', { name: 'Evidence' });
    expect(within(ev).getByRole('img')).toBeTruthy();
    const table = within(ev).getByRole('table');
    expect(within(table).getAllByRole('row').length).toBeGreaterThanOrEqual(4);
    expect(within(ev).getByText(/Oleh does not share nutrition\./)).toBeTruthy();
    fireEvent.click(within(ev).getByRole('button', { name: 'Ask to share nutrition' }));
    expect(onNavigate).toHaveBeenCalledWith({ screen: 'chat', with: 'c1' });
    expect(
      within(ev).getByText(/Oleh shares: .*Reads are logged and visible to Oleh\./),
    ).toBeTruthy();
    fireEvent.click(within(ev).getByRole('button', { name: "Open Oleh's profile" }));
    expect(onNavigate).toHaveBeenCalledWith({ screen: 'client', cid: 'c1' });
  });

  it('record: encrypted-path write with the evidence snapshot, then the recorded state; the message goes with it', async () => {
    const { port } = await openOlehDecision();
    fireEvent.click(screen.getByRole('button', { name: 'Record decision' }));
    const done = await screen.findByRole('status', { name: 'Decision recorded' });
    expect(done.textContent).toMatch(/Recorded: Add a variation \+ 1 set\. Oleh got a message\./);
    expect(done.textContent).toMatch(/We check the result in 14 days/);
    await waitFor(() => expect(port.saved().decisions.length).toBe(43));
    const rec = port.saved().decisions[0];
    expect(rec).toMatchObject({ kind: 'program', optionId: 'variation', status: 'recorded' });
    expect(rec.message).toMatch(/^Hi Oleh/);
    expect(rec.evidence[0].rows.length).toBeGreaterThan(0);
    // chosen option stays, the other is not clickable any more
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByText('Chosen')).toBeTruthy();
    fireEvent.click(within(done).getByRole('button', { name: /Back to Agenda/ }));
    expect(await screen.findByRole('heading', { level: 2, name: /Keep an eye on/ })).toBeTruthy();
  });

  it('Undo after recording: a real button for 8 s, removes the decision and reopens the options', async () => {
    const { port } = await openOlehDecision();
    fireEvent.click(screen.getByRole('button', { name: 'Record decision' }));
    await screen.findByRole('status', { name: 'Decision recorded' });
    await waitFor(() => expect(port.saved().decisions.length).toBe(43));
    const undo = screen.getByRole('button', { name: 'Undo recording this decision' });
    expect(undo.tagName).toBe('BUTTON');
    fireEvent.click(undo);
    await waitFor(() => expect(port.saved().decisions.length).toBe(42));
    expect(await screen.findByRole('radiogroup', { name: 'Options' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Undo recording this decision' })).toBeNull();
  });

  it('the Undo offer expires after 8 s', async () => {
    await openOlehDecision();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Record decision' }));
      await screen.findByRole('status', { name: 'Decision recorded' });
      expect(screen.getByRole('button', { name: 'Undo recording this decision' })).toBeTruthy();
      await vi.advanceTimersByTimeAsync(8100);
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: 'Undo recording this decision' })).toBeNull(),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('record sends the message the trainer edited', async () => {
    const { port } = await openOlehDecision();
    fireEvent.click(screen.getByRole('button', { name: 'Edit message' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Message to Oleh' }), {
      target: { value: 'Custom text' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Record decision' }));
    await screen.findByRole('status', { name: 'Decision recorded' });
    await waitFor(() => expect(port.saved().decisions[0].message).toBe('Custom text'));
  });

  it('choosing the other option records that one', async () => {
    const { port } = await openOlehDecision();
    fireEvent.click(screen.getAllByRole('radio')[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Record decision' }));
    await screen.findByRole('status', { name: 'Decision recorded' });
    await waitFor(() => expect(port.saved().decisions[0].optionId).toBe('deload'));
  });

  it('wait a week: snoozed state with the date, 7 days fixed', async () => {
    const { port } = await openOlehDecision();
    fireEvent.click(screen.getByRole('button', { name: 'Wait a week' }));
    const s = await screen.findByText('Waiting a week');
    expect(s).toBeTruthy();
    expect(screen.getByText(/We will bring it back on/)).toBeTruthy();
    await waitFor(() => expect(port.saved().decisions[0]).toMatchObject({ kind: 'wait' }));
    const d = port.saved().decisions[0];
    expect(d.windowEndsAt! - d.decidedAt).toBe(7 * 86_400_000);
  });

  it('dismiss: the reason is required (3 chips), confirm stays disabled until one is picked', async () => {
    const { port } = await openOlehDecision();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss signal' }));
    expect(screen.getByText(/Why dismiss this\?/)).toBeTruthy();
    const confirm = screen.getByRole('button', {
      name: 'Dismiss with reason',
    }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    expect(screen.getByText('Pick a reason to dismiss.')).toBeTruthy();
    const chips = screen.getAllByRole('radio').filter((r) => r.tagName === 'BUTTON');
    expect(chips.map((c) => c.textContent)).toEqual([
      'Not useful',
      'Already handled',
      'Wrong data',
    ]);
    fireEvent.click(chips[2]);
    expect(chips[2].getAttribute('aria-checked')).toBe('true');
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    expect(await screen.findByText('Signal dismissed')).toBeTruthy();
    expect(screen.getByText(/Marked as wrong data/)).toBeTruthy();
    await waitFor(() =>
      expect(port.saved().decisions[0]).toMatchObject({ kind: 'dismiss', reason: 'wrong-data' }),
    );
  });

  it('phone: the same screen, actions in the sticky row, no side evidence column', async () => {
    setViewport(390);
    await openOlehDecision();
    expect(screen.getByRole('button', { name: 'Record decision' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Wait a week' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dismiss signal' })).toBeTruthy();
    expect(document.querySelector('.td-actions')).toBeTruthy();
  });

  it('an unknown or already handled signal shows a calm not-found with a way back', async () => {
    window.history.replaceState(null, '', '#/c/agenda?decision=c9%7Cnope');
    render(
      <TodayScreen port={createFixturesPort()} worldOptions={OPTS} onNavigate={() => undefined} />,
    );
    expect(await screen.findByText('This signal is gone')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back to Agenda' }));
    expect(await screen.findByRole('heading', { level: 2, name: /Needs a decision/ })).toBeTruthy();
  });

  it('informational signals (PR) have no program options: Got it acknowledges', async () => {
    const port = createFixturesPort();
    render(<TodayScreen port={port} worldOptions={OPTS} onNavigate={() => undefined} />);
    await screen.findByRole('heading', { level: 2, name: /Needs a decision/ });
    fireEvent.click(screen.getByRole('button', { name: /more in the digest/ }));
    const taras = screen
      .getAllByRole('button')
      .find((b) => /Taras Rudenko/.test(b.textContent ?? ''))!;
    fireEvent.click(taras);
    // desktop: the detail pane opens; go to the decision from there
    fireEvent.click(screen.getByRole('button', { name: 'See evidence and options' }));
    expect(await screen.findByText('Nothing to change in the program.')).toBeTruthy();
    expect(screen.queryByRole('radio')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(await screen.findByText('Signal dismissed')).toBeTruthy();
  });
});
