import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  healthPromptFeature,
  resetHealthGateForTests,
  setHealthConsentState,
} from '../../../data/healthConsentGate';
import { clientEn as t } from '../../../i18n/coachClient.en';
import { setConditionsShare, setNicotineSharing } from '../../../store';
import { setViewport } from '../../testViewport';
import { createFixturesClientPort } from '../data/__fixtures__/fixtures';
import { TrainerSharing } from './TrainerSharing';

const ALL = {
  injuries: true,
  chronic: true,
  cycle: true,
  nicotine: true,
  alcohol: true,
  supplements: true,
  nutrition: true,
};
const gate = (on: Partial<typeof ALL>, ready = true) =>
  act(() =>
    setHealthConsentState({
      on: { ...ALL, ...on },
      ready,
      answered: { ...ALL },
    }),
  );
const row = (title: string) => screen.findByRole('button', { name: new RegExp(`^${title},`) });

beforeEach(() => {
  setViewport(390);
  setConditionsShare('off');
  setNicotineSharing('off');
});
afterEach(() => {
  cleanup();
  resetHealthGateForTests(true);
  setConditionsShare('off');
  setNicotineSharing('off');
});

describe('sharing list and the health consents (SPO-290)', () => {
  it('a feature without consent reads "Feature is off", is not counted, and a tap asks for the consent instead of opening the sheet', async () => {
    setConditionsShare('effects');
    const port = createFixturesClientPort({ scenario: 'active' });
    render(<TrainerSharing port={port} force />);
    expect(await row('Long-term conditions')).toBeTruthy();
    expect(screen.getByText(/Effects only:/)).toBeTruthy();
    gate({ chronic: false });
    const off = await row('Long-term conditions');
    expect(off.textContent).toContain(t.shFeatureOff);
    expect(off.textContent).toContain(t.shFeatureOffSub);
    // the summary no longer lists it, even though the stored level is Effects only
    expect(screen.queryByText(/Long-term conditions\./)).toBeNull();
    fireEvent.click(off);
    expect(healthPromptFeature()).toBe('chronic');
    expect(screen.queryByRole('group', { name: t.lvSheetLabel })).toBeNull();
  });

  it('injuries and nutrition (trainer grants) are gated by their features too', async () => {
    const port = createFixturesClientPort({ scenario: 'active' });
    render(<TrainerSharing port={port} force />);
    await row('Injuries and restrictions');
    gate({ injuries: false, nutrition: false });
    expect((await row('Injuries and restrictions')).textContent).toContain(t.shFeatureOff);
    expect((await row('Nutrition')).textContent).toContain(t.shFeatureOff);
    expect((await row('Sleep')).textContent).not.toContain(t.shFeatureOff);
  });

  it('while the consent records are unknown (fail closed) health rows are disabled and not counted', async () => {
    setNicotineSharing('effects');
    const port = createFixturesClientPort({ scenario: 'active' });
    render(<TrainerSharing port={port} force />);
    await row('Nicotine');
    gate({}, false);
    const pending = await row('Nicotine');
    expect(pending.hasAttribute('disabled')).toBe(true);
    expect(screen.queryByText(/Nicotine\./)).toBeNull();
    // workout rows stay usable
    expect((await row('Workout totals')).hasAttribute('disabled')).toBe(false);
    await waitFor(() => expect(healthPromptFeature()).toBeNull());
  });

  it('every row is a named button: "title, level" (a11y)', async () => {
    const port = createFixturesClientPort({ scenario: 'active' });
    render(<TrainerSharing port={port} force />);
    await row('Workout totals');
    const names = screen
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'))
      .filter(Boolean);
    expect(names).toContain('Workout totals, Full');
    expect(names).toContain('Alcohol, Off');
    expect(names).toHaveLength(10);
  });
});
