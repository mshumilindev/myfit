import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { SupplementCalcView } from './SupplementCalcView';
import { SupplementHubView } from './SupplementHubView';
import { SupplementProductsView } from './SupplementProductsView';
import { SupplementQuickStartSheet, QUICK_ITEMS } from './SupplementQuickStartSheet';
import { SupplementHealthRow, SupplementOnboardingRow } from './SupplementSection';
import { SupplementEvidenceSheet } from './SupplementSources';
import { SupplementCoachPreview } from './SupplementCoachPreview';
import { GroupedList } from '../../../components/ui/GroupedList';
import { HealthPrivacyView } from '../HealthPrivacyView';
import { setLocale } from '../../../i18n';
import { en } from '../../../i18n/en';
import { et } from '../../../i18n/et';
import { lt } from '../../../i18n/lt';
import { pl } from '../../../i18n/pl';
import { uk } from '../../../i18n/uk';
import {
  SUPPLEMENT_GROUPS,
  SUPPLEMENT_ITEMS,
  SUPPLEMENT_SOURCES,
  SUPPLEMENT_DISCLAIMER_EN,
} from '../../../supplementCatalog';
import { SUPPLEMENT_SURFACES, newSupplementEntry } from '../../../supplements';
import {
  __getStateForTests,
  deleteSupplementData,
  saveSupplementEntry,
  setSupplementSharing,
  setSupplementSurface,
  setSupplementUseInCalculations,
} from '../../../store';
import { supEntryId } from './text';

beforeEach(() => {
  setLocale('en');
  deleteSupplementData();
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
afterEach(cleanup);

const sup = () => __getStateForTests().supplements;
const entries = () => sup().entries;
const row = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });
const save = () => screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
const pressed = (el: HTMLElement) => el.closest('button')?.getAttribute('aria-pressed');
const chip = (group: string, name: string) =>
  within(screen.getByRole('group', { name: group })).getByRole('button', {
    name: new RegExp(`^(saved)?${name}$`),
  });
const seed = (itemId: Parameters<typeof newSupplementEntry>[0], patch = {}) =>
  saveSupplementEntry({ ...newSupplementEntry(itemId, supEntryId(itemId)), ...patch });

describe('SupplementProductsView (What I take)', () => {
  it('lists the 4 groups with their blurbs and the evidence row; nothing is checked yet', () => {
    render(<SupplementProductsView onBack={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'What I take' })).toBeTruthy();
    for (const g of SUPPLEMENT_GROUPS) expect(row(en.supGroup[g])).toBeTruthy();
    expect(screen.getByText('Creatine, caffeine, pre-workout, nitrates…')).toBeTruthy();
    expect(row('Evidence and sources')).toBeTruthy();
    expect(document.querySelectorAll('.uirow-check')).toHaveLength(0);
    expect(screen.getByText(/follow your training plan automatically/)).toBeTruthy();
  });

  it('opening a group only previews defaults; nothing is stored until Save', () => {
    render(<SupplementProductsView onBack={() => undefined} />);
    fireEvent.click(row('Performance'));
    expect(entries()).toHaveLength(0);
    expect(pressed(chip('Supplement', 'Creatine'))).toBe('true');
    expect(pressed(chip('Serving', '5 g'))).toBe('true');
    expect(pressed(chip('Timing', 'Any time'))).toBe('true');
    expect(
      pressed(within(screen.getByRole('group', { name: 'Schedule' })).getByText('Daily')),
    ).toBe('true');
    expect(screen.getByText('Typical serving')).toBeTruthy();
    expect(screen.getByText('3–5 g')).toBeTruthy();
    expect(screen.getByText('Strong')).toBeTruthy();
    expect(screen.getByText('+0–8 %')).toBeTruthy();
    expect(screen.getByText('+0.5–2 kg')).toBeTruthy();
    expect(screen.getByText(SUPPLEMENT_DISCLAIMER_EN)).toBeTruthy();
    expect(save().disabled).toBe(false);
    expect(screen.queryByText('Remove this supplement')).toBeNull();
  });

  it('the schedule is Daily or Training days only: no weekdays, no occasionally', () => {
    render(<SupplementProductsView onBack={() => undefined} />);
    fireEvent.click(row('Performance'));
    const seg = within(screen.getByRole('group', { name: 'Schedule' }));
    expect(seg.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Daily',
      'Training days',
    ]);
    expect(screen.getByText('Training days follow your training plan automatically.')).toBeTruthy();
    expect(screen.queryByText(/Occasionally/)).toBeNull();
  });

  it('Save stores the entry with the catalog default, saved items get a check, and the sheet closes', () => {
    render(<SupplementProductsView onBack={() => undefined} />);
    fireEvent.click(row('Performance'));
    fireEvent.click(save());
    expect(entries()).toHaveLength(1);
    expect(entries()[0]).toMatchObject({
      id: 'sup-creatine',
      itemId: 'creatine',
      dose: 5,
      schedule: 'daily',
      timing: 'anytime',
      active: true,
    });
    expect(entries()[0].startedAt).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(document.querySelectorAll('.uirow-check')).toHaveLength(1);
    expect(within(row('Performance')).getByText('Creatine 5 g')).toBeTruthy();
  });

  it('a saved item is dirty-checked, can be edited, and keeps its start date', () => {
    seed('creatine', { startedAt: 1_700_000_000_000 });
    render(<SupplementProductsView onBack={() => undefined} />);
    fireEvent.click(row('Performance'));
    expect(save().disabled).toBe(true);
    fireEvent.click(chip('Serving', '3 g'));
    expect(save().disabled).toBe(false);
    fireEvent.click(chip('Timing', 'Morning'));
    fireEvent.click(save());
    expect(entries()[0]).toMatchObject({ dose: 3, timing: 'morning' });
    expect(entries()[0].startedAt).toBe(1_700_000_000_000);
  });

  it('changing something and changing it back leaves Save disabled', () => {
    seed('creatine');
    render(<SupplementProductsView onBack={() => undefined} />);
    fireEvent.click(row('Performance'));
    fireEvent.click(chip('Serving', '3 g'));
    expect(save().disabled).toBe(false);
    fireEvent.click(chip('Serving', '5 g'));
    expect(save().disabled).toBe(true);
  });

  it('the exact amount stepper accepts a value between presets and the chip appears', () => {
    render(<SupplementProductsView onBack={() => undefined} />);
    fireEvent.click(row('Performance'));
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    expect(pressed(chip('Serving', '6 g'))).toBe('true');
    fireEvent.click(save());
    expect(entries()[0].dose).toBe(6);
  });

  it('several supplements of one group can be saved at once (the focused one plus any edited)', () => {
    render(<SupplementProductsView onBack={() => undefined} />);
    fireEvent.click(row('Performance'));
    fireEvent.click(chip('Serving', '4 g'));
    fireEvent.click(chip('Supplement', 'Caffeine'));
    fireEvent.click(chip('Serving', '300 mg'));
    fireEvent.click(save());
    expect(
      entries()
        .map((e) => [e.itemId, e.dose])
        .sort(),
    ).toEqual([
      ['caffeine', 300],
      ['creatine', 4],
    ]);
    expect(entries().find((e) => e.itemId === 'caffeine')).toMatchObject({
      schedule: 'trainingDays',
      timing: 'preWorkout',
    });
  });

  it('Remove goes through a confirm and takes only the focused supplement away', () => {
    seed('creatine');
    seed('caffeine');
    render(<SupplementProductsView onBack={() => undefined} />);
    fireEvent.click(row('Performance'));
    fireEvent.click(chip('Supplement', 'Caffeine'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove this supplement' }));
    expect(entries()).toHaveLength(2);
    expect(screen.getByText('Remove this supplement?')).toBeTruthy();
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
    );
    expect(entries()).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Remove this supplement' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' }),
    );
    expect(entries().map((e) => e.itemId)).toEqual(['creatine']);
  });

  it('a protein item says it counts toward the protein target and that food logging is separate', () => {
    render(<SupplementProductsView onBack={() => undefined} />);
    fireEvent.click(row('Protein and aminos'));
    expect(screen.getByText('Counts toward your protein')).toBeTruthy();
    expect(screen.getByText('+20 g')).toBeTruthy();
    expect(screen.getByText(/Food logging is separate/)).toBeTruthy();
  });

  it('an item with no modelled effect says it is only tracked', () => {
    render(<SupplementProductsView onBack={() => undefined} />);
    fireEvent.click(row('Recovery and sleep'));
    expect(screen.getByText('Tracked, no estimated effect')).toBeTruthy();
    expect(screen.queryByText(SUPPLEMENT_DISCLAIMER_EN)).toBeNull();
  });

  it('shows safety Notices in the item sheet: caffeine over the limit, ashwagandha, iron', () => {
    render(<SupplementProductsView onBack={() => undefined} />);
    fireEvent.click(row('Performance'));
    fireEvent.click(chip('Supplement', 'Caffeine'));
    fireEvent.click(chip('Serving', '400 mg'));
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    expect(screen.getByText(/Caffeine from Caffeine adds up to more than 400 mg/)).toBeTruthy();
    cleanup();
    render(<SupplementProductsView onBack={() => undefined} />);
    fireEvent.click(row('Recovery and sleep'));
    fireEvent.click(chip('Supplement', 'Ashwagandha'));
    expect(screen.getByText(/linked to liver problems/)).toBeTruthy();
    cleanup();
    render(<SupplementProductsView onBack={() => undefined} />);
    fireEvent.click(row('Health basics'));
    fireEvent.click(chip('Supplement', 'Iron'));
    expect(screen.getByText(/only useful if you are low/)).toBeTruthy();
    fireEvent.click(chip('Supplement', 'Vitamin C'));
    expect(screen.getByText(/can blunt the gains from training/)).toBeTruthy();
  });

  it('Evidence and sources opens the sheet with the legend, the disclaimer and every source', () => {
    render(<SupplementProductsView onBack={() => undefined} />);
    fireEvent.click(row('Evidence and sources'));
    expect(screen.getByText('Many good studies agree.')).toBeTruthy();
    expect(screen.getByText(SUPPLEMENT_DISCLAIMER_EN)).toBeTruthy();
    for (const s of Object.values(SUPPLEMENT_SOURCES))
      expect(screen.getByText(s.cite)).toBeTruthy();
    expect(screen.getAllByText('approx.')).toHaveLength(1);
  });

  it('Done leaves the page', () => {
    let back = 0;
    render(<SupplementProductsView onBack={() => (back += 1)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(back).toBe(1);
  });
});

describe('SupplementQuickStartSheet', () => {
  it('shows the six tiles with typical doses; Save is disabled until something is picked', () => {
    render(<SupplementQuickStartSheet onClose={() => undefined} onMore={() => undefined} />);
    expect(screen.getByText('What do you take regularly?')).toBeTruthy();
    const grid = within(screen.getByRole('group', { name: 'Common supplements' }));
    expect(grid.getAllByRole('button')).toHaveLength(6);
    expect(QUICK_ITEMS).toHaveLength(6);
    for (const n of [
      'Creatine',
      'Protein',
      'Caffeine or pre-workout',
      'Magnesium',
      'Vitamin D',
      'Omega-3',
    ])
      expect(grid.getByRole('button', { name: new RegExp(`^${n}`) })).toBeTruthy();
    expect(screen.getByText('5 g · Any time')).toBeTruthy();
    expect(screen.getByText('200 mg · Training days')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Save N supplements writes the picked ones with catalog defaults and closes', () => {
    let closed = 0;
    render(<SupplementQuickStartSheet onClose={() => (closed += 1)} onMore={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /^Creatine/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Protein/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save 2 supplements' }));
    expect(
      entries()
        .map((e) => [e.itemId, e.dose])
        .sort(),
    ).toEqual([
      ['creatine', 5],
      ['whey', 25],
    ]);
    expect(closed).toBe(1);
  });

  it('Fine-tune and add more saves the picked ones, then opens the catalog', () => {
    let more = 0;
    render(<SupplementQuickStartSheet onClose={() => undefined} onMore={() => (more += 1)} />);
    fireEvent.click(screen.getByRole('button', { name: /^Magnesium/ }));
    fireEvent.click(screen.getByRole('button', { name: /Fine-tune and add more/ }));
    expect(entries().map((e) => e.itemId)).toEqual(['magnesium']);
    expect(more).toBe(1);
  });

  it('a tile that is already saved is shown as saved and cannot be picked twice', () => {
    seed('creatine');
    render(<SupplementQuickStartSheet onClose={() => undefined} onMore={() => undefined} />);
    const t = screen.getByRole('button', { name: /^Creatine/ }) as HTMLButtonElement;
    expect(t.disabled).toBe(true);
    expect(within(t).getByText('Saved')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });
});

describe('SupplementHubView', () => {
  it('shows the rows, the summary and the schedule line', () => {
    seed('creatine');
    seed('whey');
    seed('caffeine');
    render(<SupplementHubView onOpen={() => undefined} onBack={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'Supplements' })).toBeTruthy();
    expect(within(row('What I take')).getByText('Creatine + Whey + 1 more · 3 items')).toBeTruthy();
    expect(screen.getByText('2 daily · 1 on training days')).toBeTruthy();
    expect(within(row('Use in calculations')).getByText('On')).toBeTruthy();
    expect(screen.getByText('Private. Only used to adjust your numbers.')).toBeTruthy();
  });

  it('empty: points at the catalog and says nothing is scheduled yet', () => {
    render(<SupplementHubView onOpen={() => undefined} onBack={() => undefined} />);
    expect(
      within(row('What I take')).getByText('What you take, to adjust your numbers'),
    ).toBeTruthy();
    expect(screen.getByText('Daily or on training days')).toBeTruthy();
  });

  it('opens What I take and Use in calculations', () => {
    const opened: string[] = [];
    render(<SupplementHubView onOpen={(s) => opened.push(s)} onBack={() => undefined} />);
    fireEvent.click(row('What I take'));
    fireEvent.click(row('Use in calculations'));
    expect(opened).toEqual(['products', 'calc']);
  });

  it('"Ask me on Today" is off by default and switches on and off', () => {
    render(<SupplementHubView onOpen={() => undefined} onBack={() => undefined} />);
    const sw = screen.getByRole('switch', { name: 'Ask me on Today' }) as HTMLInputElement;
    expect(sw.checked).toBe(false);
    fireEvent.click(sw);
    expect(sup().settings.checkinsOn).toBe(true);
    fireEvent.click(sw);
    expect(sup().settings.checkinsOn).toBe(false);
  });

  it('shows safety Notices for what is saved', () => {
    seed('ashwagandha');
    seed('vitaminD');
    seed('caffeine', { dose: 500 });
    render(<SupplementHubView onOpen={() => undefined} onBack={() => undefined} />);
    expect(screen.getByText(/Ashwagandha: linked to liver problems/)).toBeTruthy();
    expect(screen.getByText(/Vitamin D: only useful if you are low/)).toBeTruthy();
    expect(screen.getByText(/Caffeine from Caffeine adds up to more than 400 mg/)).toBeTruthy();
  });
});

describe('SupplementCalcView', () => {
  it('has the master switch, one switch per surface with an evidence tag, the disclaimer and sources', () => {
    render(<SupplementCalcView onBack={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'Use in calculations' })).toBeTruthy();
    expect(
      (screen.getByRole('switch', { name: 'Use supplements in my numbers' }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    for (const k of SUPPLEMENT_SURFACES) {
      const sw = screen.getByRole('switch', { name: en.supSf[k].label }) as HTMLInputElement;
      expect(sw.checked).toBe(true);
    }
    expect(screen.getAllByText('Strong').length).toBeGreaterThan(0);
    expect(screen.getByText('None')).toBeTruthy();
    expect(screen.getByText(SUPPLEMENT_DISCLAIMER_EN)).toBeTruthy();
    expect(screen.getByText(SUPPLEMENT_SOURCES.creatine.cite)).toBeTruthy();
  });

  it('switches write at once; the master switch disables the surface switches', () => {
    render(<SupplementCalcView onBack={() => undefined} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Sleep' }));
    expect(sup().settings.surfaces.sleep).toBe(false);
    fireEvent.click(screen.getByRole('switch', { name: 'Use supplements in my numbers' }));
    expect(sup().settings.useInCalculations).toBe(false);
    expect(
      (screen.getByRole('switch', { name: 'Protein target' }) as HTMLInputElement).disabled,
    ).toBe(true);
  });

  it('Done leaves the page', () => {
    let back = 0;
    render(<SupplementCalcView onBack={() => (back += 1)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(back).toBe(1);
    setSupplementUseInCalculations(true);
    setSupplementSurface('sleep', true);
  });
});

describe('rows around the app', () => {
  it('the Health row shows the summary, or the empty line', () => {
    const { unmount } = render(
      <GroupedList>
        <SupplementHealthRow onOpen={() => undefined} />
      </GroupedList>,
    );
    expect(screen.getByText('What you take, to adjust your numbers')).toBeTruthy();
    unmount();
    seed('creatine');
    seed('whey');
    render(
      <GroupedList>
        <SupplementHealthRow onOpen={() => undefined} />
      </GroupedList>,
    );
    expect(screen.getByText('Creatine + Whey · 2 items')).toBeTruthy();
  });

  it('the onboarding row is optional and opens', () => {
    let opened = 0;
    render(<SupplementOnboardingRow onOpen={() => (opened += 1)} />);
    expect(screen.getByText('Optional')).toBeTruthy();
    fireEvent.click(row('Supplements'));
    expect(opened).toBe(1);
  });
});

describe('Health › Privacy and sharing', () => {
  it('has a Supplements row with Off / Effects only / Full and the sheet shows what the coach sees', () => {
    seed('creatine');
    seed('whey');
    render(<HealthPrivacyView onBack={() => undefined} />);
    expect(within(row('Supplements')).getByText('Off')).toBeTruthy();
    fireEvent.click(row('Supplements'));
    expect(screen.getByRole('button', { name: /^Off/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Effects only/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Full/ }));
    expect(sup().settings.sharing).toBe('full');
    expect(screen.getByText('Your coach would see now')).toBeTruthy();
    expect(screen.getByText('Creatine monohydrate')).toBeTruthy();
    expect(screen.getByText('5 g · Daily · Any time')).toBeTruthy();
    expect(screen.getByText('Which days you took them is never shared.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Effects only/ }));
    expect(sup().settings.sharing).toBe('effects');
    expect(screen.queryByText('Creatine monohydrate')).toBeNull();
  });

  it('the summary card lists Supplements by level and "Delete supplement data" asks first', () => {
    seed('creatine');
    setSupplementSharing('effects');
    render(<HealthPrivacyView onBack={() => undefined} />);
    expect(document.querySelector('.ut-w6')?.textContent).toContain('Supplements');
    fireEvent.click(screen.getByRole('button', { name: 'Delete supplement data' }));
    expect(screen.getByText('Delete all supplement data?')).toBeTruthy();
    expect(entries()).toHaveLength(1);
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Delete supplement data',
      }),
    );
    expect(entries()).toHaveLength(0);
    expect(sup().settings.sharing).toBe('off');
  });

  it('the coach preview says nothing yet when no supplement has an effect', () => {
    setSupplementSharing('effects');
    seed('magnesium');
    render(<SupplementCoachPreview />);
    expect(screen.getByText('Nothing yet. Add a supplement that has an effect.')).toBeTruthy();
  });
});

describe('SupplementEvidenceSheet', () => {
  it('closes with Done', () => {
    let closed = 0;
    render(<SupplementEvidenceSheet onClose={() => (closed += 1)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(closed).toBe(1);
  });
});

describe('translations', () => {
  const dicts = { en, uk, pl, lt, et };
  it('every catalog item, group, timing, schedule, unit and warning is translated in all 5 locales', () => {
    for (const [id, d] of Object.entries(dicts)) {
      for (const i of SUPPLEMENT_ITEMS) {
        for (const set of [d.supItem, d.supItemShort, d.supItemBlurb])
          expect(set[i.id], `${id}.${i.id}`).toBeTruthy();
        expect(d.supDose[i.unit]('1.5').length).toBeGreaterThan(2);
      }
      for (const g of SUPPLEMENT_GROUPS) {
        expect(d.supGroup[g], `${id}.${g}`).toBeTruthy();
        expect(d.supGroupBlurb[g], `${id}.${g}`).toBeTruthy();
      }
      for (const k of Object.keys(en.supWarn) as (keyof typeof en.supWarn)[])
        expect(d.supWarn[k]('X'), `${id}.${k}`).toContain('X');
      expect(Object.keys(d.supTiming)).toEqual(Object.keys(en.supTiming));
      expect(d.supQuickSave(3)).toContain('3');
      expect(d.supQuickSave(0)).toBeTruthy();
    }
  });

  it('Ukrainian: the sheet renders long texts without losing the controls', () => {
    setLocale('uk');
    seed('ashwagandha');
    render(<SupplementProductsView onBack={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${uk.supGroup.recovery}`) }));
    expect(screen.getByText(uk.supWarn.ashwagandha(uk.supItemShort.ashwagandha))).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Зберегти' }) ?? true).toBeTruthy();
  });
});
