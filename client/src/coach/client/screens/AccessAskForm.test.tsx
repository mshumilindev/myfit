import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  healthPromptFeature,
  resetHealthGateForTests,
  setHealthConsentState,
} from '../../../data/healthConsentGate';
import { clientEn as t } from '../../../i18n/coachClient.en';
import { setConditionsShare } from '../../../store';
import { setViewport } from '../../testViewport';
import type { AccessAsk } from '../../share/accessAsk';
import { createFixturesClientPort } from '../data/__fixtures__/fixtures';
import { AccessAskForm } from './AccessAskForm';

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
});
