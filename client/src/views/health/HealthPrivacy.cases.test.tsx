import { currentHash } from '../../route';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { setLocale } from '../../i18n';
import { en } from '../../i18n/en';
import {
  __getStateForTests,
  deleteAlcoholData,
  deleteNicotineData,
  deleteSupplementData,
  getCycle,
  resetLocalData,
  saveCycleSettings,
  saveAlcoholEntry,
  saveNicotineProduct,
  saveSupplementEntry,
  setConditionsShare,
} from '../../store';
import { dayOfTimestamp } from '../../components/ui/calendarDays';
import { newNicotineProduct } from '../../nicotine';
import { newAlcoholEntry } from '../../alcohol';
import { newSupplementEntry } from '../../supplements';

// The trainer-sharing block belongs to the client-coach feature (flag-gated, lazy): its two exits are exposed as buttons.
vi.mock('../../coach/client/lazy', async (orig) => ({
  ...(await orig<typeof import('../../coach/client/lazy')>()),
  ClientTrainerSharing: (p: { onOpenLog: () => void; onOpenTrainer: () => void }) => (
    <div data-testid="trainer-sharing">
      <button onClick={p.onOpenLog}>open-log</button>
      <button onClick={p.onOpenTrainer}>open-trainer</button>
    </div>
  ),
}));

import { HealthPrivacyView } from './HealthPrivacyView';

const dlg = () => document.querySelector('[role="alertdialog"], [role="dialog"]') as HTMLElement;

beforeEach(() => {
  setLocale('en');
  resetLocalData();
  deleteNicotineData();
  deleteAlcoholData();
  deleteSupplementData();
  setConditionsShare('off');
  window.location.hash = '';
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('HealthPrivacyView: exits to the trainer', () => {
  it('opens the sharing log and the trainer page by hash', () => {
    render(<HealthPrivacyView onBack={() => undefined} />);
    fireEvent.click(screen.getByText('open-log'));
    expect(currentHash()).toBe('#/trainer/log');
    fireEvent.click(screen.getByText('open-trainer'));
    expect(currentHash()).toBe('#/trainer');
  });
});

describe('HealthPrivacyView: delete cycle data', () => {
  const setup = () =>
    saveCycleSettings({
      mode: 'regular',
      length: 28,
      period: 5,
      anchor: dayOfTimestamp(Date.now()) - 3,
    });

  it('is offered only once the cycle is on; cancel keeps it', () => {
    const first = render(<HealthPrivacyView onBack={() => undefined} />);
    expect(screen.queryByText(en.cycDelete)).toBeNull();
    first.unmount();
    setup();
    render(<HealthPrivacyView onBack={() => undefined} />);
    fireEvent.click(screen.getByText(en.cycDelete));
    expect(screen.getByText(en.cycDeleteBody)).toBeTruthy();
    fireEvent.click(within(dlg()).getByRole('button', { name: en.cancel }));
    expect(getCycle().enabled).toBe(true);
  });

  it('confirming wipes it', () => {
    setup();
    render(<HealthPrivacyView onBack={() => undefined} />);
    fireEvent.click(screen.getByText(en.cycDelete));
    fireEvent.click(within(dlg()).getByRole('button', { name: en.cycDeleteConfirm }));
    expect(getCycle().enabled).toBe(false);
    expect(screen.queryByText(en.cycDelete)).toBeNull();
  });
});

describe('HealthPrivacyView: confirming a delete wipes that kind of data and only that', () => {
  const fill = () => {
    saveNicotineProduct(newNicotineProduct('cigarettes', 'n1'));
    saveAlcoholEntry(newAlcoholEntry('beerRegular', 'a1', 500));
    saveSupplementEntry(newSupplementEntry('creatine', 's1', Date.now()));
  };
  const counts = () => {
    const st = __getStateForTests();
    return {
      nic: st.nicotine.products.length,
      alc: st.alcohol.entries.length,
      sup: st.supplements.entries.length,
    };
  };

  it.each([
    ['alcohol', en.alcPrivDelete, { nic: 1, alc: 0, sup: 1 }],
    ['supplements', en.supPrivDelete, { nic: 1, alc: 1, sup: 0 }],
    ['nicotine', en.nicPrivDelete, { nic: 0, alc: 1, sup: 1 }],
  ])('%s', (_name, rowLabel, after) => {
    fill();
    expect(counts()).toEqual({ nic: 1, alc: 1, sup: 1 });
    render(<HealthPrivacyView onBack={() => undefined} />);
    fireEvent.click(screen.getByText(rowLabel));
    fireEvent.click(within(dlg()).getByRole('button', { name: rowLabel }));
    expect(counts()).toEqual(after);
  });
});

describe('HealthPrivacyView: delete data confirmations', () => {
  it.each([
    ['alcohol', en.alcPrivDelete, en.alcPrivDeleteAsk],
    ['supplements', en.supPrivDelete, en.supPrivDeleteAsk],
    ['nicotine', en.nicPrivDelete, en.nicPrivDeleteAsk],
  ])('%s asks first and cancel leaves the data alone', (_name, rowLabel, ask) => {
    render(<HealthPrivacyView onBack={() => undefined} />);
    fireEvent.click(screen.getByText(rowLabel));
    expect(within(dlg()).getByText(ask)).toBeTruthy();
    fireEvent.click(within(dlg()).getByRole('button', { name: en.cancel }));
    expect(document.querySelector('[role="alertdialog"], [role="dialog"]')).toBeNull();
  });
});
