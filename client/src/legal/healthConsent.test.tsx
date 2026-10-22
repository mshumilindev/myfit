import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

/** SPO-290 + N9: a consent per health feature (prompt, off state, withdrawal, delete offer) and the "not medical advice" notice. */
const h = vi.hoisted(() => ({
  state: { records: [], loading: false, confirmed: true, error: null } as {
    records: unknown[];
    loading: boolean;
    confirmed: boolean;
    error: Error | null;
  },
  grant: vi.fn(),
  withdraw: vi.fn(),
}));
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  currentUid: () => 'u1',
  onAuthChange: () => () => undefined,
}));
vi.mock('./consentApi', async () => {
  const real = await vi.importActual<typeof import('./consentApi')>('./consentApi');
  return {
    ...real,
    useConsentRecords: () => h.state,
    grantConsent: h.grant,
    withdrawConsent: h.withdraw,
  };
});

import { HealthConsentHost } from './HealthConsentHost';
import { HealthGate } from './HealthOff';
import { ConsentsPage } from './ConsentsPage';
import { HealthView } from '../views/HealthView';
import { markLocalOff, localOffKinds } from './localOff';
import { HEALTH_FEATURE_INFO } from './healthFeatures';
import {
  HEALTH_FEATURES,
  LEGAL_VERSIONS,
  currentVersion,
  type ConsentRecord,
  type HealthFeature,
} from './consents';
import { isHealthOn, resetHealthGateForTests, openHealthPrompt } from '../data/healthConsentGate';
import { healthConsentTexts } from '../i18n/healthConsent';
import {
  __getStateForTests,
  __replaceStateForTests,
  deleteStoredHealthData,
  hasStoredHealthData,
  saveNicotineProduct,
} from '../store';
import { newNicotineProduct } from '../nicotine';
import { ymdToDay } from '../health';
import { setLocale } from '../i18n';
import type { Shell } from '../App';
import type { Injury } from '../types';

const en = healthConsentTexts('en');
let n = 0;
const rec = (feature: HealthFeature, action: 'grant' | 'withdraw' = 'grant'): ConsentRecord => ({
  id: `r${++n}`,
  kind: `health:${feature}`,
  action,
  version: LEGAL_VERSIONS.health,
  at: 1_700_000_000_000 + n,
});
const required = (): ConsentRecord[] =>
  (['terms', 'policy-ack', 'age-18'] as const).map((kind) => ({
    id: `q${++n}`,
    kind,
    action: 'grant',
    version: currentVersion(kind),
    at: 1_700_000_000_000 + n,
  }));
const setRecords = (records: ConsentRecord[], confirmed = true) =>
  (h.state = { records, loading: false, confirmed, error: null });
const prompt = (feature: HealthFeature) =>
  screen.queryByRole('alertdialog', { name: en.features[feature].title });

function Mount({ feature = 'nicotine' as HealthFeature }) {
  return (
    <>
      <HealthConsentHost />
      <HealthGate feature={feature} onBack={() => undefined}>
        <div data-testid="feature-screen" />
      </HealthGate>
    </>
  );
}

beforeEach(() => {
  localStorage.clear();
  setLocale('en');
  resetHealthGateForTests(false);
  setRecords([]);
  h.grant.mockReset().mockResolvedValue({ id: 'x', at: 1 });
  h.withdraw.mockReset().mockResolvedValue({ id: 'y', at: 2 });
});
afterEach(() => {
  cleanup();
  resetHealthGateForTests(true);
});

describe('a feature is off until its own consent', () => {
  it('every feature is off by default, and nothing is on while the records are unknown', () => {
    render(<HealthConsentHost />);
    for (const f of HEALTH_FEATURES) expect(isHealthOn(f)).toBe(false);
    setRecords([], false);
    render(<Mount />);
    // not ready: neither the feature nor "off" is drawn (no flash for someone who agreed)
    expect(screen.queryByTestId('feature-screen')).toBeNull();
    expect(screen.queryByText('Nicotine is off')).toBeNull();
    expect(prompt('nicotine')).toBeNull();
  });

  it('the first entry shows the prompt, before anything is collected, and the screen stays off', async () => {
    render(<Mount />);
    expect(await screen.findByRole('alertdialog', { name: 'Track nicotine?' })).toBeTruthy();
    expect(screen.queryByTestId('feature-screen')).toBeNull();
    expect(screen.getByText('Nicotine is off')).toBeTruthy();
    expect(h.grant).not.toHaveBeenCalled();
  });

  it('"Not now" records nothing, the feature stays off, and it does not ask again by itself', async () => {
    render(<Mount />);
    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }));
    await waitFor(() => expect(prompt('nicotine')).toBeNull());
    expect(h.grant).not.toHaveBeenCalled();
    expect(isHealthOn('nicotine')).toBe(false);
    expect(screen.getByText('Nicotine is off')).toBeTruthy();
    // "Turn on" asks again, on request
    fireEvent.click(screen.getByRole('button', { name: 'Turn on' }));
    expect(await screen.findByRole('alertdialog', { name: 'Track nicotine?' })).toBeTruthy();
  });

  it('"I agree" records exactly this feature with its categories, and the screen opens once the record is there', async () => {
    const view = render(<Mount />);
    fireEvent.click(await screen.findByRole('button', { name: 'I agree' }));
    await waitFor(() =>
      expect(h.grant).toHaveBeenCalledWith({
        kind: 'health:nicotine',
        categories: [...HEALTH_FEATURE_INFO.nicotine.categories],
      }),
    );
    expect(h.grant).toHaveBeenCalledTimes(1);
    expect(isHealthOn('nicotine')).toBe(false); // on only when the record arrives
    setRecords([...required(), rec('nicotine')]);
    view.rerender(<Mount />);
    expect(await screen.findByTestId('feature-screen')).toBeTruthy();
    expect(isHealthOn('nicotine')).toBe(true);
    for (const f of HEALTH_FEATURES.filter((x) => x !== 'nicotine'))
      expect(isHealthOn(f)).toBe(false);
  });

  it('a failed save keeps the prompt open and says so', async () => {
    h.grant.mockRejectedValue(new Error('x'));
    render(<Mount />);
    fireEvent.click(await screen.findByRole('button', { name: 'I agree' }));
    expect(await screen.findByText(en.saveError)).toBeTruthy();
    expect(prompt('nicotine')).toBeTruthy();
  });

  it('a withdrawn or older-version record is off', () => {
    setRecords([rec('nicotine'), rec('nicotine', 'withdraw')]);
    render(<HealthConsentHost />);
    expect(isHealthOn('nicotine')).toBe(false);
    setRecords([{ ...rec('cycle'), version: '2020-01-01' }]);
    render(<HealthConsentHost />);
    expect(isHealthOn('cycle')).toBe(false);
  });

  it('someone who answered before is not asked again by the first entry', async () => {
    setRecords([rec('alcohol'), rec('alcohol', 'withdraw')]);
    render(<Mount feature="alcohol" />);
    expect(await screen.findByText('Alcohol is off')).toBeTruthy();
    expect(prompt('alcohol')).toBeNull();
  });
});

describe('the prompt says what is true', () => {
  for (const f of HEALTH_FEATURES) {
    it(`${f}: what you add, where it lives, who can see it, what withdrawing does; I agree / Not now`, async () => {
      setRecords(required());
      render(<HealthConsentHost />);
      act(() => openHealthPrompt(f));
      const dlg = await screen.findByRole('alertdialog', { name: en.features[f].title });
      expect(dlg.textContent).toContain(en.features[f].what);
      expect(dlg.textContent).toContain(en.features[f].who);
      expect(dlg.textContent).toContain('until you delete them');
      expect(screen.getByRole('button', { name: 'I agree' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Not now' })).toBeTruthy();
      expect(dlg.textContent).toContain('not end-to-end');
      expect(dlg.textContent).not.toMatch(/we (cannot|can't|do not|don't) (see|read|access)/i);
      if (f === 'nutrition') {
        expect(dlg.textContent).toContain('does not add its own encryption');
        expect(dlg.textContent).toContain('Open Food Facts');
      } else {
        expect(dlg.textContent).toContain('Our servers hold the key');
      }
    });
  }
});

describe('a withdrawal not yet recorded survives a reload', () => {
  it('cached records still say on, but the persisted local-off keeps only that feature off', async () => {
    markLocalOff('u1', 'health:nicotine');
    setRecords([...required(), rec('nicotine'), rec('alcohol')]);
    render(<HealthConsentHost />);
    await waitFor(() => expect(isHealthOn('alcohol')).toBe(true));
    expect(isHealthOn('nicotine')).toBe(false);
  });
  it('offline: withdrawing keeps the flag and the queued record until the server has it', async () => {
    resetHealthGateForTests(true);
    h.withdraw.mockRejectedValue(new Error('offline'));
    const { withdrawHealth } = await import('./healthConsentActions');
    expect(await withdrawHealth('nicotine')).toBe(false);
    expect(localOffKinds('u1')).toEqual(['health:nicotine']);
    expect(localStorage.getItem('spotter.consentQueue')).toContain('"withdraw"');
    expect(isHealthOn('nicotine')).toBe(false);
  });
});

describe('withdrawing, and the offer to delete', () => {
  const sw = (name: string) => screen.getByRole('switch', { name });

  beforeEach(() => {
    resetHealthGateForTests(true);
    __replaceStateForTests({ ...__getStateForTests() });
    deleteStoredHealthData('nicotine');
    saveNicotineProduct(newNicotineProduct('vape', 'p1'));
    setRecords([...required(), rec('nicotine')]);
  });
  afterEach(() => deleteStoredHealthData('nicotine'));

  it('turns it off at once on this device and records the withdrawal of that feature only', async () => {
    render(
      <>
        <HealthConsentHost />
        <ConsentsPage />
      </>,
    );
    await waitFor(() => expect(isHealthOn('nicotine')).toBe(true));
    fireEvent.click(sw('Nicotine'));
    expect(screen.getByText('Turn off nicotine tracking?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw consent' }));
    await waitFor(() =>
      expect(h.withdraw).toHaveBeenCalledWith(expect.objectContaining({ kind: 'health:nicotine' })),
    );
    expect(isHealthOn('nicotine')).toBe(false);
    expect(h.withdraw).toHaveBeenCalledTimes(1);
  });

  it('then OFFERS deleting: "Keep my data" leaves it stored (unused)', async () => {
    render(
      <>
        <HealthConsentHost />
        <ConsentsPage />
      </>,
    );
    await waitFor(() => expect(isHealthOn('nicotine')).toBe(true));
    fireEvent.click(sw('Nicotine'));
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw consent' }));
    expect(await screen.findByText('Delete your Nicotine data?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep my data' }));
    await waitFor(() => expect(screen.queryByText('Delete your Nicotine data?')).toBeNull());
    expect(hasStoredHealthData('nicotine')).toBe(true);
  });

  it('two steps, then it is really deleted', async () => {
    render(
      <>
        <HealthConsentHost />
        <ConsentsPage />
      </>,
    );
    await waitFor(() => expect(isHealthOn('nicotine')).toBe(true));
    fireEvent.click(sw('Nicotine'));
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw consent' }));
    await screen.findByText('Delete your Nicotine data?');
    expect(screen.getByText('Step 1 of 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('This cannot be undone')).toBeTruthy();
    expect(screen.getByText('Step 2 of 2')).toBeTruthy();
    expect(hasStoredHealthData('nicotine')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(hasStoredHealthData('nicotine')).toBe(false));
  });

  it('no stored data: no delete offer', async () => {
    deleteStoredHealthData('nicotine');
    render(
      <>
        <HealthConsentHost />
        <ConsentsPage />
      </>,
    );
    await waitFor(() => expect(isHealthOn('nicotine')).toBe(true));
    fireEvent.click(sw('Nicotine'));
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw consent' }));
    await waitFor(() => expect(h.withdraw).toHaveBeenCalled());
    expect(screen.queryByText('Delete your Nicotine data?')).toBeNull();
  });

  it('a withdrawal that cannot be saved still stops the feature here and says so', async () => {
    h.withdraw.mockRejectedValue(new Error('offline'));
    render(
      <>
        <HealthConsentHost />
        <ConsentsPage />
      </>,
    );
    await waitFor(() => expect(isHealthOn('nicotine')).toBe(true));
    deleteStoredHealthData('nicotine');
    fireEvent.click(sw('Nicotine'));
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw consent' }));
    expect(await screen.findByText(en.wFailed)).toBeTruthy();
    expect(isHealthOn('nicotine')).toBe(false);
  });
});

describe('the rest of the app without the consents', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 26, 12, 0).getTime());
    window.matchMedia = ((q: string) => ({
      matches: false,
      media: q,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => vi.useRealTimers());
  const shell = (): Shell =>
    ({
      openOverlay: vi.fn(),
      replaceOverlay: vi.fn(),
      goTab: vi.fn(),
      goPlaybook: vi.fn(),
      openStart: vi.fn(),
      toast: vi.fn(),
      snack: vi.fn(),
      signOut: vi.fn(),
      queueLength: 0,
    }) as unknown as Shell;
  const knee: Injury = {
    id: 'knee',
    reason: 'injury',
    bodyPart: 'knee',
    side: 'left',
    muscles: ['quads'],
    stage: 'reintroduce',
    startDay: ymdToDay(2026, 8, 20),
    createdAt: 1,
    checkins: [],
    healedDay: null,
  };

  it('Health still opens with every feature off: no crash, no stored data shown, the disclaimer on top', () => {
    __replaceStateForTests({ ...__getStateForTests(), injuries: [knee] });
    render(<HealthView shell={shell()} onClose={vi.fn()} />);
    expect(screen.getByText(en.disclaimer)).toBeTruthy();
    expect(screen.getByText('Sleep details & schedule')).toBeTruthy();
    expect(screen.queryByText('Rehab plan')).toBeNull();
    expect(__getStateForTests().injuries).toHaveLength(1); // kept, not deleted
  });

  it('with the consent the same stored data shows again', () => {
    resetHealthGateForTests(true);
    __replaceStateForTests({ ...__getStateForTests(), injuries: [knee] });
    render(<HealthView shell={shell()} onClose={vi.fn()} />);
    expect(screen.getByText('Rehab plan')).toBeTruthy();
    expect(screen.getByText(en.disclaimer)).toBeTruthy();
  });

  it('each feature page without its consent says "X is off" instead of opening', async () => {
    setRecords(required());
    for (const [p, name] of [
      [{ nic: 'hub' }, 'Nicotine'],
      [{ alc: 'hub' }, 'Alcohol'],
      [{ sup: 'hub' }, 'Supplements'],
      [{ cyc: 'hub' }, 'Cycle'],
    ] as const) {
      const view = render(
        <>
          <HealthConsentHost />
          <HealthView shell={shell()} onClose={vi.fn()} {...p} />
        </>,
      );
      expect(await screen.findByText(`${name} is off`)).toBeTruthy();
      view.unmount();
      act(() => resetHealthGateForTests(false));
    }
  });
});
