import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HealthView, type HealthViewProps } from './HealthView';
import { __getStateForTests, __replaceStateForTests } from '../store';
import { ymdToDay } from '../health';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import type { Injury, RestPeriod } from '../types';
import { injuryLabel } from './health/parts';
import { freezeClock, makeShell, NOW, PRISTINE, setDesktop } from './__fixtures__/viewKit';

// The sub-screens have their own tests; here only HealthView's routing of them is under test.
vi.mock('./health/nicotine/NicotineScreens', () => ({
  NicotineScreens: (p: {
    screen: string;
    onOpen: (s: 'hub' | 'products' | 'calc') => void;
    onBack: () => void;
  }) => (
    <div data-testid="nic">
      <span>nic:{p.screen}</span>
      <button onClick={() => p.onOpen('products')}>nic-open</button>
      <button onClick={p.onBack}>nic-back</button>
    </div>
  ),
}));
vi.mock('./health/alcohol/AlcoholScreens', () => ({
  AlcoholScreens: (p: { screen: string; onOpen: (s: 'days') => void; onBack: () => void }) => (
    <div data-testid="alc">
      <span>alc:{p.screen}</span>
      <button onClick={() => p.onOpen('days')}>alc-open</button>
      <button onClick={p.onBack}>alc-back</button>
    </div>
  ),
}));
vi.mock('./health/supplements/SupplementScreens', () => ({
  SupplementScreens: (p: { screen: string; onOpen: (s: 'calc') => void; onBack: () => void }) => (
    <div data-testid="sup">
      <span>sup:{p.screen}</span>
      <button onClick={() => p.onOpen('calc')}>sup-open</button>
      <button onClick={p.onBack}>sup-back</button>
    </div>
  ),
}));
vi.mock('./health/cycle/CycleScreens', () => ({
  CycleScreens: (p: {
    screen: string;
    onOpen: (s: 'settings') => void;
    onBack: () => void;
    onOpenStates: () => void;
  }) => (
    <div data-testid="cyc">
      <span>cyc:{p.screen}</span>
      <button onClick={() => p.onOpen('settings')}>cyc-open</button>
      <button onClick={p.onOpenStates}>cyc-states</button>
      <button onClick={p.onBack}>cyc-back</button>
    </div>
  ),
}));
vi.mock('./health/HealthForm', () => ({
  HealthForm: (p: {
    spec: unknown;
    web: boolean;
    onCancel: () => void;
    onDone: () => void;
    onRehab: (x: { bodyPart: string; side: string; startDay: number }) => void;
  }) => (
    <div data-testid="form">
      <span>{JSON.stringify(p.spec)}</span>
      <span>web:{String(p.web)}</span>
      <button onClick={p.onCancel}>form-cancel</button>
      <button onClick={p.onDone}>form-done</button>
      <button onClick={() => p.onRehab({ bodyPart: 'knee', side: 'left', startDay: 7 })}>
        form-rehab
      </button>
    </div>
  ),
}));

const D = (m: number, d: number) => ymdToDay(2026, m - 1, d);
const TODAY = D(9, 26);
const knee = (over: Partial<Injury> = {}): Injury => ({
  id: 'knee',
  reason: 'injury',
  bodyPart: 'knee',
  side: 'left',
  muscles: ['quads'],
  stage: 'reintroduce',
  startDay: D(9, 20),
  createdAt: 1,
  checkins: [],
  healedDay: null,
  ...over,
});
const seed = (over: Record<string, unknown> = {}) =>
  __replaceStateForTests({
    ...structuredClone(PRISTINE),
    restPeriods: [],
    injuries: [],
    workouts: [],
    sleeps: [],
    activities: [],
    ...over,
  } as never);
const view = (p: Partial<HealthViewProps> = {}) => {
  const shell = makeShell();
  const onClose = vi.fn();
  const out = render(<HealthView shell={shell} onClose={onClose} {...p} />);
  return { ...out, shell, onClose };
};

beforeEach(() => {
  freezeClock(NOW);
  localStorage.clear();
  setLocale('en');
  setDesktop(false);
  seed();
});
afterEach(() => cleanup());

describe('HealthView routes the lifestyle sub-screens', () => {
  it('nicotine: passes the page, opens another page in place of this one, back closes', () => {
    const { shell, onClose } = view({ nic: 'calc' });
    expect(screen.getByText('nic:calc')).toBeTruthy();
    fireEvent.click(screen.getByText('nic-open'));
    expect(shell.openOverlay).toHaveBeenCalledWith({ screen: 'health', nic: 'products' });
    fireEvent.click(screen.getByText('nic-back'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('alcohol', () => {
    const { shell, onClose } = view({ alc: 'hub' });
    expect(screen.getByText('alc:hub')).toBeTruthy();
    fireEvent.click(screen.getByText('alc-open'));
    expect(shell.openOverlay).toHaveBeenCalledWith({ screen: 'health', alc: 'days' });
    fireEvent.click(screen.getByText('alc-back'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('supplements', () => {
    const { shell, onClose } = view({ sup: 'products' });
    expect(screen.getByText('sup:products')).toBeTruthy();
    fireEvent.click(screen.getByText('sup-open'));
    expect(shell.openOverlay).toHaveBeenCalledWith({ screen: 'health', sup: 'calc' });
    fireEvent.click(screen.getByText('sup-back'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('cycle: its "states" link opens the conditions page', () => {
    const { shell, onClose } = view({ cyc: 'hub' });
    fireEvent.click(screen.getByText('cyc-open'));
    expect(shell.openOverlay).toHaveBeenLastCalledWith({ screen: 'health', cyc: 'settings' });
    fireEvent.click(screen.getByText('cyc-states'));
    expect(shell.openOverlay).toHaveBeenLastCalledWith({ screen: 'health', cond: undefined });
    fireEvent.click(screen.getByText('cyc-back'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('HealthView hosts the form', () => {
  it('on a phone the form takes the whole screen; cancel and done both close', () => {
    const { onClose } = view({ form: { kind: 'new', ctx: 'start', type: 'off' } });
    expect(screen.getByText('web:false')).toBeTruthy();
    expect(screen.queryByText(en.startHealthTitle)).toBeNull();
    fireEvent.click(screen.getByText('form-cancel'));
    fireEvent.click(screen.getByText('form-done'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('on the web it sits in the right panel with the overview kept on the left', () => {
    setDesktop(true);
    view({ form: { kind: 'new', ctx: 'past', type: 'illness' } });
    expect(screen.getByText('web:true')).toBeTruthy();
    expect(screen.getByText(en.startHealthTitle)).toBeTruthy();
    expect(document.querySelector('.hl-hist')).toBeNull();
  });

  it('an existing period or injury form is honoured', () => {
    seed({
      restPeriods: [
        { id: 'r', mode: 'off', startDay: D(9, 1), endDay: D(9, 2), createdAt: 1 } as RestPeriod,
      ],
    });
    view({ form: { kind: 'edit', periodId: 'r' } });
    expect(screen.getByText(/"periodId":"r"/)).toBeTruthy();
    cleanup();
    seed({ injuries: [knee()] });
    view({ form: { kind: 'edit-injury', injuryId: 'knee' } });
    expect(screen.getByText(/"injuryId":"knee"/)).toBeTruthy();
  });

  it('"still healing" continues into the rehab plan, replacing the overlay', () => {
    const { shell } = view({ form: { kind: 'new', ctx: 'past', type: 'injury' } });
    fireEvent.click(screen.getByText('form-rehab'));
    expect(shell.replaceOverlay).toHaveBeenCalledWith({
      screen: 'injury',
      prefill: { bodyPart: 'knee', side: 'left', startDay: 7 },
    });
  });
});

describe('HealthView history items', () => {
  const ongoing = () => seed({ injuries: [knee()] });

  it('an ongoing injury in the history opens its rehab plan, not an editor', () => {
    ongoing();
    setDesktop(true);
    const { shell } = view({ view: 'history', hist: 'list' });
    const row = [...document.querySelectorAll('.hl-hist button.uirow')].find((r) =>
      r.textContent?.includes(injuryLabel(knee(), en)),
    );
    expect(row).toBeTruthy();
    fireEvent.click(row!);
    expect(shell.openOverlay).toHaveBeenCalledWith({ screen: 'injury', injuryId: 'knee' });
  });

  it('a healed injury opens its edit form', () => {
    seed({ injuries: [knee({ healedDay: D(9, 24) })] });
    setDesktop(true);
    const { shell } = view({ view: 'history', hist: 'list' });
    const row = [...document.querySelectorAll('.hl-hist button.uirow')].find((r) =>
      r.textContent?.includes(injuryLabel(knee(), en)),
    );
    fireEvent.click(row!);
    expect(shell.openOverlay).toHaveBeenCalledWith({
      screen: 'health',
      view: 'history',
      hist: 'list',
      form: { kind: 'edit-injury', injuryId: 'knee' },
    });
  });
});

describe('HealthView sheets', () => {
  const ill = () =>
    seed({
      restPeriods: [
        {
          id: 'ill',
          mode: 'illness',
          startDay: D(9, 24),
          endDay: D(9, 24),
          open: true,
          createdAt: 1,
        } as RestPeriod,
      ],
    });

  it('Escape closes the "I\'m recovered" sheet without ending the illness', () => {
    ill();
    view();
    fireEvent.click(screen.getByText(en.illnessRecovered));
    expect(screen.getByRole('dialog')).toBeTruthy();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(__getStateForTests().restPeriods[0].open).toBe(true);
  });

  it('a click on the dimmed backdrop closes it too', () => {
    ill();
    view();
    fireEvent.click(screen.getByText(en.illnessRecovered));
    fireEvent.click(document.querySelector('.hl-dim') as HTMLElement);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('an illness that started today says so instead of a day count', () => {
    seed({
      restPeriods: [
        {
          id: 'ill',
          mode: 'illness',
          startDay: TODAY,
          endDay: TODAY,
          open: true,
          createdAt: 1,
        } as RestPeriod,
      ],
    });
    view();
    fireEvent.click(screen.getByText(en.illnessRecovered));
    expect(screen.getByText(en.hlRecoveredBodyToday)).toBeTruthy();
  });

  it('the supplements quick-start sheet can be closed with Escape', () => {
    view();
    fireEvent.click(screen.getByText(en.supTitle));
    const sheet = document.querySelector('[role="dialog"], [role="alertdialog"]');
    expect(sheet).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    return vi.waitFor(() =>
      expect(document.querySelector('[role="dialog"], [role="alertdialog"]')).toBeNull(),
    );
  });
});
