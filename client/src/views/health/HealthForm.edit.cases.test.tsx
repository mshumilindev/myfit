import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { setLocale } from '../../i18n';
import { en } from '../../i18n/en';
import { __getStateForTests, dayKey } from '../../store';
import type { Injury, RestPeriod, Workout } from '../../types';
import type { HealthFormSpec } from '../../health';
import { DAY, NOW, emptyState, freezeClock, history, seed } from '../__fixtures__/viewKit';
import { HealthForm } from './HealthForm';

const T = dayKey(NOW);
function form(spec: HealthFormSpec, opts: { web?: boolean; presentation?: 'page' | 'sheet' } = {}) {
  const fns = { onCancel: vi.fn(), onDone: vi.fn(), onRehab: vi.fn() };
  const r = render(
    <HealthForm
      spec={spec}
      now={NOW}
      web={opts.web ?? false}
      presentation={opts.presentation}
      {...fns}
    />,
  );
  return { ...r, ...fns };
}
const row = (label: string | RegExp) =>
  [...document.querySelectorAll<HTMLElement>('.uirow')].find((r) => {
    const l = (r.querySelector('.uirow-l') ?? r.querySelector('.uirow-action'))?.textContent ?? '';
    return typeof label === 'string' ? l === label : label.test(l);
  }) as HTMLElement;
const click = (el: HTMLElement | null | undefined) => fireEvent.click(el as HTMLElement);
const primary = () => document.querySelector('.uiab-acts .uibtn--primary') as HTMLButtonElement;
const cancel = () => document.querySelector('.uiab-acts .uibtn--secondary') as HTMLButtonElement;
const day = (n: number) =>
  [...document.querySelectorAll(`.uical-grid [data-day="${n}"]`)].pop() as HTMLElement;
const periods = () => __getStateForTests().restPeriods;
const injuries = () => __getStateForTests().injuries;
const rest = (over: Partial<RestPeriod> = {}): RestPeriod =>
  ({
    id: 'p1',
    mode: 'off',
    startDay: T - 20,
    endDay: T - 15,
    createdAt: NOW - 25 * DAY,
    name: 'Trip',
    ...over,
  }) as RestPeriod;
const hurt = (over: Partial<Injury> = {}): Injury =>
  ({
    id: 'i1',
    reason: 'injury',
    bodyPart: 'knee',
    side: 'left',
    muscles: ['quads'],
    stage: 'reintroduce',
    startDay: T - 5,
    createdAt: NOW - 5 * DAY,
    checkins: [],
    healedDay: null,
    ...over,
  }) as Injury;
const workoutOn = (d: number, id: string, name = 'Push'): Workout =>
  ({
    ...history(1)[0],
    id,
    startedAt: d * DAY + 15 * 3600_000,
    finishedAt: d * DAY + 16 * 3600_000,
    dayName: name,
  }) as Workout;

beforeEach(() => {
  freezeClock(NOW);
  setLocale('en');
  seed(emptyState());
});
afterEach(cleanup);

describe('HealthForm: edit a period', () => {
  const edit: HealthFormSpec = { kind: 'edit', periodId: 'p1' };

  it('opens with its values; Save waits for a change, and a type choice excludes injury', () => {
    seed({ ...emptyState(), restPeriods: [rest()] });
    const { onCancel } = form(edit);
    expect(document.querySelector('.uipagehead')?.textContent).toContain(en.hlEditPeriod);
    expect((screen.getByLabelText(en.hlName) as HTMLInputElement).value).toBe('Trip');
    expect(primary().textContent).toBe(en.hlSaveChanges);
    expect(primary().disabled).toBe(true);
    expect(screen.queryByText(en.hlWhatItDoes)).toBeNull();
    click(row(en.hlType));
    expect(screen.queryByText(en.hlFilter.injury, { selector: '.uirow-l' })).toBeNull();
    expect(screen.getByText(en.restModeIllness, { selector: '.uirow-l' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    click(cancel());
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('a renamed period is saved in place and the form closes', () => {
    seed({ ...emptyState(), restPeriods: [rest()] });
    const { onDone } = form(edit);
    fireEvent.change(screen.getByLabelText(en.hlName), { target: { value: 'Ski trip' } });
    expect(primary().disabled).toBe(false);
    click(primary());
    expect(periods()).toHaveLength(1);
    expect(periods()[0]).toMatchObject({
      id: 'p1',
      name: 'Ski trip',
      startDay: T - 20,
      endDay: T - 15,
    });
    expect(onDone).toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(en.hlName), { target: { value: 'Trip' } });
    expect(primary().disabled).toBe(true);
  });

  it('turning an edit into an illness shows the kind and keeps it', () => {
    seed({
      ...emptyState(),
      restPeriods: [rest({ mode: 'illness', illnessKind: 'virus', name: null })],
    });
    form(edit);
    expect(screen.getByText(en.illHintVirus)).toBeTruthy();
    click(screen.getByText(en.illKindStomach));
    expect(primary().disabled).toBe(false);
    click(primary());
    expect(periods()[0].illnessKind).toBe('stomach');
  });

  it('an open illness is edited as "until better" and can be closed with a date', () => {
    seed({
      ...emptyState(),
      restPeriods: [
        rest({ mode: 'illness', startDay: T - 3, endDay: T - 3, open: true, name: null }),
      ],
    });
    form(edit);
    const sw = within(row(en.hlStillOngoing)).getByRole('switch') as HTMLInputElement;
    expect(sw.checked).toBe(true);
    click(sw);
    expect(primary().disabled).toBe(false);
    click(primary());
    expect(periods()[0].open).toBe(false);
  });

  it('the length line follows what is being edited', () => {
    seed({ ...emptyState(), restPeriods: [rest()] });
    form(edit);
    expect(screen.getByText(en.hlLenEdit(6))).toBeTruthy();
    click(row(en.hlStarted));
    expect(document.querySelector('.uical-grid')).not.toBeNull();
    expect(screen.getByText(en.hlLenPast(6) + ' ' + en.hlGoldDot)).toBeTruthy();
  });

  it('workouts inside the edited full rest can be kept or removed one by one', () => {
    seed({
      ...emptyState(),
      restPeriods: [rest()],
      workouts: [workoutOn(T - 18, 'w1'), workoutOn(T - 17, 'w2', 'Pull')],
    });
    form(edit);
    expect(screen.getByText(en.hlOverlapN(2))).toBeTruthy();
    const wRow = (n: string) => row(new RegExp(` · ${n}$`));
    expect(wRow('Push').textContent).toContain(en.hlKept);
    click(wRow('Push'));
    expect(wRow('Push').textContent).toContain(en.hlRemovedVal);
    click(wRow('Pull'));
    click(wRow('Pull'));
    expect(wRow('Pull').textContent).toContain(en.hlKept);
    click(primary());
    expect(__getStateForTests().workouts.map((w) => w.id)).toEqual(['w2']);
  });
});

describe('HealthForm: delete', () => {
  it('asks inline with the range and length; "Keep it" closes the question, Delete removes the period', () => {
    seed({ ...emptyState(), restPeriods: [rest()] });
    const { onDone } = form({ kind: 'edit', periodId: 'p1' });
    click(row(en.hlDeletePeriod));
    expect(document.body.textContent).toContain(en.hlDeleteBody('Trip', '', 6).slice(0, 12));
    click(screen.getByRole('button', { name: en.hlKeepIt }));
    expect(screen.queryByRole('button', { name: en.hlKeepIt })).toBeNull();
    expect(periods()).toHaveLength(1);
    click(row(en.hlDeletePeriod));
    click(
      within(document.querySelector('.hl-cexp') as HTMLElement).getByRole('button', {
        name: en.delete,
      }),
    );
    expect(periods()).toHaveLength(0);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('a full rest with a workout in it says the workout stays', () => {
    seed({ ...emptyState(), restPeriods: [rest()], workouts: [workoutOn(T - 18, 'w1')] });
    form({ kind: 'edit', periodId: 'p1' });
    click(row(en.hlDeletePeriod));
    expect(document.querySelector('.hl-cexp p')?.textContent).toMatch(/kept|stay|workout/i);
  });

  it('an injury is deleted with the injury wording', () => {
    seed({ ...emptyState(), injuries: [hurt()] });
    const { onDone } = form({ kind: 'edit-injury', injuryId: 'i1' });
    click(row(en.hlDeleteInjury));
    click(
      within(document.querySelector('.hl-cexp') as HTMLElement).getByRole('button', {
        name: en.delete,
      }),
    );
    expect(injuries()).toHaveLength(0);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('HealthForm: the injury form', () => {
  const newInjury = { kind: 'new', ctx: 'start', type: 'injury' } as HealthFormSpec;

  it('asks where first: nothing can be continued until a body part is chosen', () => {
    form(newInjury);
    expect(primary().textContent).toBe(en.hlContinueRehab);
    expect(primary().disabled).toBe(true);
    expect(row(en.hlBodyPart).textContent).toContain('—');
    click(screen.getByRole('button', { name: en.injBodyParts.knee }));
    expect(primary().disabled).toBe(false);
    expect(row(en.hlBodyPart).textContent).toContain(en.injBodyParts.knee);
  });

  it('"Continue" hands the part, side and day to the rehab flow without saving anything', () => {
    const { onRehab } = form(newInjury);
    click(screen.getByRole('button', { name: en.injBodyParts.shoulder }));
    click(screen.getByRole('button', { name: en.injSide.right }));
    click(screen.getByRole('button', { name: en.hlPreset.twoDaysAgo }));
    click(primary());
    expect(onRehab).toHaveBeenCalledWith({ bodyPart: 'shoulder', side: 'right', startDay: T - 2 });
    expect(injuries()).toHaveLength(0);
  });

  it('the rehab-plan row does the same as the button', () => {
    const { onRehab } = form(newInjury);
    click(screen.getByRole('button', { name: en.injBodyParts.knee }));
    click(row(en.hlRehabPlan));
    expect(onRehab).toHaveBeenCalledTimes(1);
  });

  it('already healed: it logs a finished injury instead and the footer names the range', () => {
    const { onDone, onRehab } = form(newInjury);
    click(screen.getByRole('button', { name: en.injBodyParts.knee }));
    click(row(en.hlHealed));
    expect(primary().textContent).toBe(en.hlSaveInjury);
    expect(row(en.hlRehabPlan)).toBeUndefined();
    click(screen.getByRole('button', { name: en.hlPreset.weekAgo }));
    click(day(T - 3));
    click(primary());
    expect(onRehab).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(injuries()).toHaveLength(1);
    expect(injuries()[0]).toMatchObject({ bodyPart: 'knee', startDay: T - 7, healedDay: T - 3 });
  });

  it('a heal date before the start is an error and blocks saving; "still healing" clears it', () => {
    form(newInjury);
    click(screen.getByRole('button', { name: en.injBodyParts.knee }));
    click(screen.getByRole('button', { name: en.hlPreset.weekAgo }));
    click(row(en.hlHealed));
    click(day(T - 1));
    expect(primary().disabled).toBe(false);
    click(screen.getByRole('button', { name: en.hlPreset.today }));
    expect(
      document.querySelector('.uigl-f.err, [class*="uigl-f"][class*="err"], .uigl-f')?.textContent,
    ).toContain(en.hlErr['healed-before-start']);
    expect(primary().disabled).toBe(true);
    click(row(en.hlStillHealing));
    expect(primary().textContent).toBe(en.hlContinueRehab);
    expect(primary().disabled).toBe(false);
  });

  it('editing an injury loads it, offers no type change, and saves only after a change', () => {
    seed({ ...emptyState(), injuries: [hurt({ healedDay: T - 1 })] });
    const { onDone } = form({ kind: 'edit-injury', injuryId: 'i1' });
    expect(document.querySelector('.uipagehead')?.textContent).toContain(en.hlEditInjury);
    expect(row(en.hlType).querySelector('.uirow-chev, [class*="chev"]')).toBeNull();
    expect(primary().textContent).toBe(en.hlSaveChanges);
    expect(primary().disabled).toBe(true);
    click(screen.getByRole('button', { name: en.injSide.both }));
    expect(primary().disabled).toBe(false);
    click(primary());
    expect(injuries()[0]).toMatchObject({ id: 'i1', side: 'both', healedDay: T - 1 });
    expect(onDone).toHaveBeenCalled();
  });

  it('an injury whose body part is unknown to the list asks for one again', () => {
    seed({ ...emptyState(), injuries: [hurt({ bodyPart: 'not-a-part' })] });
    form({ kind: 'edit-injury', injuryId: 'i1' });
    expect(row(en.hlBodyPart).textContent).toContain('—');
    expect(document.querySelector('.uichipgroup, [role="group"]')).not.toBeNull();
  });
});

describe('HealthForm: presentation', () => {
  it('on the web it is a titled panel with a subtitle and a close button', () => {
    const { onCancel } = form({ kind: 'new', ctx: 'past', type: 'illness' }, { web: true });
    const panel = document.querySelector('section.hl-panel') as HTMLElement;
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.querySelector('#hl-p-t')?.textContent).toBe(en.hlWasUnwell);
    expect(panel.textContent).toContain(en.hlPanelSub['past-illness']);
    expect(document.querySelectorAll('.hl-pcol')).toHaveLength(2);
    click(screen.getByRole('button', { name: en.close }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('the web panel of an edit names the period, its kind and its range', () => {
    seed({ ...emptyState(), restPeriods: [rest()] });
    form({ kind: 'edit', periodId: 'p1' }, { web: true });
    expect(document.querySelector('.hl-phead .t span')?.textContent).toContain('Trip');
    expect(document.querySelector('.hl-phead .t span')?.textContent).toContain(en.hlFullRest);
  });

  it('the web panel of an injury edit names the injury', () => {
    seed({ ...emptyState(), injuries: [hurt()] });
    form({ kind: 'edit-injury', injuryId: 'i1' }, { web: true });
    expect(document.querySelector('.hl-phead .t span')?.textContent).toBeTruthy();
    expect(document.querySelectorAll('.hl-pcol')).toHaveLength(2);
  });

  it('in a sheet it is a drawer that closes with Escape', async () => {
    const { onCancel } = form(
      { kind: 'new', ctx: 'start', type: 'off' },
      { presentation: 'sheet' },
    );
    expect(document.querySelector('.hl-drawer h1')?.textContent).toBe(en.hlFullRest);
    expect(document.querySelector('.uipagehead')).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    await vi.waitFor(() => expect(onCancel).toHaveBeenCalled());
  });

  it('a form for something that no longer exists still renders an empty, harmless page', () => {
    form({ kind: 'edit', periodId: 'gone' });
    expect(primary().disabled).toBe(true);
    expect(row(en.hlDeletePeriod)).toBeUndefined();
  });
});
