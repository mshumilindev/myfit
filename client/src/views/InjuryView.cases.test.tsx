import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { BODY_PARTS } from '../injury';
import { dayKey } from '../store';
import type { Injury } from '../types';
import {
  DAY,
  emptyState,
  freezeClock,
  NOW,
  richState,
  seed,
  setDesktop,
} from './__fixtures__/viewKit';

const m = vi.hoisted(() => ({
  start: vi.fn(),
  checkin: vi.fn(),
  advance: vi.fn(),
  dismiss: vi.fn(),
  heal: vi.fn(),
  del: vi.fn(),
}));
vi.mock('../store', async (orig) => ({
  ...(await orig<typeof import('../store')>()),
  startInjury: (...a: unknown[]) => m.start(...a),
  logRehabCheckin: (...a: unknown[]) => m.checkin(...a),
  advanceInjury: (...a: unknown[]) => m.advance(...a),
  dismissAdvance: (...a: unknown[]) => m.dismiss(...a),
  healInjury: (...a: unknown[]) => m.heal(...a),
  deleteInjury: (...a: unknown[]) => m.del(...a),
}));

import { InjuryView } from './InjuryView';

const TODAY = dayKey(NOW);
const inj = (over: Partial<Injury> = {}): Injury => ({
  ...richState().injuries[0],
  ...over,
});
const withInjuries = (...list: Injury[]) => seed({ ...richState(), injuries: list });
const open = (props: Partial<React.ComponentProps<typeof InjuryView>> = {}) => {
  const onClose = vi.fn();
  const out = render(<InjuryView onClose={onClose} {...props} />);
  return { ...out, onClose };
};
const dlg = () => document.querySelector('[role="alertdialog"], [role="dialog"]') as HTMLElement;
const back = () => fireEvent.click(screen.getByRole('button', { name: en.backAction }));
const stepLabels = () => [...document.querySelectorAll('.step .s')].map((s) => s.className);

beforeEach(() => {
  freezeClock(NOW);
  setLocale('en');
  setDesktop(false);
  Object.values(m).forEach((f) => f.mockReset());
  m.start.mockImplementation((a: Partial<Injury>) => ({ id: 'new-1', ...a }));
  seed(emptyState());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('InjuryView setup: where it hurts', () => {
  it('opens on the body-part picker when nothing is active, with the next button disabled', () => {
    open();
    expect(screen.getByText(en.injWhereHint)).toBeTruthy();
    expect(
      document.querySelectorAll('.chips .ui-chip, .chips button').length,
    ).toBeGreaterThanOrEqual(BODY_PARTS.length);
    const next = screen.getByText(en.injNextFeel).closest('button') as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    expect(stepLabels()[0]).toContain('on');
  });

  it('choosing a part reveals the side, the protected muscles and enables Next', () => {
    open();
    fireEvent.click(screen.getByText(en.injBodyParts.knee));
    expect(screen.getByText(en.injGoodToKnow)).toBeTruthy();
    expect(screen.getByText(en.injMuscleDeriveHint)).toBeTruthy();
    const muscles = [...document.querySelectorAll('.chip.mus')].map((c) => c.textContent);
    expect(muscles.length).toBeGreaterThan(0);
    expect(muscles).toContain(en.muscleGroups.quads);
    expect((screen.getByText(en.injNextFeel).closest('button') as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect(screen.getByText(en.injSide.left)).toBeTruthy();
    expect(screen.getByText(en.injSide.both)).toBeTruthy();
  });

  it('close on the first step leaves the flow', () => {
    const { onClose } = open();
    back();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('"Something else" goes to the general reasons and Back returns', () => {
    open();
    fireEvent.click(screen.getByText(en.injGeneralHatch));
    expect(screen.getByText(en.injGeneralHint)).toBeTruthy();
    expect(screen.getByText(en.injGeneralTitle)).toBeTruthy();
    back();
    expect(screen.getByText(en.injWhereHint)).toBeTruthy();
  });
});

describe('InjuryView setup: how it feels, clinician window, commit', () => {
  const pickKnee = (side?: 'right' | 'both') => {
    fireEvent.click(screen.getByText(en.injBodyParts.knee));
    if (side) fireEvent.click(screen.getByText(en.injSide[side]));
    fireEvent.click(screen.getByText(en.injNextFeel));
  };

  it('the feel screen defaults to "sore" and each answer maps to a stage', () => {
    open();
    pickKnee();
    expect(screen.getByText(en.injFeelTitle)).toBeTruthy();
    expect(stepLabels()[0]).toContain('done');
    expect(screen.getByText(en.injStage.protect)).toBeTruthy();
    fireEvent.click(screen.getByText(en.injFeel.almost));
    fireEvent.click(screen.getByText(en.injNext));
    fireEvent.click(screen.getByText(en.injSeePlan));
    expect(m.start).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'injury',
        bodyPart: 'knee',
        side: 'left',
        stage: 'rebuild',
        fullRestUntil: null,
      }),
    );
  });

  it('"can\'t move it" starts in Protect and the chosen side is recorded', () => {
    open();
    pickKnee('right');
    fireEvent.click(screen.getByText(en.injFeel.cant));
    fireEvent.click(screen.getByText(en.injNext));
    fireEvent.click(screen.getByText(en.injSeePlan));
    expect(m.start).toHaveBeenCalledWith(
      expect.objectContaining({ side: 'right', stage: 'protect' }),
    );
  });

  it('the default feel starts in Reintroduce with the derived muscles', () => {
    open();
    pickKnee();
    fireEvent.click(screen.getByText(en.injNext));
    fireEvent.click(screen.getByText(en.injSeePlan));
    const arg = m.start.mock.calls[0][0];
    expect(arg.stage).toBe('reintroduce');
    expect(arg.muscles).toContain('quads');
    expect(arg.startDay).toBeUndefined();
  });

  it('a clinician no-load window starts in Protect and ends after amount x unit days', () => {
    open();
    pickKnee();
    fireEvent.click(screen.getByText(en.injNext));
    expect(screen.getByText(en.injClinicianHint)).toBeTruthy();
    expect(screen.queryByText(en.injTfHowLong)).toBeNull();
    fireEvent.click(screen.getByText(en.injTfYes));
    expect(screen.getByText(en.injTfHowLong)).toBeTruthy();
    expect(screen.getByText(en.injClinicianRule)).toBeTruthy();
    fireEvent.click(screen.getByText(en.injSeePlan));
    expect(m.start.mock.calls[0][0]).toMatchObject({
      stage: 'protect',
      fullRestUntil: TODAY + 6 * 7,
    });
  });

  it('switching the unit changes the multiplier (days, months)', () => {
    open();
    pickKnee();
    fireEvent.click(screen.getByText(en.injNext));
    fireEvent.click(screen.getByText(en.injTfYes));
    fireEvent.click(screen.getByText(en.injUnit.days));
    fireEvent.click(screen.getByText(en.injSeePlan));
    expect(m.start.mock.calls[0][0].fullRestUntil).toBe(TODAY + 6);
    cleanup();
    m.start.mockClear();
    open();
    pickKnee();
    fireEvent.click(screen.getByText(en.injNext));
    fireEvent.click(screen.getByText(en.injTfYes));
    fireEvent.click(screen.getByText(en.injUnit.months));
    fireEvent.click(screen.getByText(en.injSeePlan));
    expect(m.start.mock.calls[0][0].fullRestUntil).toBe(TODAY + 6 * 30);
  });

  it('going back to "no timeframe" clears the window', () => {
    open();
    pickKnee();
    fireEvent.click(screen.getByText(en.injNext));
    fireEvent.click(screen.getByText(en.injTfYes));
    fireEvent.click(screen.getByText(en.injTfNo));
    expect(screen.queryByText(en.injTfHowLong)).toBeNull();
    fireEvent.click(screen.getByText(en.injSeePlan));
    expect(m.start.mock.calls[0][0].fullRestUntil).toBeNull();
  });

  it('the step number of the stepper tracks the flow and Back walks it in reverse', () => {
    open();
    pickKnee();
    expect(screen.getByText(en.injFeelTitle)).toBeTruthy();
    back();
    expect(screen.getByText(en.injWhereHint)).toBeTruthy();
    pickKnee();
    fireEvent.click(screen.getByText(en.injNext));
    expect(screen.getByText(en.injClinicianTitle)).toBeTruthy();
    back();
    expect(screen.getByText(en.injFeelTitle)).toBeTruthy();
  });

  it('after committing, the plan of the new injury is shown', () => {
    open();
    pickKnee();
    fireEvent.click(screen.getByText(en.injNext));
    m.start.mockImplementation((a: Partial<Injury>) => {
      const created = inj({ ...a, id: 'new-1', stage: 'reintroduce' } as Partial<Injury>);
      withInjuries(created);
      return created;
    });
    fireEvent.click(screen.getByText(en.injSeePlan));
    expect(screen.getByText(en.injPlanTitle(en.injBodyParts.knee))).toBeTruthy();
  });
});

describe('InjuryView setup: the general branch', () => {
  const general = () => {
    open();
    fireEvent.click(screen.getByText(en.injGeneralHatch));
  };

  it('lists the general reasons with surgery preselected and goes on to the clinician window', () => {
    general();
    for (const r of ['surgery', 'illness', 'break', 'cautious'] as const)
      expect(screen.getByText(en.injReason[r])).toBeTruthy();
    fireEvent.click(screen.getByText(en.injContinue));
    expect(screen.getByText(en.injClinicianTitle)).toBeTruthy();
    back();
    expect(screen.getByText(en.injGeneralHint)).toBeTruthy();
  });

  it('a general reason is saved without body part, side or muscles', () => {
    general();
    fireEvent.click(screen.getByText(en.injReason.illness));
    fireEvent.click(screen.getByText(en.injContinue));
    fireEvent.click(screen.getByText(en.injSeePlan));
    expect(m.start).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'illness',
        bodyPart: '',
        side: undefined,
        muscles: [],
        stage: 'reintroduce',
      }),
    );
  });
});

describe('InjuryView prefill (from Health: I got hurt)', () => {
  it('opens straight on "how does it feel" with the part and the real start day', () => {
    open({ prefill: { bodyPart: 'shoulder', side: 'right', startDay: TODAY - 4 } });
    expect(screen.getByText(en.injFeelTitle)).toBeTruthy();
    fireEvent.click(screen.getByText(en.injFeel.cant));
    fireEvent.click(screen.getByText(en.injNext));
    fireEvent.click(screen.getByText(en.injSeePlan));
    expect(m.start).toHaveBeenCalledWith(
      expect.objectContaining({ bodyPart: 'shoulder', side: 'right', startDay: TODAY - 4 }),
    );
  });

  it('prefill wins over an existing active injury', () => {
    withInjuries(inj());
    open({ prefill: { bodyPart: 'shoulder', side: 'left', startDay: TODAY } });
    expect(screen.getByText(en.injFeelTitle)).toBeTruthy();
  });

  it('Back on the prefilled feel step goes to the picker with the part chosen', () => {
    open({ prefill: { bodyPart: 'shoulder', side: 'left', startDay: TODAY } });
    back();
    expect((screen.getByText(en.injNextFeel).closest('button') as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
});

describe('InjuryView plan (phone)', () => {
  it('shows the stage list with done, now and by-feel markers and the by-feel note', () => {
    withInjuries(inj({ stage: 'rebuild', bodyPart: 'knee' }));
    open();
    expect(screen.getByText(en.injPlanTitle(en.injBodyParts.knee))).toBeTruthy();
    expect(screen.getByText(en.injFeelDriven)).toBeTruthy();
    const rows = [...document.querySelectorAll('.slist .r')];
    expect(rows.map((r) => r.className.trim())).toEqual(['r done', 'r done', 'r now', 'r']);
    expect(rows[2].textContent).toContain(en.injNow);
    expect(rows[0].textContent).toContain(en.injCleared);
    expect(rows[3].textContent).toContain(en.injByFeel);
    expect(screen.getByText(en.injRebuildRampLabel)).toBeTruthy();
  });

  it('the rebuild ramp is only shown in the rebuild stage', () => {
    withInjuries(inj({ stage: 'reintroduce' }));
    open();
    expect(screen.queryByText(en.injRebuildRampLabel)).toBeNull();
  });

  it('Protect stage has no check-in button; later stages do', () => {
    withInjuries(inj({ stage: 'protect' }));
    const { unmount } = open();
    expect(screen.queryByText(en.injLogCheckin)).toBeNull();
    unmount();
    withInjuries(inj({ stage: 'reintroduce' }));
    open();
    expect(screen.getByText(en.injLogCheckin)).toBeTruthy();
  });

  it('a general-reason plan is titled by the reason', () => {
    withInjuries(inj({ reason: 'surgery', bodyPart: '', side: undefined, muscles: [] }));
    open();
    expect(screen.getByText(en.injPlanTitle(en.injReason.surgery))).toBeTruthy();
  });

  it('a clinician no-load window shows Stage 0 with the days left and hides check-ins and the ramp', () => {
    withInjuries(inj({ stage: 'protect', fullRestUntil: TODAY + 10 }));
    open();
    expect(screen.getByText(en.injStage0Note)).toBeTruthy();
    expect(screen.getByText(en.injStage0Left(10))).toBeTruthy();
    expect(screen.queryByText(en.injLogCheckin)).toBeNull();
    expect(document.querySelectorAll('.slist .r.rest')).toHaveLength(1);
    expect(document.querySelector('.slist .r.now')).toBeNull();
  });

  it('after the window ends the by-feel stages take over', () => {
    withInjuries(inj({ stage: 'reintroduce', fullRestUntil: TODAY }));
    open();
    expect(screen.queryByText(en.injStage0Note)).toBeNull();
    expect(document.querySelector('.slist .r.now')).toBeTruthy();
  });

  it('the requested injury id is shown when several are active; unknown ids fall back to the first', () => {
    withInjuries(inj({ id: 'a', bodyPart: 'knee' }), inj({ id: 'b', bodyPart: 'shoulder' }));
    const { unmount } = open({ injuryId: 'b' });
    expect(screen.getByText(en.injPlanTitle(en.injBodyParts.shoulder))).toBeTruthy();
    unmount();
    open({ injuryId: 'zzz' });
    expect(screen.getByText(en.injPlanTitle(en.injBodyParts.knee))).toBeTruthy();
  });

  it('healed injuries are not shown: the flow starts the setup', () => {
    withInjuries(inj({ healedDay: TODAY - 1 }));
    open();
    expect(screen.getByText(en.injWhereHint)).toBeTruthy();
  });

  it('the back arrow closes', () => {
    withInjuries(inj());
    const { onClose } = open();
    back();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('checkin=true opens the check-in sheet immediately', () => {
    withInjuries(inj());
    open({ checkin: true });
    expect(screen.getByText(en.injCheckinTitle)).toBeTruthy();
  });
});

describe('InjuryView check-in sheet', () => {
  const start = (over: Partial<Injury> = {}) => {
    withInjuries(inj(over));
    const out = open();
    fireEvent.click(screen.getByText(en.injLogCheckin));
    return out;
  };

  it('offers the three feels, each with its consequence', () => {
    start();
    const sheet = document.querySelector('.rehab-ci-sheet') as HTMLElement;
    expect(within(sheet).getByText(en.injCiFine)).toBeTruthy();
    expect(within(sheet).getByText(`↑ ${en.injConsProgress}`)).toBeTruthy();
    expect(within(sheet).getByText(`→ ${en.injConsHold}`)).toBeTruthy();
    expect(within(sheet).getByText(`↓ ${en.injConsBack}`)).toBeTruthy();
    expect(within(sheet).getByText(en.injCheckinRule)).toBeTruthy();
  });

  it('a good check-in that earns progress offers the move up; accepting advances', () => {
    m.checkin.mockReturnValue({ outcome: 'ready', stage: 'rebuild' });
    start();
    fireEvent.click(screen.getByText(en.injCiFine));
    expect(m.checkin).toHaveBeenCalledWith('knee', 'fine');
    expect(screen.getByText(en.injResAdvTitle)).toBeTruthy();
    expect(screen.getByText(en.injResAdvBody)).toBeTruthy();
    const row = document.querySelector('.ij-result-row--ready') as HTMLElement;
    expect(row.textContent).toContain(en.injStage.reintroduce);
    expect(row.textContent).toContain(en.injStage.rebuild);
    fireEvent.click(screen.getByText(new RegExp(en.injMoveUp(en.injStage.rebuild))));
    expect(m.advance).toHaveBeenCalledWith('knee');
    expect(screen.queryByText(en.injResAdvTitle)).toBeNull();
  });

  it('"stay a bit longer" dismisses the offer', () => {
    m.checkin.mockReturnValue({ outcome: 'ready', stage: 'rebuild' });
    start();
    fireEvent.click(screen.getByText(en.injCiFine));
    fireEvent.click(screen.getByText(en.injStayLonger));
    expect(m.dismiss).toHaveBeenCalledWith('knee');
    expect(m.advance).not.toHaveBeenCalled();
  });

  it('a "sore" check-in holds the stage and Done closes the sheet', () => {
    m.checkin.mockReturnValue({ outcome: 'hold', stage: 'reintroduce' });
    start();
    fireEvent.click(screen.getByText(en.injCiSore));
    expect(m.checkin).toHaveBeenCalledWith('knee', 'sore');
    expect(screen.getByText(en.injResHoldTitle)).toBeTruthy();
    expect(screen.getByText(en.injResStaying(en.injStage.reintroduce))).toBeTruthy();
    fireEvent.click(screen.getByText(en.done));
    expect(screen.queryByText(en.injResHoldTitle)).toBeNull();
  });

  it('pain sends the plan back a stage', () => {
    m.checkin.mockReturnValue({ outcome: 'regress', stage: 'protect' });
    start({ stage: 'reintroduce' });
    fireEvent.click(screen.getByText(en.injCiPain));
    expect(m.checkin).toHaveBeenCalledWith('knee', 'pain');
    expect(screen.getByText(en.injResBackTitle)).toBeTruthy();
    const row = document.querySelector('.ij-result-row--regress') as HTMLElement;
    expect(row.textContent).toContain(en.injStage.reintroduce);
    expect(row.textContent).toContain(en.injStage.protect);
    expect(document.querySelectorAll('.dots .dot.on')).toHaveLength(1);
    expect(document.querySelectorAll('.dots .dot.done')).toHaveLength(0);
  });

  it('when the store records nothing the sheet just closes', () => {
    m.checkin.mockReturnValue(null);
    start();
    fireEvent.click(screen.getByText(en.injCiFine));
    expect(document.querySelector('.rehab-ci-sheet')).toBeNull();
  });

  it('Escape closes the sheet without logging', async () => {
    start();
    fireEvent.keyDown(document, { key: 'Escape' });
    await vi.waitFor(() => expect(document.querySelector('.rehab-ci-sheet')).toBeNull());
    expect(m.checkin).not.toHaveBeenCalled();
  });
});

describe('InjuryView manage', () => {
  const manage = (over: Partial<Injury> = {}) => {
    withInjuries(inj(over));
    const out = open();
    // the header icon button and the bottom button both open it
    fireEvent.click(screen.getAllByRole('button', { name: en.injManage })[0]);
    return out;
  };

  it('shows the area with its side and the current stage', () => {
    manage();
    expect(screen.getByText(en.injManageTitle)).toBeTruthy();
    expect(screen.getByText(`${en.injSide.left} ${en.injBodyParts.knee}`)).toBeTruthy();
    expect(screen.getByText(en.injStage.reintroduce)).toBeTruthy();
  });

  it('a general plan shows only its reason as the area', () => {
    manage({ reason: 'break', bodyPart: '', side: undefined });
    expect(screen.getByText(en.injReason.break, { selector: '.ij-n400' })).toBeTruthy();
  });

  it('Back returns to the plan', () => {
    manage();
    back();
    expect(screen.getByText(en.injYourStages)).toBeTruthy();
  });

  it('"mark as healed" asks first; cancel keeps it, confirm heals and leaves the whole flow', () => {
    const { onClose } = manage();
    fireEvent.click(screen.getByText(en.injMarkHealed));
    const d = dlg();
    expect(within(d).getByText(en.injHealedTitle(en.injBodyParts.knee))).toBeTruthy();
    fireEvent.click(within(d).getByText(en.injHealedNotYet));
    expect(m.heal).not.toHaveBeenCalled();
    expect(dlg()).toBeNull();
    fireEvent.click(screen.getByText(en.injMarkHealed));
    fireEvent.click(within(dlg()).getByText(en.injHealedConfirm));
    expect(m.heal).toHaveBeenCalledWith('knee');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('"cancel plan" asks first; confirm deletes the injury and leaves', () => {
    const { onClose } = manage();
    fireEvent.click(screen.getByText(en.injCancelPlan));
    expect(within(dlg()).getByText(en.injCancelBody)).toBeTruthy();
    fireEvent.click(within(dlg()).getByText(en.injHealedNotYet));
    expect(m.del).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText(en.injCancelPlan));
    fireEvent.click(within(dlg()).getByRole('button', { name: en.injCancelConfirm }));
    expect(m.del).toHaveBeenCalledWith('knee');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('InjuryView plan (desktop hub)', () => {
  beforeEach(() => setDesktop(true));

  it('shows the stage track, the right-now card, side notes and protected muscles', () => {
    withInjuries(inj({ stage: 'rebuild', muscles: ['quads', 'hamstrings'] }));
    open();
    expect(document.querySelector('.rx.hub')).toBeTruthy();
    expect(screen.getByText(en.injPlanTitle(en.injBodyParts.knee))).toBeTruthy();
    expect(document.querySelector('.sub2')?.textContent).toContain(
      en.injBannerStage(3, 4, en.injStage.rebuild),
    );
    const nodes = [...document.querySelectorAll('.rx-track .node')];
    expect(nodes.map((n) => n.className.replace('node ', ''))).toEqual([
      'done',
      'done',
      'now',
      'next',
    ]);
    expect(document.querySelector('.rk')?.textContent).toBe(
      `${en.injRightNow} · ${en.injStage.rebuild}`,
    );
    expect(screen.getByText(en.injRebuildPreview)).toBeTruthy();
    expect(screen.getByText(en.injTimeframeNone)).toBeTruthy();
    expect(screen.getByText(en.injProtectedThisWeek)).toBeTruthy();
    expect(screen.getByText(en.muscleGroups.hamstrings)).toBeTruthy();
  });

  it('lists the last four check-ins newest first, coloured by feel', () => {
    const checkins = Array.from({ length: 6 }, (_, i) => ({
      id: `c${i}`,
      at: NOW - (6 - i) * DAY,
      feel: i % 3 === 0 ? 'fine' : i % 3 === 1 ? 'sore' : 'pain',
    })) as Injury['checkins'];
    withInjuries(inj({ checkins }));
    open();
    expect(screen.getByText(en.injRecentCheckins)).toBeTruthy();
    const rows = [...document.querySelectorAll('.listcard .li')].filter((r) =>
      r.querySelector('.ij-dot'),
    );
    expect(rows).toHaveLength(4);
    expect(rows[0].textContent).toContain(new Date(NOW - DAY).toLocaleDateString());
    expect(rows[0].textContent).toContain(en.injFeelWord[checkins[5].feel]);
    expect(rows[3].textContent).toContain(new Date(NOW - 4 * DAY).toLocaleDateString());
  });

  it('check-in and manage buttons work from the hub', () => {
    withInjuries(inj({ stage: 'reintroduce' }));
    open();
    fireEvent.click(screen.getByText(en.injLogCheckin));
    expect(screen.getByText(en.injCheckinTitle)).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    cleanup();
    open();
    fireEvent.click(screen.getByRole('button', { name: en.injManage }));
    expect(screen.getByText(en.injManageTitle)).toBeTruthy();
  });

  it('the hub "Mark healed" opens manage; Protect has no check-in button', () => {
    withInjuries(inj({ stage: 'protect' }));
    open();
    expect(screen.queryByText(en.injLogCheckin)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en.injMarkHealed }));
    expect(screen.getByText(en.injManageTitle)).toBeTruthy();
  });

  it('in a clinician no-load window the desktop falls back to the phone layout', () => {
    withInjuries(inj({ stage: 'protect', fullRestUntil: TODAY + 3 }));
    open();
    expect(document.querySelector('.rx.hub')).toBeNull();
    expect(screen.getByText(en.injStage0Left(3))).toBeTruthy();
  });
});
