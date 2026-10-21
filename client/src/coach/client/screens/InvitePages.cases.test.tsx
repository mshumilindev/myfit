/** The invite pages (#/invite/<token>): nothing is shared before the member says so, every end state explains itself. */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clientEn as cc } from '../../../i18n/coachClient.en';
import { setViewport } from '../../testViewport';
import { ALL_OFF } from '../../domain/consent';
import { createFixturesClientPort } from '../data/__fixtures__/fixtures';
import type { ClientCoachPort } from '../data/port';
import { InvitePages, type InviteExit } from './InvitePages';

beforeEach(() => setViewport(390));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function open(token: string, port: ClientCoachPort = createFixturesClientPort()) {
  const exits: InviteExit[] = [];
  render(<InvitePages token={token} port={port} onExit={(to) => exits.push(to)} />);
  return { port, exits };
}

describe('the landing page', () => {
  it('names the inviter and the organisation and says until when the link lives (fixed date: 14 Oct 2026)', async () => {
    open('ok1');
    expect(await screen.findByText(cc.invTitle('Iryna'))).toBeTruthy();
    expect(screen.getByText(cc.invInviter('Iryna Melnyk'))).toBeTruthy();
    expect(screen.getByText(new RegExp(cc.invInviterAt('Iron Yard, Kyiv')))).toBeTruthy();
    expect(screen.getByText(/Oct 14/)).toBeTruthy();
    const rail = screen.getByRole('progressbar', { name: cc.invStep1Aria });
    expect(rail.getAttribute('aria-valuenow')).toBe('1');
    expect(rail.querySelectorAll('.bar.on')).toHaveLength(1);
    expect(rail.querySelectorAll('.bar')).toHaveLength(2);
  });

  it('Decline is one tap: the port hears it, nothing is linked, and the page says it was declined', async () => {
    const port = createFixturesClientPort();
    const decline = vi.spyOn(port, 'declineInvite');
    const accept = vi.spyOn(port, 'acceptInvite');
    const { exits } = open('ok1', port);
    fireEvent.click(await screen.findByRole('button', { name: cc.invDecline }));
    expect(await screen.findByText(cc.invDeclinedTitle)).toBeTruthy();
    expect(decline).toHaveBeenCalledWith('ok1');
    expect(accept).not.toHaveBeenCalled();
    expect(port.state().link.state).toBe('none');
    fireEvent.click(screen.getByRole('button', { name: cc.invGoToday }));
    expect(exits).toEqual(['today']);
  });

  it('a decline that cannot reach the server falls back to the calm offline page, still linked to nobody', async () => {
    const base = createFixturesClientPort();
    const port: ClientCoachPort = {
      ...base,
      declineInvite: async () => {
        throw new Error('offline');
      },
    };
    open('ok1', port);
    fireEvent.click(await screen.findByRole('button', { name: cc.invDecline }));
    expect(await screen.findByText(cc.invOfflineTitle)).toBeTruthy();
    expect(base.state().link.state).toBe('none');
  });
});

describe('offline', () => {
  it('Try again asks the server once more and lands on the invite when it answers', async () => {
    const base = createFixturesClientPort();
    let up = false;
    const get = vi.fn((token: string) =>
      up ? base.getInvite(token) : Promise.reject(new Error('x')),
    );
    const { exits } = open('ok1', { ...base, getInvite: get });
    expect(await screen.findByText(cc.invOfflineTitle)).toBeTruthy();
    up = true;
    fireEvent.click(screen.getByRole('button', { name: cc.ccRetry }));
    expect(await screen.findByText(cc.invTitle('Iryna'))).toBeTruthy();
    expect(get).toHaveBeenCalledTimes(2);
    expect(exits).toEqual([]);
  });

  it('the offline page has a way out that closes the overlay', async () => {
    const { exits } = open('ok1', createFixturesClientPort({ fail: 'offline' }));
    fireEvent.click(await screen.findByRole('button', { name: cc.invExpContinue }));
    expect(exits).toEqual(['close']);
  });
});

describe('choosing what to share', () => {
  it('the preset decides what is saved: "Everything" sends four Full categories (check-ins are not a setting) and one Effects-only, injuries stay Off', async () => {
    const port = createFixturesClientPort();
    const accept = vi.spyOn(port, 'acceptInvite');
    open('ok1', port);
    fireEvent.click(await screen.findByRole('button', { name: cc.invAccept }));
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(cc.presetAll) }));
    fireEvent.click(screen.getByRole('button', { name: cc.invSave }));
    await waitFor(() => expect(accept).toHaveBeenCalledTimes(1));
    const [token, grants] = accept.mock.calls[0];
    expect(token).toBe('ok1');
    expect(grants).toMatchObject({
      checkins: 'full',
      totals: 'full',
      sets: 'full',
      body: 'full',
      sleep: 'full',
      nutrition: 'effects',
      injury: 'off',
    });
    expect(await screen.findByText(cc.invOkTagFull(4))).toBeTruthy();
    expect(screen.getByText(cc.invOkTagEffects(1))).toBeTruthy();
    expect(screen.getByText(cc.invOkInjuryOff)).toBeTruthy();
  });

  it('"Share nothing for now" links the trainer with every category Off and says so', async () => {
    const port = createFixturesClientPort();
    const accept = vi.spyOn(port, 'acceptInvite');
    open('ok1', port);
    fireEvent.click(await screen.findByRole('button', { name: cc.invAccept }));
    fireEvent.click(await screen.findByRole('button', { name: cc.invNothing }));
    expect(await screen.findByText(cc.invOkTagNone)).toBeTruthy();
    expect(accept.mock.calls[0][1]).toEqual(ALL_OFF);
  });

  it('Back returns to the invite without writing anything', async () => {
    const port = createFixturesClientPort();
    const accept = vi.spyOn(port, 'acceptInvite');
    open('ok1', port);
    fireEvent.click(await screen.findByRole('button', { name: cc.invAccept }));
    expect(await screen.findByText(cc.invShareTitle('Iryna'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: cc.ccBack }));
    expect(await screen.findByText(cc.invTitle('Iryna'))).toBeTruthy();
    expect(accept).not.toHaveBeenCalled();
    expect(port.state().link.state).toBe('none');
  });

  it('a failed save says nothing was shared and can be tried again', async () => {
    const base = createFixturesClientPort();
    let calls = 0;
    const port: ClientCoachPort = {
      ...base,
      acceptInvite: async (token, grants) => {
        calls += 1;
        if (calls === 1) throw new Error('offline');
        return base.acceptInvite(token, grants);
      },
    };
    open('ok1', port);
    fireEvent.click(await screen.findByRole('button', { name: cc.invAccept }));
    fireEvent.click(await screen.findByRole('button', { name: cc.invSave }));
    expect((await screen.findByRole('alert')).textContent).toBe(cc.invSaveFailed);
    expect(base.state().link.state).toBe('none');
    fireEvent.click(screen.getByRole('button', { name: cc.invSave }));
    await waitFor(() => expect(base.state().link.state).toBe('waiting'));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('connected', () => {
  it('while the trainer app has not turned sharing on it says waiting, and the exits go to chat and to the sharing page', async () => {
    const { exits } = open('ok1');
    fireEvent.click(await screen.findByRole('button', { name: cc.invAccept }));
    fireEvent.click(await screen.findByRole('button', { name: cc.invSave }));
    expect(await screen.findByText(cc.invOkTitle('Iryna'))).toBeTruthy();
    expect(screen.getByText(new RegExp(cc.invOkWaiting('Iryna').replace(/'/g, '.')))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: cc.invMessage('Iryna') }));
    fireEvent.click(screen.getByRole('button', { name: cc.invChange }));
    expect(exits).toEqual(['chat', 'sharing']);
  });
});

describe('end states', () => {
  it('an expired invite offers to ask for a new one: the copied text is the request to this trainer', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const port = createFixturesClientPort();
    const accept = vi.spyOn(port, 'acceptInvite');
    const { exits } = open('expired1', port);
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: cc.invExpAsk('Iryna') }));
    expect(await screen.findByText(cc.invAskHint)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: cc.invAskCopy }));
    expect(writeText).toHaveBeenCalledWith(cc.invAskText('Iryna'));
    expect(await screen.findByRole('button', { name: cc.invAskCopied })).toBeTruthy();
    expect(accept).not.toHaveBeenCalled();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByText(cc.invAskHint)).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: cc.invExpContinue }));
    expect(exits).toEqual(['today']);
  });

  it('a used invite changes nothing and offers Today; a declined token shows the declined page', async () => {
    const port = createFixturesClientPort();
    const { exits } = open('used1', port);
    expect(await screen.findByText(cc.invUsedTitle)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: cc.invGoToday }));
    expect(exits).toEqual(['today']);
    expect(port.state().link.state).toBe('none');
    cleanup();
    open('declined1');
    expect(await screen.findByText(cc.invDeclinedTitle)).toBeTruthy();
  });
});
