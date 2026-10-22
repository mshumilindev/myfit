import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clientEn as t } from '../../../i18n/coachClient.en';
import { safeEn as sf } from '../../../i18n/coachSafe.en';
import { catTitle } from '../labels';
import { MyTrainerPage } from './MyTrainerPage';
import type { ClientCoachPort } from '../data/port';
import { setViewport } from '../../testViewport';
import { createFixturesClientPort } from '../data/__fixtures__/fixtures';
import { InvitePages } from './InvitePages';
import { TrainerSharing } from './TrainerSharing';
import { AccessLogPage } from './AccessLogPage';
import {
  __getStateForTests,
  setAlcoholSharing,
  setConditionsShare,
  setNicotineSharing,
  setSupplementSharing,
} from '../../../store';
import { resetHealthGateForTests, withdrawHealthLocally } from '../../../data/healthConsentGate';
import type { ClientSnapshot } from '../data/types';

beforeEach(() => setViewport(390));
afterEach(cleanup);

describe('invite pages', () => {
  it('landing -> share -> connected; nothing is written before Save', async () => {
    const port = createFixturesClientPort();
    const onExit = vi.fn();
    render(<InvitePages token="ok1" port={port} onExit={onExit} />);
    fireEvent.click(await screen.findByRole('button', { name: t.invAccept }));
    expect(port.state().link.state).toBe('none');
    fireEvent.click(await screen.findByRole('button', { name: t.invSave }));
    await waitFor(() => expect(port.state().link.state).toBe('waiting'));
    fireEvent.click(await screen.findByRole('button', { name: t.invGoToday }));
    expect(onExit).toHaveBeenCalledWith('today');
  });

  it('Share nothing for now saves everything Off', async () => {
    const port = createFixturesClientPort();
    render(<InvitePages token="ok2" port={port} onExit={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: t.invAccept }));
    fireEvent.click(await screen.findByRole('button', { name: t.invNothing }));
    await waitFor(() => expect(port.state().link.state).toBe('waiting'));
    expect(Object.values(port.state().link.grants).every((l) => l === 'off')).toBe(true);
  });

  it('expired and used invites explain themselves and share nothing', async () => {
    const port = createFixturesClientPort();
    render(<InvitePages token="expired1" port={port} onExit={() => undefined} />);
    expect(await screen.findByText(t.invExpTitle)).toBeTruthy();
    cleanup();
    render(<InvitePages token="used1" port={port} onExit={() => undefined} />);
    expect(await screen.findByText(t.invUsedTitle)).toBeTruthy();
    expect(port.state().link.state).toBe('none');
  });

  it('offline shows a calm retry page', async () => {
    const port = createFixturesClientPort({ fail: 'offline' });
    render(<InvitePages token="ok3" port={port} onExit={() => undefined} />);
    expect(await screen.findByText(t.invOfflineTitle)).toBeTruthy();
    expect(screen.getByRole('button', { name: t.ccRetry })).toBeTruthy();
  });
});

describe('the one sharing list', () => {
  const rowBtn = (title: string) => screen.findByRole('button', { name: new RegExp(`^${title},`) });
  const allLocalOff = () => {
    setConditionsShare('off');
    setNicotineSharing('off');
    setAlcoholSharing('off');
    setSupplementSharing('off');
  };
  beforeEach(allLocalOff);
  afterEach(allLocalOff);

  it('without a trainer: no trainer block, no grant rows, no Stop sharing; the on-device settings stay', async () => {
    const port = createFixturesClientPort({ scenario: 'none' });
    render(<TrainerSharing port={port} force />);
    await rowBtn('Alcohol');
    expect(screen.queryByText(t.shYourTrainer)).toBeNull();
    expect(screen.queryByRole('button', { name: /Workout totals/ })).toBeNull();
    expect(screen.queryByText(t.shStop('Iryna'))).toBeNull();
    expect(screen.getByText(t.shGroupLife)).toBeTruthy();
    expect(screen.queryByText(t.shGroupTraining)).toBeNull();
  });

  it('with a trainer: three groups hold all ten rows, one summary, Stop sharing is a red row', async () => {
    const port = createFixturesClientPort({ scenario: 'active' });
    const { container } = render(
      <TrainerSharing
        port={port}
        force
        onOpenLog={() => undefined}
        onOpenTrainer={() => undefined}
      />,
    );
    await rowBtn('Workout totals');
    const heads = [...container.querySelectorAll('.uigl-h')].map((e) => e.textContent);
    expect(heads).toEqual([
      t.shYourTrainer,
      t.shGroupTraining,
      t.shGroupBody,
      t.shGroupLife,
      t.shMore,
    ]);
    const rows = [...container.querySelectorAll('button.uirow:not(.uirow--action)')];
    // trainer row + ten settings + Log
    expect(rows).toHaveLength(12);
    expect(container.querySelectorAll('.uicard')).toHaveLength(1);
    expect(screen.queryByText(/have their own settings below/)).toBeNull();
    expect(screen.getByRole('button', { name: t.shStop('Iryna') }).className).toContain(
      'uirow--action',
    );
  });

  it('the summary counts the on-device settings too: only health shared is not "sees nothing"', async () => {
    setConditionsShare('effects');
    const port = createFixturesClientPort({ scenario: 'revoked' });
    render(<TrainerSharing port={port} force />);
    await rowBtn('Long-term conditions');
    expect(screen.queryByText(t.shNothing('Iryna'))).toBeNull();
    expect(screen.getByText(/Effects only:/)).toBeTruthy();
    // nothing of the six grants, but the person still shares one setting, so Stop sharing stays offered
    expect(screen.getByRole('button', { name: t.shStop('Iryna') })).toBeTruthy();
  });

  it('Stop sharing: two steps, zeroes all ten (six grants and four local levels), Undo restores both', async () => {
    setConditionsShare('full');
    setNicotineSharing('effects');
    setAlcoholSharing('effects');
    setSupplementSharing('full');
    const port = createFixturesClientPort({ scenario: 'active' });
    render(<TrainerSharing port={port} force />);
    fireEvent.click(await screen.findByRole('button', { name: t.shStop('Iryna') }));
    // step 1 explains; the red action is not done yet
    expect(screen.getByText(t.shStepOf(1, 2))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t.shContinue }));
    expect(port.state().link.state).toBe('active');
    expect(screen.getByText(t.shStepOf(2, 2))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t.shStopConfirm }));
    await waitFor(() => expect(port.state().link.state).toBe('revoked'));
    expect(Object.values(port.state().link.grants).every((l) => l === 'off')).toBe(true);
    const st = __getStateForTests();
    expect(st.conditionsShare).toBe('off');
    expect(st.nicotine.settings.sharing).toBe('off');
    expect(st.alcohol.settings.sharing).toBe('off');
    expect(st.supplements.settings.sharing).toBe('off');
    expect(await screen.findByText(t.shNothing('Iryna'))).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: t.ccUndo }));
    await waitFor(() => expect(port.state().link.state).toBe('active'));
    const back = __getStateForTests();
    expect(back.conditionsShare).toBe('full');
    expect(back.nicotine.settings.sharing).toBe('effects');
    expect(back.alcohol.settings.sharing).toBe('effects');
    expect(back.supplements.settings.sharing).toBe('full');
  });

  const stopAndConfirm = async () => {
    fireEvent.click(await screen.findByRole('button', { name: t.shStop('Iryna') }));
    fireEvent.click(screen.getByRole('button', { name: t.shContinue }));
    fireEvent.click(screen.getByRole('button', { name: t.shStopConfirm }));
  };

  it('Stop sharing zeroes the RAW level of a feature whose consent is off; a later grant does not bring it back', async () => {
    setNicotineSharing('full');
    setConditionsShare('effects');
    withdrawHealthLocally('nicotine'); // consent off: the setters now refuse, the stored Full is still there
    setNicotineSharing('effects');
    expect(__getStateForTests().nicotine.settings.sharing).toBe('full');
    try {
      const port = createFixturesClientPort({ scenario: 'active' });
      render(<TrainerSharing port={port} force />);
      await stopAndConfirm();
      await waitFor(() => expect(port.state().link.state).toBe('revoked'));
      expect(__getStateForTests().nicotine.settings.sharing).toBe('off');
      expect(__getStateForTests().conditionsShare).toBe('off');
    } finally {
      resetHealthGateForTests(true); // consent granted again
    }
    expect(__getStateForTests().nicotine.settings.sharing).toBe('off');
  });

  it('B2: a grant whose feature consent is off is still shared for real: summary and Stop say so, the row says "shared, feature off", and it is switched off by itself', async () => {
    const port = createFixturesClientPort({ scenario: 'active' });
    for (const c of ['totals', 'sets', 'body', 'sleep', 'nutrition'] as const)
      await port.setLevel(c, 'off');
    await port.setLevel('injury', 'effects');
    const real = port.setLevel.bind(port);
    port.setLevel = () => Promise.reject(new Error('offline')); // the automatic switch-off cannot land yet
    withdrawHealthLocally('injuries');
    try {
      render(<TrainerSharing port={port} force />);
      expect(await screen.findByText(t.shSharedFeatureOff)).toBeTruthy();
      expect(screen.queryByText(t.shNothing('Iryna'))).toBeNull();
      expect(screen.getByRole('button', { name: t.shStop('Iryna') })).toBeTruthy();
      // reachable again: the one tap switches the real grant off
      port.setLevel = real;
      fireEvent.click(await rowBtn(catTitle(t, 'injury')));
      await waitFor(() => expect(port.state().link.grants.injury).toBe('off'));
    } finally {
      resetHealthGateForTests(true);
    }
  });

  it('B2: on mount a grant above Off behind a feature without consent is reconciled to Off', async () => {
    const port = createFixturesClientPort({ scenario: 'active' });
    await port.setLevel('nutrition', 'full');
    withdrawHealthLocally('nutrition');
    try {
      render(<TrainerSharing port={port} force />);
      await waitFor(() => expect(port.state().link.grants.nutrition).toBe('off'));
    } finally {
      resetHealthGateForTests(true);
    }
  });

  it('B4: a failed revoke says so, and the Snackbar Retry runs the revoke again (then Undo is offered)', async () => {
    const port = createFixturesClientPort({ scenario: 'active' });
    const real = port.revoke.bind(port);
    port.revoke = () => Promise.reject(new Error('offline'));
    render(<TrainerSharing port={port} force />);
    await stopAndConfirm();
    fireEvent.click(await screen.findByRole('button', { name: t.ccRetry }));
    expect(port.state().link.state).toBe('active'); // the retry has not been answered yet
    port.revoke = real;
    fireEvent.click(await screen.findByRole('button', { name: t.ccRetry }));
    await waitFor(() => expect(port.state().link.state).toBe('revoked'));
    expect(await screen.findByRole('button', { name: t.ccUndo })).toBeTruthy();
  });

  it('Undo survives the Stop screen unmounting and mounting again inside the window', async () => {
    setConditionsShare('full');
    setSupplementSharing('effects');
    const port = createFixturesClientPort({ scenario: 'active' });
    const first = render(<TrainerSharing port={port} force />);
    await stopAndConfirm();
    await waitFor(() => expect(port.state().link.state).toBe('revoked'));
    await waitFor(() => expect(__getStateForTests().conditionsShare).toBe('off'));
    first.unmount();
    render(<TrainerSharing port={port} force />);
    fireEvent.click(await screen.findByRole('button', { name: t.ccUndo }));
    await waitFor(() => expect(port.state().link.state).toBe('active'));
    expect(__getStateForTests().conditionsShare).toBe('full');
    expect(__getStateForTests().supplements.settings.sharing).toBe('effects');
  });

  it('Undo restores only what consent allows now: a feature switched off meanwhile stays off', async () => {
    setConditionsShare('full');
    setSupplementSharing('effects');
    const port = createFixturesClientPort({ scenario: 'active' });
    render(<TrainerSharing port={port} force />);
    await stopAndConfirm();
    await waitFor(() => expect(port.state().link.state).toBe('revoked'));
    try {
      withdrawHealthLocally('supplements');
      fireEvent.click(await screen.findByRole('button', { name: t.ccUndo }));
      await waitFor(() => expect(port.state().link.state).toBe('active'));
      expect(__getStateForTests().conditionsShare).toBe('full');
      expect(__getStateForTests().supplements.settings.sharing).toBe('off');
    } finally {
      resetHealthGateForTests(true);
    }
  });

  it('Keep sharing closes the dialog and changes nothing', async () => {
    setNicotineSharing('effects');
    const port = createFixturesClientPort({ scenario: 'active' });
    render(<TrainerSharing port={port} force />);
    fireEvent.click(await screen.findByRole('button', { name: t.shStop('Iryna') }));
    fireEvent.click(screen.getByRole('button', { name: t.shKeep }));
    expect(screen.queryByText(t.shStepOf(1, 2))).toBeNull();
    expect(port.state().link.state).toBe('active');
    expect(__getStateForTests().nicotine.settings.sharing).toBe('effects');
  });

  it('a grant row opens the sheet with three levels; Alcohol opens it with two and the reason', async () => {
    const port = createFixturesClientPort({ scenario: 'active' });
    render(<TrainerSharing port={port} force />);
    fireEvent.click(await rowBtn('Sleep'));
    const group = screen.getByRole('group', { name: t.lvSheetLabel });
    expect(group.querySelectorAll('button')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: t.ccDone }));
    fireEvent.click(await rowBtn('Alcohol'));
    expect(
      screen.getByRole('group', { name: t.lvSheetLabel }).querySelectorAll('button'),
    ).toHaveLength(2);
    expect(screen.getByText(t.shFullNotOffered('Alcohol'))).toBeTruthy();
  });

  it('waiting says the trainer app has to turn sharing on', async () => {
    const port = createFixturesClientPort({ scenario: 'waiting' });
    render(<TrainerSharing port={port} force />);
    expect(await screen.findByText(t.shWaitingNote('Iryna'))).toBeTruthy();
  });
});

describe('access log', () => {
  it('lists what the trainer opened', async () => {
    const port = createFixturesClientPort({ scenario: 'active' });
    render(<AccessLogPage port={port} onBack={() => undefined} />);
    expect(await screen.findByText(t.lgTitle)).toBeTruthy();
    expect((await screen.findAllByText(t.lgSummary)).length).toBeGreaterThan(0);
  });
  it('a failing load says so with Try again', async () => {
    const port = createFixturesClientPort({ scenario: 'active' });
    port.accessLog = () => Promise.reject(new Error('x'));
    render(<AccessLogPage port={port} onBack={() => undefined} />);
    expect(await screen.findByText(t.lgFailed)).toBeTruthy();
  });
});

describe('My trainer page states (audit C-01: no eternal skeleton)', () => {
  const noop = () => undefined;
  const page = (port: ClientCoachPort) =>
    render(
      <MyTrainerPage
        port={port}
        onBack={noop}
        onChat={noop}
        onSharing={noop}
        onProgram={noop}
        onLeft={noop}
      />,
    );
  it('a legacy trainer adopted into the new model: a clear note, nothing shared yet, and a way to choose', async () => {
    const onSharing = vi.fn();
    render(
      <MyTrainerPage
        port={createFixturesClientPort({ scenario: 'migrated' })}
        onBack={noop}
        onChat={noop}
        onSharing={onSharing}
        onProgram={noop}
        onLeft={noop}
      />,
    );
    expect(await screen.findByText(t.mtMigratedNote('Iryna'))).toBeTruthy();
    // one way in (SPO-108): the note has no button of its own, the Privacy and sharing row is the entry
    expect(screen.queryByRole('button', { name: t.mtSharing })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t.mtPrivacy) }));
    expect(onSharing).toHaveBeenCalledTimes(1);
  });
  it('the trainer card has one action, Chat; sharing is reached only through the Privacy and sharing row', async () => {
    const onSharing = vi.fn();
    render(
      <MyTrainerPage
        port={createFixturesClientPort({ scenario: 'active' })}
        onBack={noop}
        onChat={noop}
        onSharing={onSharing}
        onProgram={noop}
        onLeft={noop}
      />,
    );
    await screen.findByText(t.mtChat);
    expect(screen.queryByRole('button', { name: t.mtSharing })).toBeNull();
    expect(document.querySelectorAll('.cc-hero-b button')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t.mtPrivacy) }));
    expect(onSharing).toHaveBeenCalledTimes(1);
  });
  const withOrg = (org: string): ClientCoachPort => {
    const base = createFixturesClientPort({ scenario: 'active' });
    const patch = (s: ClientSnapshot): ClientSnapshot => ({
      ...s,
      link: { ...s.link, trainer: { ...s.link.trainer!, org } },
    });
    const peeked = base.peek();
    return {
      ...base,
      peek: () => (peeked ? patch(peeked) : null),
      subscribe: (on, onError) => base.subscribe((s) => on(patch(s)), onError),
    };
  };
  it('no gym name: no dangling "Personal trainer at" line', async () => {
    page(withOrg(''));
    await screen.findByText(t.mtChat);
    expect(screen.queryByText(/Personal trainer at/)).toBeNull();
    cleanup();
    page(withOrg('   '));
    await screen.findByText(t.mtChat);
    expect(screen.queryByText(/Personal trainer at/)).toBeNull();
  });
  it('a gym name is shown on the line', async () => {
    page(withOrg('Iron Yard, Kyiv'));
    expect(await screen.findByText(t.invInviterAt('Iron Yard, Kyiv'))).toBeTruthy();
  });
  it('an ordinary relationship shows no migration note', async () => {
    page(createFixturesClientPort({ scenario: 'active' }));
    await screen.findByText(t.mtChat);
    expect(screen.queryByText(t.mtMigratedNote('Iryna'))).toBeNull();
  });
  it('no trainer: an empty state with a way out, not a skeleton', async () => {
    const onBack = vi.fn();
    render(
      <MyTrainerPage
        port={createFixturesClientPort({ scenario: 'none' })}
        onBack={onBack}
        onChat={noop}
        onSharing={noop}
        onProgram={noop}
        onLeft={noop}
      />,
    );
    expect(await screen.findByText(sf.mtNoneTitle)).toBeTruthy();
    expect(screen.queryByRole('status', { name: t.ccLoading })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: sf.mtNoneCta }));
    expect(onBack).toHaveBeenCalled();
  });
  it('a failing subscription shows a FailedState with Retry', async () => {
    const base = createFixturesClientPort({ scenario: 'active' });
    let attempts = 0;
    const port: ClientCoachPort = {
      ...base,
      peek: () => null,
      subscribe: (on, onError) => {
        attempts += 1;
        if (attempts === 1) {
          queueMicrotask(() => onError(new Error('offline')));
          return () => undefined;
        }
        return base.subscribe(on, onError);
      },
    };
    page(port);
    expect(await screen.findByText(sf.pbUnknownTitle)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: sf.retry }));
    expect(await screen.findByText(t.mtChat)).toBeTruthy();
    expect(attempts).toBe(2);
  });
  it('while loading it is a skeleton', () => {
    const base = createFixturesClientPort({ scenario: 'active' });
    page({ ...base, peek: () => null, subscribe: () => () => undefined });
    expect(screen.getByRole('status', { name: t.ccLoading })).toBeTruthy();
  });
});

describe('My trainer: leaving asks for the password (plan 2.7)', () => {
  it('confirm, then the password, then the relationship ends', async () => {
    const { configureReauth, forgetReauth } = await import('../../security/reauth');
    const { createFixturesReauthPort } = await import('../../security/__fixtures__/reauth');
    forgetReauth();
    configureReauth(createFixturesReauthPort({ accept: 'secret' }));
    const port = createFixturesClientPort({ scenario: 'active' });
    const leave = vi.spyOn(port, 'leave');
    const onLeft = vi.fn();
    render(
      <MyTrainerPage
        port={port}
        onBack={() => undefined}
        onChat={() => undefined}
        onSharing={() => undefined}
        onProgram={() => undefined}
        onLeft={onLeft}
      />,
    );
    fireEvent.click(await screen.findByText(t.mtLeave));
    fireEvent.click(screen.getByRole('button', { name: t.mtLeaveConfirm }));
    expect(leave).not.toHaveBeenCalled();
    fireEvent.change(await screen.findByLabelText(/Password/), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: sf.raConfirm }));
    await waitFor(() => expect(leave).toHaveBeenCalled());
    await waitFor(() => expect(onLeft).toHaveBeenCalled());
    configureReauth(null);
    forgetReauth();
  });
});

describe("the trainer's team (SPO-205)", () => {
  it('My trainer offers the team row; the page lists the people and what managers did, and says what they cannot see', async () => {
    const port = createFixturesClientPort({ scenario: 'active' });
    render(
      <MyTrainerPage
        port={port}
        onBack={() => undefined}
        onChat={() => undefined}
        onSharing={() => undefined}
        onProgram={() => undefined}
        onLeft={() => undefined}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(t.mtTeamRow) }));
    expect((await screen.findAllByText('Irina Melnyk')).length).toBeGreaterThan(1);
    expect(screen.getByText(t.tmgRoleManager)).toBeTruthy();
    expect(screen.getByText(t.tmgKind['move-request']!)).toBeTruthy();
    expect(screen.getByText(new RegExp(t.tmgCannot))).toBeTruthy();
  });

  it('Who saw your data also lists what managers did with the schedule', async () => {
    render(
      <AccessLogPage
        port={createFixturesClientPort({ scenario: 'active' })}
        onBack={() => undefined}
      />,
    );
    expect(await screen.findByText(t.tmgActionsHead)).toBeTruthy();
    expect(screen.getByText(t.tmgKind['session-done']!)).toBeTruthy();
  });
});
