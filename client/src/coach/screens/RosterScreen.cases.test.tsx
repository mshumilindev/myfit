/** Roster: the actions on invites (withdraw, resend behind the password), sorting and filtering, and who each button opens. */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { c360En as c360 } from '../../i18n/coachClient360.en';
import { rosterEn as r } from '../../i18n/coachRoster.en';
import { safeEn as sf } from '../../i18n/coachSafe.en';
import { createLocalInvitePort, resetCreatedInvites } from '../data/inviteStore';
import { chatRoute } from '../routes';
import { configureReauth, forgetReauth, markReauthed } from '../security/reauth';
import { createFixturesReauthPort } from '../security/__fixtures__/reauth';
import { setViewport } from '../testViewport';
import { RosterScreen } from './RosterScreen';
import { emptyRoster, withInvites, worldPort } from './storyPorts';

beforeEach(() => {
  setViewport(1440);
  forgetReauth();
  configureReauth(createFixturesReauthPort({ accept: 'secret' }));
});
afterEach(() => {
  cleanup();
  resetCreatedInvites();
  configureReauth(null);
  forgetReauth();
  vi.restoreAllMocks();
});

function mount(over: Partial<Parameters<typeof RosterScreen>[0]> = {}) {
  const onNavigate = vi.fn();
  const invitePort = createLocalInvitePort();
  const revoke = vi.spyOn(invitePort, 'revoke');
  const create = vi.spyOn(invitePort, 'create');
  render(
    <RosterScreen
      onNavigate={onNavigate}
      port={worldPort(withInvites)}
      invitePort={invitePort}
      unreadByClient={{}}
      {...over}
    />,
  );
  return { onNavigate, invitePort, revoke, create };
}
const rows = () => within(screen.getByRole('list', { name: r.roListLabel })).getAllByRole('button');
const answer = async (pw: string) => {
  fireEvent.change(await screen.findByLabelText(/Password/), { target: { value: pw } });
  fireEvent.click(screen.getByRole('button', { name: sf.raConfirm }));
};

describe('withdrawing an invite', () => {
  it('asks first and says what it does; Cancel leaves the invite and revokes nothing', async () => {
    const { revoke } = mount();
    fireEvent.click(
      await screen.findByRole('button', { name: sf.invWithdrawFor('Olena Marchenko') }),
    );
    const dlg = await screen.findByRole('alertdialog');
    expect(within(dlg).getByText(sf.invWithdrawTitle('Olena'))).toBeTruthy();
    expect(within(dlg).getByText(sf.invWithdrawEffect)).toBeTruthy();
    fireEvent.click(within(dlg).getByRole('button', { name: sf.raCancel }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(revoke).not.toHaveBeenCalled();
    expect(screen.getByText('Olena Marchenko')).toBeTruthy();
  });

  it('confirming needs the password: a wrong one revokes nothing, the right one revokes exactly that invite', async () => {
    const { revoke } = mount();
    fireEvent.click(
      await screen.findByRole('button', { name: sf.invWithdrawFor('Olena Marchenko') }),
    );
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: sf.invWithdrawConfirm,
      }),
    );
    await answer('wrong');
    await new Promise((res) => setTimeout(res, 30));
    expect(revoke).not.toHaveBeenCalled();
    await answer('secret');
    await waitFor(() => expect(revoke).toHaveBeenCalledTimes(1));
    expect(revoke).toHaveBeenCalledWith('inv1');
  });

  it('a revoke that fails says so and can be dismissed', async () => {
    const { revoke } = mount();
    revoke.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(
      await screen.findByRole('button', { name: sf.invWithdrawFor('Olena Marchenko') }),
    );
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: sf.invWithdrawConfirm,
      }),
    );
    await answer('secret');
    expect(await screen.findByText(sf.invWithdrawFailed)).toBeTruthy();
    const note = screen.getByText(sf.invWithdrawFailed).closest('[class*="notice"]') as HTMLElement;
    fireEvent.click(within(note.parentElement!).getByRole('button', { name: sf.raCancel }));
    expect(screen.queryByText(sf.invWithdrawFailed)).toBeNull();
  });
});

describe('backing out of the password', () => {
  it('cancelling the password prompt stops a withdraw, a resend and an export: nothing changes', async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const { revoke, create } = mount();
    const cancelPrompt = async () => {
      await screen.findByLabelText(/Password/);
      fireEvent.click(
        within(
          screen.getByLabelText(/Password/).closest('[role="alertdialog"]') as HTMLElement,
        ).getByRole('button', { name: sf.raCancel }),
      );
      await waitFor(() => expect(screen.queryByLabelText(/Password/)).toBeNull());
    };
    fireEvent.click(
      await screen.findByRole('button', { name: sf.invWithdrawFor('Olena Marchenko') }),
    );
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: sf.invWithdrawConfirm,
      }),
    );
    await cancelPrompt();
    fireEvent.click(screen.getByRole('button', { name: sf.invResendFor('Olena Marchenko') }));
    await cancelPrompt();
    fireEvent.click(screen.getByRole('button', { name: r.roExport }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: /./ })).getByRole('button', {
        name: c360.exSubmit,
      }),
    );
    await cancelPrompt();
    expect(revoke).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
    expect(screen.getByText('Olena Marchenko')).toBeTruthy();
  });
});

describe('sending a new invite', () => {
  it('needs the password, withdraws the old link, creates a fresh one for the same person and offers to copy it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { revoke, create } = mount();
    fireEvent.click(
      await screen.findByRole('button', { name: sf.invResendFor('Olena Marchenko') }),
    );
    await answer('wrong');
    await new Promise((res) => setTimeout(res, 30));
    expect(revoke).not.toHaveBeenCalled();
    await answer('secret');
    expect(await screen.findByText(sf.invResendDone('Olena'))).toBeTruthy();
    expect(revoke).toHaveBeenCalledWith('inv1');
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({ name: 'Olena Marchenko', mode: 'app' });
    fireEvent.click(screen.getByRole('button', { name: sf.invCopyLink }));
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/#\/invite\/[A-Za-z0-9_-]+$/));
  });

  it('when the new invite cannot be created it says so, and Cancel on the note dismisses it', async () => {
    const { create } = mount();
    create.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(
      await screen.findByRole('button', { name: sf.invResendFor('Olena Marchenko') }),
    );
    await answer('secret');
    expect(await screen.findByText(sf.invResendFailed)).toBeTruthy();
    const note = screen.getByText(sf.invResendFailed).closest('[class*="notice"]') as HTMLElement;
    fireEvent.click(within(note.parentElement!).getByRole('button', { name: sf.raCancel }));
    expect(screen.queryByText(sf.invResendFailed)).toBeNull();
  });
});

describe('sorting and filtering', () => {
  it('sorting by name is alphabetical; the choice does not change who is listed', async () => {
    mount();
    await screen.findByText(r.roSubtitle(14, 4));
    fireEvent.click(screen.getByRole('button', { name: r.roFilters }));
    fireEvent.change(screen.getByLabelText(r.roSortLabel), { target: { value: 'name' } });
    const names = rows().map((b) => b.textContent ?? '');
    expect(names).toHaveLength(14);
    expect(names[0]).toContain('Andriy Lysenko');
    const first = names.map((n) => n.match(/[A-Z][a-z]+ [A-Z][a-z]+/)?.[0] ?? '');
    expect(first).toEqual([...first].sort((a, b) => a.localeCompare(b)));
  });

  it('a filter that leaves nobody says so and "Clear filters" restores all 14 and the "All" view', async () => {
    mount();
    await screen.findByText(r.roSubtitle(14, 4));
    fireEvent.click(screen.getByRole('button', { name: r.roAttn(4) }));
    fireEvent.click(screen.getByRole('button', { name: r.roFilters }));
    fireEvent.change(screen.getByLabelText(r.roProgramLabel), { target: { value: 'Hybrid 4x' } });
    fireEvent.change(screen.getByRole('searchbox', { name: r.roSearch }), {
      target: { value: 'zzz' },
    });
    expect(screen.getByText(r.roNoMatch('zzz'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: r.roClearFilters }));
    expect(rows()).toHaveLength(14);
    expect((screen.getByLabelText(r.roProgramLabel) as HTMLSelectElement).value).toBe('all');
  });

  it('the program filter lists only programs that exist, and narrows to exactly their clients', async () => {
    mount();
    await screen.findByText(r.roSubtitle(14, 4));
    fireEvent.click(screen.getByRole('button', { name: r.roFilters }));
    const program = screen.getByLabelText(r.roProgramLabel) as HTMLSelectElement;
    expect([...program.options].map((o) => o.value)).toEqual([
      'all',
      'Core & Return 3x',
      'Full Body 2x',
      'Full Body 3x',
      'Glute Focus 3x',
      'Hybrid 4x',
      'Knee Return 3x',
      'Peaking 4x',
      'Pull/Push/Legs 5x',
      'Rehab Upper 3x',
      'Strength Base 3x',
      'Upper/Lower 4x',
    ]);
    fireEvent.change(program, { target: { value: 'Full Body 3x' } });
    expect(rows()).toHaveLength(2);
  });

  it('"Needs attention" shows exactly the counted clients and All brings the rest back', async () => {
    mount();
    await screen.findByText(r.roSubtitle(14, 4));
    fireEvent.click(screen.getByRole('button', { name: r.roAttn(4) }));
    expect(rows()).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: r.roAll(14) }));
    expect(rows()).toHaveLength(14);
  });
});

describe('who each button opens', () => {
  it("the detail card's Message opens the thread of the SELECTED client, not the first one", async () => {
    const { onNavigate } = mount();
    await screen.findByText(r.roSubtitle(14, 4));
    fireEvent.click(
      within(screen.getByRole('list', { name: r.roListLabel })).getByRole('button', {
        name: /Maria Tkach/,
      }),
    );
    const detail = screen.getByRole('region', { name: 'Maria Tkach' });
    fireEvent.click(within(detail).getByRole('button', { name: r.roMessage }));
    expect(onNavigate).toHaveBeenLastCalledWith(chatRoute('c2'));
  });

  it('the Invite button opens and closes the panel on a wide screen; on a phone it opens above the list', async () => {
    mount();
    await screen.findByText(r.roSubtitle(14, 4));
    const btn = screen.getByRole('button', { name: r.roInvite });
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('heading', { name: r.ivTitle })).toBeTruthy();
    fireEvent.click(btn);
    expect(screen.queryByRole('heading', { name: r.ivTitle })).toBeNull();
  });
});

describe('after an invite is created', () => {
  async function invited() {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const m = mount();
    await screen.findByText(r.roSubtitle(14, 4));
    fireEvent.click(screen.getByRole('button', { name: r.roInvite }));
    fireEvent.change(screen.getByLabelText(new RegExp('^' + r.ivName)), {
      target: { value: 'Pavlo Hrytsenko' },
    });
    fireEvent.click(screen.getByRole('button', { name: r.ivSubmitApp }));
    await screen.findByText(r.ivSentApp);
    return { ...m, writeText };
  }

  it('"Send in chat" copies that invite link and opens the chat', async () => {
    const { onNavigate, writeText } = await invited();
    const link = (screen.getByLabelText(r.ivLink) as HTMLInputElement).value;
    fireEvent.click(screen.getByRole('button', { name: r.ivSendInChat }));
    expect(writeText).toHaveBeenCalledWith(link);
    expect(onNavigate).toHaveBeenLastCalledWith({ screen: 'chat' });
  });

  it('"Send in chat" still opens the chat when the clipboard refuses', async () => {
    const { onNavigate, writeText } = await invited();
    writeText.mockRejectedValueOnce(new Error('denied'));
    fireEvent.click(screen.getByRole('button', { name: r.ivSendInChat }));
    expect(onNavigate).toHaveBeenLastCalledWith({ screen: 'chat' });
  });

  it('a program-only client has no link, so "Open profile" is offered and opens that client', async () => {
    const { onNavigate } = mount();
    await screen.findByText(r.roSubtitle(14, 4));
    fireEvent.click(screen.getByRole('button', { name: r.roInvite }));
    fireEvent.click(
      within(screen.getByRole('group', { name: r.ivModeGroup })).getByRole('button', {
        name: r.ivProgram,
      }),
    );
    fireEvent.change(screen.getByLabelText(new RegExp('^' + r.ivName)), {
      target: { value: 'Dmytro Kovalenko' },
    });
    fireEvent.click(screen.getByRole('button', { name: r.ivSubmitProgram }));
    await screen.findByText(r.ivSentProgram);
    fireEvent.click(screen.getByRole('button', { name: r.ivOpenProfile }));
    expect(onNavigate).toHaveBeenLastCalledWith({ screen: 'client', cid: expect.any(String) });
  });
});

describe('on a phone', () => {
  it('the header Invite button opens the panel above the list', async () => {
    setViewport(390);
    mount();
    await screen.findByText(r.roSubtitle(14, 4));
    const btn = screen.getByRole('button', { name: r.roInviteShort });
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('heading', { name: r.ivTitle })).toBeTruthy();
  });
});

describe('the story bubbles', () => {
  it('a bubble opens that client', async () => {
    const { onNavigate } = mount();
    await screen.findByText(r.roSubtitle(14, 4));
    fireEvent.click(screen.getAllByRole('button', { name: /Oleh Bondar, / })[0]);
    expect(onNavigate).toHaveBeenLastCalledWith({ screen: 'client', cid: 'c1' });
  });

  it('the "+N" bubble shows everyone again: it clears the search and the attention view', async () => {
    // jsdom has no layout: give the strip a width that holds five bubbles of 70px
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.classList.contains('ro-strip') ? 400 : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      () => ({ width: 70 }) as DOMRect,
    );
    mount();
    await screen.findByText(r.roSubtitle(14, 4));
    fireEvent.click(screen.getByRole('button', { name: r.roAttn(4) }));
    const more = screen.queryByRole('button', { name: new RegExp(r.roStoryAll + ' \\(\\+') });
    expect(more).not.toBeNull();
    fireEvent.click(more!);
    expect(rows()).toHaveLength(14);
  });
});

describe('export asks for the password', () => {
  it('a wrong password downloads nothing', async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    mount();
    await screen.findByText(r.roSubtitle(14, 4));
    fireEvent.click(screen.getByRole('button', { name: r.roExport }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: /./ })).getByRole('button', {
        name: c360.exSubmit,
      }),
    );
    await answer('nope');
    await new Promise((res) => setTimeout(res, 30));
    expect(click).not.toHaveBeenCalled();
  });

  it('with a filter on, "All rows" exports every client and not just the filtered ones', async () => {
    let blob: Blob | null = null;
    Object.assign(URL, {
      createObjectURL: (b: Blob) => ((blob = b), 'blob:x'),
      revokeObjectURL: () => undefined,
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    markReauthed();
    mount();
    await screen.findByText(r.roSubtitle(14, 4));
    fireEvent.change(screen.getByRole('searchbox', { name: r.roSearch }), {
      target: { value: 'glute' },
    });
    expect(rows()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: r.roExport }));
    const dlg = screen.getByRole('dialog', { name: /./ });
    fireEvent.click(within(dlg).getByRole('radio', { name: new RegExp(c360.exAllRows) }));
    fireEvent.click(within(dlg).getByRole('button', { name: c360.exSubmit }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    const lines = (await (blob as unknown as Blob).text()).replace('\ufeff', '').split('\r\n');
    expect(lines).toHaveLength(1 + 14);
  });
});

describe('when the invite-first card replaces the roster', () => {
  it('a roster with clients and no pending invite is a list, never the empty card', async () => {
    mount({ port: worldPort() });
    expect(await screen.findByRole('list', { name: r.roListLabel })).toBeTruthy();
    expect(rows().length).toBe(14);
    expect(screen.queryByRole('heading', { name: r.roEmptyH })).toBeNull();
  });

  it('a roster whose only entry is a pending invite is still a roster, not the empty card', async () => {
    mount({ port: worldPort((w) => withInvites(emptyRoster(w))) });
    expect(await screen.findByText('Olena Marchenko')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: r.roEmptyH })).toBeNull();
  });

  it('nobody at all shows the empty card', async () => {
    mount({ port: worldPort(emptyRoster) });
    expect(await screen.findByRole('heading', { name: r.roEmptyH })).toBeTruthy();
  });
});
