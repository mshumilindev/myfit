import { addonsPref } from '../../../addons/enabledSet';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  healthPromptFeature,
  resetHealthGateForTests,
  setHealthConsentState,
} from '../../../data/healthConsentGate';
import { clientEn as t } from '../../../i18n/coachClient.en';
import { en as tEn } from '../../../i18n/en';
import { SHARE_IDS } from '../shareModel';
import { setConditionsShare } from '../../../store';
import { setViewport } from '../../testViewport';
import type { AccessAsk } from '../../share/accessAsk';
import { createFixturesClientPort } from '../data/__fixtures__/fixtures';
import { AccessAskForm } from './AccessAskForm';

// what a test installs it removes again (SPO-500)
afterEach(() => addonsPref.reset());

const ALL = {
  injuries: true,
  chronic: true,
  cycle: true,
  nicotine: true,
  alcohol: true,
  supplements: true,
  nutrition: true,
};
const gate = (on: Partial<typeof ALL>) =>
  act(() => setHealthConsentState({ on: { ...ALL, ...on }, ready: true, answered: { ...ALL } }));

const ask = (cats: AccessAsk['cats']): AccessAsk => ({ reqId: 'access-ask:1', cats });

beforeEach(() => {
  addonsPref.set([
    'health',
    'injury-log',
    'cycle',
    'supplements',
    'nicotine',
    'alcohol',
    'conditions',
    'rest',
    'unwell',
    'sleep',
  ]);
  setViewport(390);
  setConditionsShare('off');
});
afterEach(() => {
  cleanup();
  resetHealthGateForTests(true);
  setConditionsShare('off');
});

describe('access ask form (SPO-99)', () => {
  it('starts with every asked row Off, applies only what the client picks and answers "partly allowed"', async () => {
    const port = createFixturesClientPort({ scenario: 'active' });
    const spy = vi.spyOn(port, 'setLevel');
    const onDone = vi.fn();
    render(
      <AccessAskForm
        first="Oleh"
        ask={ask(['conditions', 'nicotine'])}
        port={port}
        onDone={onDone}
        onClose={vi.fn()}
      />,
    );
    expect(await screen.findByText(t.rfTitle('Oleh', 2))).toBeTruthy();
    expect(screen.getByRole('button', { name: t.rfSaveNone })).toBeTruthy();
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Long-term conditions' })).getByRole('button', {
        name: t.lvEffects,
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: t.rfSave(1) }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('partial'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('a trainer grant is written through setLevel', async () => {
    const port = createFixturesClientPort({ scenario: 'active' });
    const spy = vi.spyOn(port, 'setLevel');
    const onDone = vi.fn();
    render(
      <AccessAskForm
        first="Oleh"
        ask={ask(['sleep'])}
        port={port}
        onDone={onDone}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(
      within(await screen.findByRole('group', { name: 'Sleep' })).getByRole('button', {
        name: t.lvFull,
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: t.rfSave(1) }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('allowed'));
    expect(spy).toHaveBeenCalledWith('sleep', 'full');
  });

  it('"Not now" answers declined and changes nothing', async () => {
    const port = createFixturesClientPort({ scenario: 'active' });
    const spy = vi.spyOn(port, 'setLevel');
    const onDone = vi.fn();
    render(
      <AccessAskForm
        first="Oleh"
        ask={ask(['sleep'])}
        port={port}
        onDone={onDone}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: t.rfNotNow }));
    expect(onDone).toHaveBeenCalledWith('declined');
    expect(spy).not.toHaveBeenCalled();
  });

  it('a row whose health feature has no consent is blocked, offers the consent prompt and counts as not allowed', async () => {
    const port = createFixturesClientPort({ scenario: 'active' });
    const onDone = vi.fn();
    gate({ injuries: false });
    render(
      <AccessAskForm
        first="Oleh"
        ask={ask(['injury'])}
        port={port}
        onDone={onDone}
        onClose={vi.fn()}
      />,
    );
    expect(await screen.findByText(t.rfConsentTitle)).toBeTruthy();
    expect(screen.getByText(t.rfNeedsConsent)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t.rfReview }));
    expect(healthPromptFeature()).toBe('injuries');
    fireEvent.click(screen.getByRole('button', { name: t.rfSaveNone }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('declined'));
  });

  it('an on-device row is written locally and the whole ask can be allowed', async () => {
    const port = createFixturesClientPort({ scenario: 'active' });
    const onDone = vi.fn();
    render(
      <AccessAskForm
        first="Oleh"
        ask={ask(['conditions'])}
        port={port}
        onDone={onDone}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: t.lvEffects }));
    fireEvent.click(screen.getByRole('button', { name: t.rfSave(1) }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('allowed'));
  });

  it('a failed save is not reported to the trainer: the form stays open with an error and can be retried', async () => {
    const port = createFixturesClientPort({ scenario: 'active' });
    vi.spyOn(port, 'setLevel').mockRejectedValue(new Error('offline'));
    const onDone = vi.fn();
    render(
      <AccessAskForm
        first="Oleh"
        ask={ask(['sleep'])}
        port={port}
        onDone={onDone}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(
      within(await screen.findByRole('group', { name: 'Sleep' })).getByRole('button', {
        name: t.lvFull,
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: t.rfSave(1) }));
    expect(await screen.findByText(t.ccSaveFailed)).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('asking for every category (Availability included) says "everything"; the Availability row is offered only with Planner installed', async () => {
    const port = createFixturesClientPort({ scenario: 'active' });
    addonsPref.set([...(addonsPref.get() as string[]), 'planner']);
    render(
      <AccessAskForm
        first="Anna"
        ask={ask([...SHARE_IDS])}
        port={port}
        onDone={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(await screen.findByText(t.rfTitleAll('Anna'))).toBeTruthy();
    expect(screen.getByText(tEn.avlTitle)).toBeTruthy();
  });

  it('without Planner, an asked Availability row is not offered', async () => {
    const port = createFixturesClientPort({ scenario: 'active' });
    render(
      <AccessAskForm
        first="Anna"
        ask={ask(['totals', 'availability'])}
        port={port}
        onDone={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await screen.findByText(t.rfTitle('Anna', 1));
    expect(screen.queryByText(tEn.avlTitle)).toBeNull();
  });
});
