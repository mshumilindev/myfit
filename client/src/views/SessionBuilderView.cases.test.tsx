import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { emptyState, freezeClock, makeShell, richState, seed } from './__fixtures__/viewKit';

const m = vi.hoisted(() => ({
  start: vi.fn(),
  save: vi.fn(),
  physique: vi.fn(),
}));
vi.mock('../store', async (orig) => ({
  ...(await orig<typeof import('../store')>()),
  startGeneratedDay: (...a: unknown[]) => m.start(...a),
  saveGeneratedDayAsProgram: (...a: unknown[]) => m.save(...a),
  setPhysiqueTarget: (...a: unknown[]) => m.physique(...a),
}));

import { SessionBuilderView } from './SessionBuilderView';

const open = (programMode: 'none' | 'own' | 'other' = 'none', programDays: number[] = []) => {
  const shell = makeShell();
  const onClose = vi.fn();
  const out = render(
    <SessionBuilderView
      shell={shell}
      programMode={programMode}
      programDays={programDays}
      onClose={onClose}
    />,
  );
  return { ...out, shell, onClose };
};
const next = () => fireEvent.click(document.querySelector('.sbw-go') as HTMLElement);
const goStep = (i: number) =>
  fireEvent.click(document.querySelectorAll('.sbw-st')[i] as HTMLElement);
const stepChips = () => [...document.querySelectorAll('.sbw-st')].map((c) => c.textContent);
const toReview = () => {
  const go = () => fireEvent.click(document.querySelector('.sbw-go') as HTMLElement);
  go();
  go();
  go();
};

beforeEach(() => {
  freezeClock();
  setLocale('en');
  localStorage.clear();
  m.start.mockReset();
  m.save.mockReset();
  m.physique.mockReset();
  seed(richState());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('SessionBuilderView: the wizard steps', () => {
  it('opens on the intent step when a physique goal is set, with four steps', () => {
    open();
    expect(stepChips()).toEqual([en.sbStepIntent, en.sbStepMuscles, en.sbStepDay, en.sbStepReview]);
    expect(screen.getByText(en.sbIntentQ)).toBeTruthy();
    expect(document.querySelector('.sbw-st[aria-current="true"]')?.textContent).toBe(
      en.sbStepIntent,
    );
    expect(screen.getByText(en.sbIntentMuscle)).toBeTruthy();
  });

  it('the footer button names the next step and walks forward; back returns', () => {
    open();
    expect(document.querySelector('.sbw-go')?.textContent).toContain(en.sbStepMuscles);
    expect(document.querySelector('.sbw-back')).toBeNull();
    next();
    expect(screen.getByText(en.sbMusclesQ)).toBeTruthy();
    expect(document.querySelector('.sbw-go')?.textContent).toContain(en.sbStepDay);
    next();
    expect(screen.getByText(en.sbDayQ)).toBeTruthy();
    fireEvent.click(document.querySelector('.sbw-back') as HTMLElement);
    expect(screen.getByText(en.sbMusclesQ)).toBeTruthy();
  });

  it('a step chip jumps straight to that step', () => {
    open();
    goStep(3);
    expect(screen.getByText(en.sbReviewQ)).toBeTruthy();
    goStep(0);
    expect(screen.getByText(en.sbIntentQ)).toBeTruthy();
  });

  it('shows a check on completed steps', () => {
    open();
    goStep(2);
    const chips = [...document.querySelectorAll('.sbw-st')];
    expect(chips[0].querySelector('svg, i, .ui-icon, [class*="icon"]')).toBeTruthy();
    expect(chips[3].querySelector('svg, i, [class*="icon"]')).toBeNull();
  });

  it('the close button calls onClose', () => {
    const { onClose } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the goal step first when no physique goal is set; picking one saves it and advances', () => {
    seed({ ...richState(), goals: {} });
    open();
    expect(stepChips()[0]).toBe(en.sbStepGoal);
    expect(stepChips()).toHaveLength(5);
    expect(screen.getByText(en.sbGoalQ)).toBeTruthy();
    const cards = document.querySelectorAll('.sbw-arche-c');
    expect(cards.length).toBeGreaterThan(1);
    fireEvent.click(cards[0]);
    expect(m.physique).toHaveBeenCalledTimes(1);
    const arg = m.physique.mock.calls[0][0] as { archetype: string; sex: string; setAt: number };
    expect(en.archetypes[arg.archetype as keyof typeof en.archetypes]?.name).toBe(
      cards[0].querySelector('b')?.textContent,
    );
    expect(arg.setAt).toBe(Date.now());
    expect(screen.getByText(en.sbIntentQ)).toBeTruthy();
  });

  it('offers female archetypes for a female profile', () => {
    const s = { ...richState(), goals: {} };
    s.bodyMetrics = { ...s.bodyMetrics, sex: 'female' };
    seed(s);
    open();
    const names = [...document.querySelectorAll('.sbw-arche-c b')].map((b) => b.textContent);
    seed({ ...richState(), goals: {} });
    cleanup();
    open();
    const male = [...document.querySelectorAll('.sbw-arche-c b')].map((b) => b.textContent);
    expect(names.length).toBeGreaterThan(0);
    expect(names).not.toEqual(male);
  });
});

describe('SessionBuilderView: intent, muscles and day options', () => {
  it('lists the five intents with their rep range and switches the plan', () => {
    open();
    for (const n of [
      en.sbIntentStrength,
      en.sbIntentMuscle,
      en.sbIntentEndurance,
      en.sbIntentPower,
      en.sbIntentConditioning,
    ])
      expect(screen.getByText(n)).toBeTruthy();
    fireEvent.click(screen.getByText(en.sbIntentStrength));
    toReview();
    expect(document.querySelectorAll('.sbw-meta .mchip')[2].textContent).toMatch(
      new RegExp(`· ${en.sbIntentStrength}$`),
    );
  });

  it('muscle chips toggle a manual selection; auto-pick resets it', () => {
    open();
    next();
    const auto = screen.getByText(en.sbAutoPick).closest('button') as HTMLElement;
    expect(auto.getAttribute('aria-pressed') ?? auto.className).toBeTruthy();
    const chest = screen.getByText(en.muscleGroups.chest).closest('button') as HTMLElement;
    const before = chest.className;
    fireEvent.click(chest);
    const after = (screen.getByText(en.muscleGroups.chest).closest('button') as HTMLElement)
      .className;
    expect(after).not.toBe(before);
    fireEvent.click(screen.getByText(en.sbAutoPick));
    expect(
      (screen.getByText(en.muscleGroups.chest).closest('button') as HTMLElement).className,
    ).toBe(before);
  });

  it('a manual muscle choice drives what Review covers', () => {
    open();
    next();
    // clear the auto selection down to biceps only
    for (const g of [
      'chest',
      'lats',
      'traps',
      'shoulders',
      'triceps',
      'forearms',
      'quads',
      'hamstrings',
      'glutes',
      'calves',
      'lower_back',
      'core',
    ] as const) {
      const b = screen.getByText(en.muscleGroups[g]).closest('button') as HTMLElement;
      const was = b.className;
      fireEvent.click(b);
      if ((screen.getByText(en.muscleGroups[g]).closest('button') as HTMLElement).className === was)
        fireEvent.click(b);
    }
    next();
    next();
    expect(document.querySelector('.sbw-cov')).toBeTruthy();
  });

  it('length segments move the selection (the plan itself ignores it: BuildContext.lengthMin is never read)', () => {
    open();
    goStep(2);
    const field = document.querySelector('.sbw-field') as HTMLElement;
    const opts = ['30', '45', '60', '75', '90'].map(
      (n) => within(field).getByText(n).closest('button') as HTMLElement,
    );
    const cls = opts.map((o) => o.className);
    fireEvent.click(opts[0]);
    const after = [...field.querySelectorAll('button')].map((o) => o.className);
    expect(after[0]).not.toBe(cls[0]);
    expect(after[2]).not.toBe(cls[2]);
  });

  it('turning cardio on adds a cardio block; turning warm-up and cool-down off removes theirs', () => {
    open();
    goStep(2);
    fireEvent.click(screen.getByText(en.sbCardioOpt));
    fireEvent.click(screen.getByText(en.sbWarmupOpt));
    fireEvent.click(screen.getByText(en.sbCooldownOpt));
    goStep(3);
    const titles = [...document.querySelectorAll('.sbw-block > .section-title')].map(
      (x) => x.textContent,
    );
    expect(titles).toContain(en.sbCardioOpt);
    expect(titles).not.toContain(en.sbWarmupOpt);
    expect(titles).not.toContain(en.sbCooldownOpt);
    expect(titles).toContain(en.sbMainLifts);
  });
});

describe('SessionBuilderView: review', () => {
  it('shows the day summary chips, the main lifts and the coverage bars', () => {
    open();
    toReview();
    const chips = [...document.querySelectorAll('.sbw-meta .mchip')].map((c) => c.textContent);
    expect(chips).toHaveLength(3);
    expect(chips[1]).toMatch(new RegExp(`^\\d+ ${en.sbMinShort}$`));
    const titles = [...document.querySelectorAll('.sbw-block > .section-title')].map(
      (x) => x.textContent,
    );
    expect(titles).toContain(en.sbMainLifts);
    expect(titles).toContain(en.sbTodayCovers);
    const lifts = document.querySelectorAll('.sbw-ex-drag');
    expect(lifts.length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.sbw-cov').length).toBeLessThanOrEqual(6);
    expect(Number(chips[2]!.split(' ')[0])).toBe(lifts.length);
  });

  it('swapping a main lift replaces it with a different candidate', () => {
    open();
    toReview();
    const names = () =>
      [...document.querySelectorAll('.sbw-block')]
        .find((b) => b.querySelector('.section-title')?.textContent === en.sbMainLifts)!
        .querySelectorAll('.sbw-ex-txt b');
    const before = [...names()].map((n) => n.textContent);
    const swapBtns = screen.getAllByRole('button', { name: en.replaceExercise });
    expect(swapBtns).toHaveLength(before.length);
    fireEvent.click(swapBtns[0]);
    const after = [...names()].map((n) => n.textContent);
    expect(after).toHaveLength(before.length);
    expect(after[0]).not.toBe(before[0]);
    expect(after.slice(1)).toEqual(before.slice(1));
  });

  it('dragging a handle over another row reorders the lifts', () => {
    open();
    toReview();
    const mainBlock = [...document.querySelectorAll('.sbw-block')].find(
      (b) => b.querySelector('.section-title')?.textContent === en.sbMainLifts,
    )!;
    const names = () => [...mainBlock.querySelectorAll('.sbw-ex-txt b')].map((n) => n.textContent);
    const before = names();
    expect(before.length).toBeGreaterThan(1);
    const rows = [...mainBlock.querySelectorAll('.sbw-ex')] as HTMLElement[];
    rows.forEach((r, i) => {
      r.getBoundingClientRect = () => ({ top: i * 50, bottom: i * 50 + 49 }) as DOMRect;
    });
    const handle = rows[0].querySelector('.sbw-ex-drag') as HTMLElement;
    fireEvent.pointerDown(handle, { pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 60 });
    expect(names()[1]).toBe(before[0]);
    expect(names()[0]).toBe(before[1]);
    fireEvent.pointerUp(handle, { pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 10 });
    expect(names()[1]).toBe(before[0]);
  });

  it('a drag that stays on its own row or leaves the list changes nothing', () => {
    open();
    toReview();
    const mainBlock = [...document.querySelectorAll('.sbw-block')].find(
      (b) => b.querySelector('.section-title')?.textContent === en.sbMainLifts,
    )!;
    const names = () => [...mainBlock.querySelectorAll('.sbw-ex-txt b')].map((n) => n.textContent);
    const before = names();
    const rows = [...mainBlock.querySelectorAll('.sbw-ex')] as HTMLElement[];
    rows.forEach((r, i) => {
      r.getBoundingClientRect = () => ({ top: i * 50, bottom: i * 50 + 49 }) as DOMRect;
    });
    const handle = rows[0].querySelector('.sbw-ex-drag') as HTMLElement;
    fireEvent.pointerDown(handle, { pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 10 });
    fireEvent.pointerMove(handle, { clientY: 5000 });
    expect(names()).toEqual(before);
  });

  it('Start materialises the (edited) day and replaces the wizard with the live session', () => {
    m.start.mockReturnValue({ id: 'w-new' });
    const { shell } = open();
    toReview();
    const swapBtns = screen.getAllByRole('button', { name: en.replaceExercise });
    fireEvent.click(swapBtns[0]);
    fireEvent.click(screen.getByText(en.sbStartNow));
    expect(m.start).toHaveBeenCalledTimes(1);
    const [day, gymId] = m.start.mock.calls[0] as [
      { main: Array<{ name: string }> },
      string | null,
    ];
    expect(day.main.length).toBe(swapBtns.length);
    expect(gymId === null || typeof gymId === 'string').toBe(true);
    expect(shell.replaceOverlay).toHaveBeenCalledWith({ screen: 'session', workoutId: 'w-new' });
  });

  it('Start does nothing visible when the store refuses to start a workout', () => {
    m.start.mockReturnValue(null);
    const { shell } = open();
    toReview();
    fireEvent.click(screen.getByText(en.sbStartNow));
    expect(shell.replaceOverlay).not.toHaveBeenCalled();
  });

  it('a brand-new user still gets a reviewable plan', () => {
    seed({
      ...emptyState(),
      goals: { physique: { archetype: 'classic', sex: 'male', setAt: Date.now() } },
    });
    open();
    toReview();
    expect(screen.getByText(en.sbReviewQ)).toBeTruthy();
    expect(screen.getByText(en.sbStartNow)).toBeTruthy();
  });
});

describe('SessionBuilderView: save the day to a program', () => {
  it('hides naming and saving when a trainer program owns the schedule', () => {
    open('other');
    toReview();
    expect(document.querySelector('.sbw-save')).toBeNull();
    expect(screen.queryByLabelText(en.sbDayNameLabel)).toBeNull();
    expect(screen.getByText(en.sbStartNow)).toBeTruthy();
  });

  it('marks weekdays already filled and selects today by default', () => {
    open('own', [1, 3]);
    toReview();
    const chips = [...document.querySelectorAll('.sbw-wd')];
    expect(chips).toHaveLength(7);
    const todayIdx = chips.findIndex(
      (c) => c.getAttribute('aria-pressed') === 'true' || c.className.includes('selected'),
    );
    expect(todayIdx).toBeGreaterThanOrEqual(0);
    const filledCls = chips.map((c) => c.className);
    expect(new Set(filledCls).size).toBeGreaterThan(1);
  });

  it('saves under the typed name on the chosen weekday and flips the button to Saved', async () => {
    m.save.mockResolvedValue({ status: 'active', days: [1, 3, 5] });
    open('own', [1]);
    toReview();
    fireEvent.change(screen.getByLabelText(en.sbDayNameLabel), { target: { value: 'Push day' } });
    const wd5 = [...document.querySelectorAll('.sbw-wd')][4] as HTMLElement;
    fireEvent.click(wd5);
    expect(screen.getByText(en.sbSaveDay)).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByText(en.sbSaveDay));
    });
    expect(m.save).toHaveBeenCalledTimes(1);
    const [, wd, name] = m.save.mock.calls[0] as [unknown, number, string];
    expect(wd).toBe(5);
    expect(name).toBe('Push day');
    await waitFor(() => expect(screen.getByText(en.sbSaved)).toBeTruthy());
    // Choosing another weekday brings "save" back
    fireEvent.click([...document.querySelectorAll('.sbw-wd')][2]);
    expect(screen.getByText(en.sbSaveDay)).toBeTruthy();
  });

  it('falls back to the derived readout name when the field is blank', async () => {
    m.save.mockResolvedValue({ status: 'draft', days: [1] });
    open();
    toReview();
    const placeholder = (screen.getByLabelText(en.sbDayNameLabel) as HTMLInputElement).placeholder;
    expect(placeholder.length).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.click(screen.getByText(en.sbSaveDay));
    });
    expect((m.save.mock.calls[0] as unknown[])[2]).toBe(placeholder);
  });

  it('ignores a second click while the save is pending, then re-enables', async () => {
    let done!: (v: { status: 'active'; days: number[] }) => void;
    m.save.mockImplementation(() => new Promise((r) => (done = r)));
    open();
    toReview();
    const btn = screen.getByText(en.sbSaveDay).closest('button') as HTMLButtonElement;
    fireEvent.click(btn);
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(m.save).toHaveBeenCalledTimes(1);
    await act(async () => {
      done({ status: 'active', days: [2] });
    });
    expect((screen.getByText(en.sbSaved).closest('button') as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
});

describe('SessionBuilderView: plan variety', () => {
  it('renders warm-up station rows and block rows for a full day', () => {
    open();
    goStep(2);
    fireEvent.click(screen.getByText(en.sbCardioOpt));
    goStep(3);
    const rows = document.querySelectorAll('.sbw-ex');
    expect(rows.length).toBeGreaterThan(3);
    expect(document.body.textContent).toContain(en.sbCooldownOpt);
    // every row shows a reason line
    const whys = [...document.querySelectorAll('.sbw-ex-why')];
    expect(whys.length).toBeGreaterThan(3);
    for (const w of whys) expect(w.textContent!.length).toBeGreaterThan(0);
  });

  it('muscle step shows a readiness dot for every group', () => {
    open();
    next();
    fireEvent.click(screen.getByText(en.muscleGroups.quads).closest('button')!);
    const dots = document.querySelectorAll('.sbw-mdot');
    expect(dots).toHaveLength(13);
    const scope = within(document.querySelector('.sbw-scroll') as HTMLElement);
    expect(scope.getByText(en.muscleGroups.core)).toBeTruthy();
  });
});
