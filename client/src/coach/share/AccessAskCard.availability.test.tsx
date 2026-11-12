import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientEn as cc } from '../../i18n/coachClient.en';
import { en } from '../../i18n/en';
import { AccessAskCard } from './AccessAskCard';
import type { AskStatus } from './accessAsk';

afterEach(cleanup);
const ask = { reqId: 'access-ask:1', cats: ['availability' as const] };
const card = (status: AskStatus, side: 'trainer' | 'client', onReview = vi.fn()) =>
  render(
    <AccessAskCard
      ask={ask}
      status={status}
      side={side}
      mine={side === 'trainer'}
      first="Oleh"
      onReview={onReview}
    />,
  );

describe('access request card for Availability', () => {
  it('trainer, waiting: names Availability, "has not answered", no Review button', () => {
    card('waiting', 'trainer');
    expect(screen.getByText(en.avlTitle)).toBeTruthy();
    expect(screen.getByText(cc.raNoAnswer('Oleh'))).toBeTruthy();
    expect(screen.queryByRole('button', { name: cc.raReview })).toBeNull();
  });
  it('client, waiting: Review opens the form', () => {
    const onReview = vi.fn();
    card('waiting', 'client', onReview);
    expect(screen.getByText(cc.raCardTheirs('Oleh'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: cc.raReview }));
    expect(onReview).toHaveBeenCalledTimes(1);
  });
  it.each(['allowed', 'declined', 'expired'] as const)(
    'client, %s: no Review button, neutral status only',
    (s) => {
      card(s, 'client');
      expect(screen.queryByRole('button', { name: cc.raReview })).toBeNull();
    },
  );
  it('trainer, declined: the 7-day note, and nothing says why', () => {
    card('declined', 'trainer');
    expect(screen.getByText(cc.raAgainIn7)).toBeTruthy();
  });
});
