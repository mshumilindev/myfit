import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { GoalsView } from './GoalsView';
import { FocusEditor } from './FocusEditor';
import { PhysiquePicker } from './PhysiquePicker';
import { __getStateForTests } from '../store';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { ARCHETYPES } from '../goals';
import { FOCUS_MUSCLES } from '../data/subregions';

const N = FOCUS_MUSCLES.length;
const sum = (g: number, e: number) => `${g} grow · ${e} ease · ${N - g - e} held`;
import { freezeClock, NOW, reseed } from './__fixtures__/viewKit';
import { vi } from 'vitest';

const goals = () => __getStateForTests().goals;

beforeEach(() => {
  freezeClock();
  setLocale('en');
  reseed();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('GoalsView', () => {
  it('shows both empty prompts and no reset button on a blank profile', () => {
    render(<GoalsView />);
    expect(screen.getByText(en.goalsPhysiqueEmpty)).toBeTruthy();
    expect(screen.getByText(en.goalsFocusEmpty)).toBeTruthy();
    expect(screen.queryByRole('button', { name: en.goalsReset })).toBeNull();
    expect(screen.queryByText(en.goalsShapeTitle)).toBeNull();
  });

  it('shows the chosen physique, the focus chips, volume deltas and suggested moves', () => {
    reseed({
      goals: {
        physique: { archetype: 'v-taper', sex: 'male', setAt: NOW },
        focus: {
          label: 'Block 1',
          startedAt: NOW,
          weeks: 6,
          emphasis: { 'delt-side': 'grow', quads: 'ease' },
        },
      },
    });
    const { container } = render(<GoalsView />);
    expect(screen.getByText('V-Taper')).toBeTruthy();
    expect(screen.getByText('Wide shoulders, tight waist')).toBeTruthy();
    expect(screen.getByText(en.emphGrow)).toBeTruthy();
    expect(screen.getByText(en.emphEase)).toBeTruthy();
    expect(screen.getByText(en.goalsShapeTitle)).toBeTruthy();
    // grow rows are +4 over the generic landmark, ease rows are -4
    const deltas = [...container.querySelectorAll('.goals-vol-delta')].map((e) => e.textContent);
    expect(deltas).toContain('+4');
    expect(deltas).toContain('−4');
    expect(container.querySelector('img.goals-physique-fig')?.getAttribute('src')).toBe(
      '/physiques/v-taper-lit.png',
    );
    expect(screen.getByRole('button', { name: en.goalsReset })).toBeTruthy();
  });

  it('opens the physique picker from the empty card and the focus editor from the pencil', () => {
    render(<GoalsView />);
    fireEvent.click(screen.getByText(en.goalsPhysiqueEmpty));
    expect(screen.getByText(en.physUseThis)).toBeTruthy();
    cleanup();
    render(<GoalsView />);
    fireEvent.click(screen.getByRole('button', { name: en.focusTitle }));
    expect(screen.getByText(en.focusSaveBtn)).toBeTruthy();
  });

  it('closing the picker or the focus editor returns to the plain screen', async () => {
    render(<GoalsView />);
    fireEvent.click(screen.getByText(en.goalsPhysiqueEmpty));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByText(en.physUseThis)).toBeNull());
    fireEvent.click(screen.getByText(en.goalsFocusEmpty));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByText(en.focusSaveBtn)).toBeNull());
  });

  it('opens the focus editor from the empty focus card too', () => {
    render(<GoalsView />);
    fireEvent.click(screen.getByText(en.goalsFocusEmpty));
    expect(screen.getByText(en.focusSaveBtn)).toBeTruthy();
  });

  it('"Change" on an existing physique re-opens the picker; the plus button opens it when empty', () => {
    reseed({ goals: { physique: { archetype: 'classic', sex: 'male', setAt: NOW } } });
    render(<GoalsView />);
    fireEvent.click(screen.getByRole('button', { name: en.physChange }));
    expect(screen.getByText(en.physRemove)).toBeTruthy();
    cleanup();
    reseed();
    render(<GoalsView />);
    fireEvent.click(screen.getByRole('button', { name: en.goalsPhysiqueTitle }));
    expect(screen.getByText(en.physIntro)).toBeTruthy();
  });

  it('reset asks first; cancelling keeps goals, confirming wipes them', () => {
    reseed({
      goals: { physique: { archetype: 'classic', sex: 'male', setAt: NOW } },
    });
    render(<GoalsView />);
    fireEvent.click(screen.getByRole('button', { name: en.goalsReset }));
    expect(screen.getByText(en.goalsResetBody)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.cancel }));
    expect(goals().physique?.archetype).toBe('classic');
    expect(screen.queryByText(en.goalsResetBody)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en.goalsReset }));
    const dlg = screen
      .getByText(en.goalsResetBody)
      .closest('[role="dialog"], .dialog, div') as HTMLElement;
    fireEvent.click(
      within(dlg.parentElement as HTMLElement)
        .getAllByRole('button', { name: en.goalsReset })
        .pop() as HTMLElement,
    );
    expect(goals().physique).toBeUndefined();
    expect(screen.getByText(en.goalsPhysiqueEmpty)).toBeTruthy();
  });
});

describe('FocusEditor', () => {
  it('saves the chosen emphasis and closes; "hold" removes the muscle again', () => {
    const onClose = vi.fn();
    render(<FocusEditor onClose={onClose} />);
    expect(screen.getByText(sum(0, 0))).toBeTruthy();
    const side = screen.getByRole('group', { name: en.subMuscleNames['delt-side'] });
    fireEvent.click(within(side).getByRole('button', { name: en.emphGrow }));
    expect(screen.getByText(sum(1, 0))).toBeTruthy();
    fireEvent.click(within(side).getByRole('button', { name: en.emphEase }));
    expect(screen.getByText(sum(0, 1))).toBeTruthy();
    fireEvent.click(within(side).getByRole('button', { name: en.emphHold }));
    expect(screen.getByText(sum(0, 0))).toBeTruthy();
    fireEvent.click(within(side).getByRole('button', { name: en.emphGrow }));
    fireEvent.click(screen.getByRole('button', { name: en.focusSaveBtn }));
    expect(onClose).toHaveBeenCalled();
    expect(goals().focus).toEqual({
      label: 'Block 1',
      startedAt: NOW,
      weeks: 6,
      emphasis: { 'delt-side': 'grow' },
    });
  });

  it('starts from the saved focus, keeps its label/weeks, and Reset clears the draft', () => {
    reseed({
      goals: {
        focus: { label: 'Block 3', startedAt: 123, weeks: 8, emphasis: { lats: 'grow' } },
      },
    });
    render(<FocusEditor onClose={() => undefined} />);
    expect(screen.getByText(sum(1, 0))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.focusReset }));
    expect(screen.getByText(sum(0, 0))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.focusSaveBtn }));
    expect(goals().focus).toEqual({ label: 'Block 3', startedAt: 123, weeks: 8, emphasis: {} });
  });
});

describe('PhysiquePicker', () => {
  it('Use-this is disabled until an archetype is picked, then seeds its grow muscles', () => {
    const onClose = vi.fn();
    render(<PhysiquePicker onClose={onClose} />);
    const use = screen.getByRole('button', { name: en.physUseThis }) as HTMLButtonElement;
    expect(use.disabled).toBe(true);
    fireEvent.click(screen.getByText('V-Taper'));
    expect(use.disabled).toBe(false);
    fireEvent.click(use);
    expect(onClose).toHaveBeenCalled();
    expect(goals().physique).toEqual({ archetype: 'v-taper', sex: 'male', setAt: NOW });
    for (const m of ARCHETYPES['v-taper'].grow) expect(goals().focus?.emphasis[m]).toBe('grow');
  });

  it('lists the female archetypes after switching sex and keeps existing emphasis when seeding', () => {
    reseed({
      goals: { focus: { label: 'B', startedAt: 5, weeks: 4, emphasis: { calves: 'ease' } } },
    });
    render(<PhysiquePicker onClose={() => undefined} />);
    expect(screen.queryByText('Hourglass')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en.sexFemale }));
    fireEvent.click(screen.getByText('Hourglass'));
    fireEvent.click(screen.getByRole('button', { name: en.physUseThis }));
    expect(goals().physique?.sex).toBe('female');
    expect(goals().focus).toMatchObject({
      label: 'B',
      startedAt: 5,
      weeks: 4,
      emphasis: { calves: 'ease', 'delt-side': 'grow', glutes: 'grow' },
    });
  });

  it('locks to the sex stated on the account (no toggle) and offers Remove for an existing target', () => {
    const base = __getStateForTests();
    reseed({
      bodyMetrics: { ...base.bodyMetrics, sex: 'female' },
      goals: { physique: { archetype: 'hourglass', sex: 'female', setAt: 1 } },
    });
    const onClose = vi.fn();
    render(<PhysiquePicker onClose={onClose} />);
    expect(screen.queryByRole('button', { name: en.sexMale })).toBeNull();
    expect(screen.getByText('Glute Focus')).toBeTruthy();
    // hover swaps in the lit figure
    const card = screen.getByText('Glute Focus').closest('button') as HTMLElement;
    fireEvent.mouseEnter(card);
    expect(card.querySelector('img')?.getAttribute('src')).toBe('/physiques/glute-focus-lit.png');
    fireEvent.mouseLeave(card);
    expect(card.querySelector('img')?.getAttribute('src')).toBe('/physiques/glute-focus.png');
    act(() => undefined);
    fireEvent.click(screen.getByRole('button', { name: en.physRemove }));
    expect(onClose).toHaveBeenCalled();
    expect(goals().physique).toBeUndefined();
  });
});
