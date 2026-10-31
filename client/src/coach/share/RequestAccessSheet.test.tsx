import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clientEn as t } from '../../i18n/coachClient.en';
import { setViewport } from '../testViewport';
import { AccessAskCard } from './AccessAskCard';
import { RequestAccessSheet } from './RequestAccessSheet';

beforeEach(() => setViewport(390));
afterEach(cleanup);

const base = {
  first: 'Oleh',
  shared: { totals: 'full', sleep: 'effects' } as const,
  onSend: vi.fn(),
  onClose: vi.fn(),
};

describe('Request access sheet (SPO-99)', () => {
  it('lists every row the client does not share yet, lists the shared ones apart and sends what is ticked', () => {
    const onSend = vi.fn();
    render(<RequestAccessSheet {...base} onSend={onSend} />);
    // nothing ticked: nothing to send
    const send = screen.getByRole('button', { name: t.raSendNone }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    // 10 rows in total: 2 shared are in "Already shared", 8 can be ticked
    expect(screen.getAllByRole('checkbox')).toHaveLength(8);
    expect(screen.getByText(t.raHave)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    fireEvent.click(screen.getByRole('button', { name: t.raSend(2) }));
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend.mock.calls[0][0]).toHaveLength(2);
  });

  it('"Ask for everything" ticks all open rows, including the four the trainer cannot see', () => {
    const onSend = vi.fn();
    render(<RequestAccessSheet {...base} onSend={onSend} />);
    fireEvent.click(screen.getByRole('button', { name: t.raEverything }));
    fireEvent.click(screen.getByRole('button', { name: t.raSend(8) }));
    expect(onSend.mock.calls[0][0]).toEqual(
      expect.arrayContaining(['conditions', 'nicotine', 'alcohol', 'supplements']),
    );
  });

  it('a client without the app: explained, nothing can be sent', () => {
    const onSend = vi.fn();
    render(<RequestAccessSheet {...base} noApp onSend={onSend} />);
    expect(screen.getByText(t.raNoAppTitle('Oleh'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t.raEverything }));
    expect((screen.getByRole('button', { name: t.raSendNone }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(onSend).not.toHaveBeenCalled();
  });

  it('a pause after a recent ask or a "not now" blocks sending and says until when', () => {
    const until = Date.UTC(2026, 9, 30, 10, 0);
    const { rerender } = render(
      <RequestAccessSheet {...base} pause={{ blocked: true, until, reason: 'recent' }} />,
    );
    expect(screen.getByText(t.raPauseTitle)).toBeTruthy();
    expect((screen.getAllByRole('checkbox')[0] as HTMLInputElement).disabled).toBe(true);
    rerender(<RequestAccessSheet {...base} pause={{ blocked: true, until, reason: 'declined' }} />);
    expect(screen.getByText(/^Not now\./)).toBeTruthy();
  });

  it('no thread yet: says so and does not send', () => {
    render(<RequestAccessSheet {...base} noChat />);
    expect(screen.getByText(t.raNoChat)).toBeTruthy();
  });

  it('opens with the given rows ticked, skipping rows that are already shared', () => {
    render(<RequestAccessSheet {...base} initial={['totals', 'sets']} />);
    expect(screen.getByRole('button', { name: t.raSend(1) })).toBeTruthy();
  });
});

describe('Access ask card (SPO-99)', () => {
  const ask = { reqId: 'access-ask:1', cats: ['sleep', 'body'] as const };
  it('the trainer sees a neutral status and no reasons', () => {
    const { rerender } = render(
      <AccessAskCard
        ask={{ ...ask, cats: [...ask.cats] }}
        status="waiting"
        side="trainer"
        mine
        first="Oleh"
      />,
    );
    expect(screen.getByText(t.raWaiting)).toBeTruthy();
    expect(screen.getByText(t.raNoAnswer('Oleh'))).toBeTruthy();
    rerender(
      <AccessAskCard
        ask={{ ...ask, cats: [...ask.cats] }}
        status="declined"
        side="trainer"
        mine
        first="Oleh"
      />,
    );
    expect(screen.getByText(t.raDeclined)).toBeTruthy();
    expect(screen.getByText(t.raAgainIn7)).toBeTruthy();
    rerender(
      <AccessAskCard
        ask={{ ...ask, cats: [...ask.cats] }}
        status="partial"
        side="trainer"
        mine
        first="Oleh"
      />,
    );
    expect(screen.getByText(t.raPartial)).toBeTruthy();
  });

  it('the client can review a waiting ask, not an answered or expired one', () => {
    const onReview = vi.fn();
    const a = { ...ask, cats: [...ask.cats] };
    const { rerender } = render(
      <AccessAskCard
        ask={a}
        status="waiting"
        side="client"
        mine={false}
        first="Anna"
        onReview={onReview}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: t.raReview }));
    expect(onReview).toHaveBeenCalled();
    rerender(
      <AccessAskCard
        ask={a}
        status="allowed"
        side="client"
        mine={false}
        first="Anna"
        onReview={onReview}
      />,
    );
    expect(screen.queryByRole('button', { name: t.raReview })).toBeNull();
    rerender(
      <AccessAskCard
        ask={a}
        status="expired"
        side="client"
        mine={false}
        first="Anna"
        onReview={onReview}
      />,
    );
    expect(screen.getByText(t.raAskAgain('Anna'))).toBeTruthy();
  });

  it('an ask for all ten rows reads "everything"', () => {
    const all = [
      'totals',
      'sets',
      'body',
      'sleep',
      'nutrition',
      'injury',
      'conditions',
      'nicotine',
      'alcohol',
      'supplements',
    ] as const;
    render(
      <AccessAskCard
        ask={{ reqId: 'access-ask:2', cats: [...all] }}
        status="waiting"
        side="trainer"
        mine
        first="Oleh"
      />,
    );
    expect(screen.getByText(t.raCardAll(10))).toBeTruthy();
  });
});
