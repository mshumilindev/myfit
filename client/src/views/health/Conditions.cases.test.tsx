import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { effectText } from '../../conditionText';
import { coachView } from '../../conditions';
import {
  CONDITION_CATALOG,
  CONDITION_CATEGORIES,
  catalogCondition,
} from '../../data/conditionCatalog';
import { setLocale } from '../../i18n';
import { en } from '../../i18n/en';
import { __getStateForTests, addCondition, resetLocalData, setConditionsShare } from '../../store';
import type { ChronicCondition } from '../../types';

// WebGL figure: replaced by an inert element (the body map itself is tested in BodyMapPicker.cases.test.tsx).
vi.mock('../../components/ui/AnatomyTurntable', () => ({
  AnatomyTurntable: () => <div data-testid="figure" />,
}));

import {
  CoachConditions,
  ConditionPage,
  ConditionsOnboardingRow,
  ConditionsProfileRow,
  ConditionsSection,
} from './Conditions';

const DAY = 86_400_000;
const NOW = new Date(2026, 8, 26, 12, 0).getTime();
const ymd = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  setLocale('en');
  resetLocalData();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const conds = () => __getStateForTests().conditions;
const add = (over: Partial<ChronicCondition> & { key: string }): ChronicCondition =>
  addCondition({ severity: 2, share: 'inherit', ...over } as never);
const page = (
  cond: string,
  condKey?: string,
  web = false,
  onBack = vi.fn(),
  onPickKey = vi.fn(),
) => {
  const r = render(
    <ConditionPage cond={cond} condKey={condKey} web={web} onBack={onBack} onPickKey={onPickKey} />,
  );
  return { ...r, onBack, onPickKey };
};

describe('ConditionsSection', () => {
  it('invites the first condition and opens the add flow', () => {
    const onOpen = vi.fn();
    render(<ConditionsSection onOpen={onOpen} />);
    expect(screen.getByText(en.cndEmpty)).toBeTruthy();
    fireEvent.click(screen.getByText(en.cndAdd));
    expect(onOpen).toHaveBeenCalledWith('new');
  });

  it('a row says the severity, the day of a temporary one, "Ended" past its end, and the private tag', () => {
    const asthma = add({ key: 'lung_asthma', severity: 3, share: 'off' });
    const knee = add({
      key: 'postop_knee',
      severity: 1,
      startedAt: NOW - 9 * DAY,
      endsAt: NOW + 171 * DAY,
    });
    const old = add({
      key: 'postop_hip',
      severity: 2,
      startedAt: NOW - 200 * DAY,
      endsAt: NOW - 20 * DAY,
    });
    const onOpen = vi.fn();
    render(<ConditionsSection onOpen={onOpen} />);
    expect(screen.queryByText(en.cndEmpty)).toBeNull();
    const rowOf = (key: string) =>
      screen.getByText(catalogCondition(key)!.name).closest('.uirow') as HTMLElement;
    expect(rowOf('lung_asthma').textContent).toContain(en.cndSev[3]);
    expect(within(rowOf('lung_asthma')).getByText(en.cndShareOff)).toBeTruthy();
    expect(rowOf('postop_knee').textContent).toContain(`${en.cndSev[1]} · ${en.cndDayOf(10, 180)}`);
    expect(rowOf('postop_hip').textContent).toContain(`${en.cndSev[2]} · ${en.cndEnded}`);
    fireEvent.click(rowOf('postop_knee'));
    expect(onOpen).toHaveBeenCalledWith(knee.id);
    fireEvent.click(rowOf('lung_asthma'));
    expect(onOpen).toHaveBeenLastCalledWith(asthma.id);
    expect(old.id).toBeTruthy();
  });

  it('a condition the catalogue no longer knows is left out', () => {
    add({ key: 'no_such_condition' });
    const { container } = render(<ConditionsSection onOpen={() => undefined} />);
    expect(container.querySelectorAll('.uirow')).toHaveLength(1); // only "Add"
  });
});

describe('ConditionPage: the form', () => {
  it('adds a permanent condition with the chosen severity and sharing, then leaves', () => {
    const { onBack } = page('new', 'lung_asthma');
    fireEvent.click(screen.getByText(en.cndSevere));
    fireEvent.click(screen.getByText(en.cndShareEffects));
    expect(screen.getByText(en.cndShareHintEffects)).toBeTruthy();
    expect(screen.queryByText(en.cndStarted)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en.cndAddBtn }));
    expect(conds()).toHaveLength(1);
    expect(conds()[0]).toMatchObject({ key: 'lung_asthma', severity: 3, share: 'effects' });
    expect(conds()[0].startedAt).toBeUndefined();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('the sharing hint follows the choice, and "default" names the general setting', () => {
    setConditionsShare('full');
    page('new', 'lung_asthma');
    expect(screen.getByText(en.cndShareHintInheritNow(en.cndShareFull))).toBeTruthy();
    fireEvent.click(screen.getByText(en.cndShareOff));
    expect(screen.getByText(en.cndShareHintOff)).toBeTruthy();
    fireEvent.click(screen.getByText(en.cndShareFull, { selector: 'button *, button' }));
    expect(screen.getByText(en.cndShareHintFull)).toBeTruthy();
  });

  it('a temporary condition starts today and suggests an end; moving the start moves the end', () => {
    page('new', 'postop_knee');
    const start = screen.getByLabelText(en.cndStarted) as HTMLInputElement;
    const end = screen.getByLabelText(en.cndEnds) as HTMLInputElement;
    expect(start.value).toBe(ymd(NOW));
    expect(end.value).toBe(ymd(NOW + 180 * DAY));
    fireEvent.change(start, { target: { value: '2026-09-01' } });
    expect(end.value).toBe(ymd(new Date(2026, 8, 1).getTime() + 180 * DAY));
    fireEvent.change(end, { target: { value: '2027-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: en.cndAddBtn }));
    expect(conds()[0].startedAt).toBe(new Date(2026, 8, 1).getTime());
    expect(conds()[0].endsAt).toBe(new Date(2027, 0, 1).getTime());
  });

  it('pregnancy follows its own dates: only the start is asked', () => {
    page('new', 'preg_first');
    expect(screen.getByLabelText(en.cndStarted)).toBeTruthy();
    expect(screen.queryByLabelText(en.cndEnds)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en.cndAddBtn }));
    expect(conds()[0].endsAt).toBe(new Date(ymd(NOW + 280 * DAY).replace(/-/g, '/')).getTime());
  });

  it('an unparseable start date is dropped instead of saved as nonsense', () => {
    page('new', 'postop_knee');
    fireEvent.change(screen.getByLabelText(en.cndStarted), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: en.cndAddBtn }));
    expect(conds()[0].startedAt).toBeUndefined();
  });

  it('editing keeps the other end date when the start moves, saves changes, and shows Save', () => {
    const c = add({
      key: 'postop_knee',
      severity: 1,
      startedAt: NOW - 9 * DAY,
      endsAt: NOW + 171 * DAY,
    });
    const { onBack } = page(c.id, undefined);
    const end = screen.getByLabelText(en.cndEnds) as HTMLInputElement;
    const endBefore = end.value;
    fireEvent.change(screen.getByLabelText(en.cndStarted), { target: { value: '2026-09-10' } });
    expect(end.value).toBe(endBefore);
    fireEvent.click(screen.getByText(en.cndSevere));
    fireEvent.click(screen.getByRole('button', { name: en.cndSave }));
    expect(conds()[0]).toMatchObject({ id: c.id, severity: 3 });
    expect(conds()[0].startedAt).toBe(new Date(2026, 8, 10).getTime());
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('delete asks first: cancel keeps it, confirm removes it and leaves', () => {
    const c = add({ key: 'lung_asthma' });
    const { onBack } = page(c.id);
    fireEvent.click(screen.getByRole('button', { name: en.cndDelete }));
    expect(screen.getByText(en.cndDeleteAsk)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.cndCancel }));
    expect(conds()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: en.cndDelete }));
    const dlg = document.querySelector('[role="alertdialog"], [role="dialog"]') as HTMLElement;
    fireEvent.click(within(dlg).getByRole('button', { name: en.cndDelete }));
    expect(conds()).toHaveLength(0);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('has no delete button for a new condition; the web frame titles the pane instead of a page head', () => {
    page('new', 'lung_asthma', true);
    expect(screen.queryByRole('button', { name: en.cndDelete })).toBeNull();
    expect(document.querySelector('.hl-phd h2')?.textContent).toBe(
      catalogCondition('lung_asthma')!.name,
    );
    expect(document.querySelector('.uipagehead')).toBeNull();
  });

  it('the page frame has a back button; an id that no longer exists shows an empty page', () => {
    const { onBack, unmount } = page('gone');
    expect(screen.getByRole('button', { name: /back/i })).toBeTruthy();
    expect(screen.getByText(en.cndAdd)).toBeTruthy();
    expect(document.querySelectorAll('.uirow')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
    unmount();
  });
});

describe('ConditionPage: the picker', () => {
  it('lists the categories with their counts and opens one, which lists only its own conditions and can be left again', () => {
    page('new');
    const catRow = (id: string) =>
      screen.getByText(en.cndCat[id as keyof typeof en.cndCat]).closest('.uirow') as HTMLElement;
    for (const c of CONDITION_CATEGORIES) {
      const n = CONDITION_CATALOG.filter((x) => x.category === c.id).length;
      expect(within(catRow(c.id)).getByText(String(n))).toBeTruthy();
    }
    const target = CONDITION_CATEGORIES.find(
      (c) => CONDITION_CATALOG.filter((x) => x.category === c.id).length > 1,
    )!;
    fireEvent.click(catRow(target.id));
    const inCat = CONDITION_CATALOG.filter((x) => x.category === target.id);
    const rows = [...document.querySelectorAll('.uirow-l')].map((n) => n.textContent);
    expect(rows).toHaveLength(Math.min(40, inCat.length));
    const foreign = CONDITION_CATALOG.find((x) => x.category !== target.id)!;
    expect(rows).not.toContain(foreign.name);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: foreign.name } });
    expect(screen.queryByText(foreign.name)).toBeNull();
    fireEvent.click(
      screen.getByRole('button', {
        name: new RegExp(`${en.cndCat[target.id as keyof typeof en.cndCat]} ×$`),
      }),
    );
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
    expect(catRow(target.id)).toBeTruthy();
  });

  it('searching narrows the catalogue, an empty result says so, picking reports the key', () => {
    const { onPickKey } = page('new');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzzqqq' } });
    expect(screen.getByText(en.cndNoResults)).toBeTruthy();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'asthma' } });
    fireEvent.click(screen.getByText(catalogCondition('lung_asthma')!.name));
    expect(onPickKey).toHaveBeenCalledWith('lung_asthma');
  });

  it('shows at most 40 results for a very wide search', () => {
    page('new');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'a' } });
    expect(document.querySelectorAll('.uirow').length).toBeLessThanOrEqual(40);
    expect(CONDITION_CATALOG.length).toBeGreaterThan(40);
  });

  it('the body map mode swaps the list for the figure and picks from it', () => {
    const { onPickKey } = page('new');
    fireEvent.click(screen.getByText(en.cndModeBody));
    expect(screen.getByTestId('figure')).toBeTruthy();
    expect(screen.queryByRole('searchbox')).toBeNull();
    fireEvent.click(screen.getByText(en.cndRegion.knees));
    const knee = CONDITION_CATALOG.find((c) => c.region === 'knee')!;
    fireEvent.click(screen.getByText(knee.name));
    expect(onPickKey).toHaveBeenCalledWith(knee.key);
    fireEvent.click(screen.getByText(en.cndModeList));
    expect(screen.getByRole('searchbox')).toBeTruthy();
  });
});

describe('profile and onboarding rows', () => {
  it('the profile row counts only conditions that are active now', () => {
    add({ key: 'lung_asthma' });
    add({ key: 'postop_knee', startedAt: NOW - DAY, endsAt: NOW + 100 * DAY });
    add({ key: 'postop_hip', startedAt: NOW - 200 * DAY, endsAt: NOW - DAY });
    add({ key: 'postop_spine_lumbar', startedAt: NOW + 5 * DAY, endsAt: NOW + 100 * DAY });
    const onOpen = vi.fn();
    render(<ConditionsProfileRow onOpen={onOpen} />);
    const row = screen.getByText(en.cndProfileRow).closest('.uirow') as HTMLElement;
    expect(within(row).getByText('2')).toBeTruthy();
    fireEvent.click(row);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('the onboarding row is an optional prompt that opens the add flow', () => {
    const onOpen = vi.fn();
    render(<ConditionsOnboardingRow onOpen={onOpen} />);
    expect(screen.getByText(en.cndOnbHint)).toBeTruthy();
    fireEvent.click(screen.getByText(en.cndOnbPrompt));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe('CoachConditions', () => {
  it('names a condition shared in full with its severity and effects, and merges the rest without names', () => {
    const full = add({ key: 'lung_asthma', severity: 3, share: 'full' });
    const eff = add({
      key: 'postop_knee',
      severity: 2,
      share: 'effects',
      startedAt: NOW - DAY,
      endsAt: NOW + 100 * DAY,
    });
    add({
      key: 'postop_hip',
      severity: 2,
      share: 'off',
      startedAt: NOW - DAY,
      endsAt: NOW + 100 * DAY,
    });
    const view = coachView(conds(), 'off', NOW);
    expect(view.full).toHaveLength(1);
    expect(view.effects.length).toBeGreaterThan(0);
    render(<CoachConditions view={view} />);
    const cat = catalogCondition(full.key)!;
    expect(screen.getByText(cat.name)).toBeTruthy(); // the group header
    expect(screen.getByText(en.cndSev[3])).toBeTruthy();
    expect(screen.getByText(en.cndCoachEffects)).toBeTruthy();
    view.effects.forEach((l) =>
      expect(screen.getAllByText(effectText(l, en)).length).toBeGreaterThan(0),
    );
    expect(screen.queryByText(catalogCondition(eff.key)!.name)).toBeNull();
    expect(screen.queryByText(catalogCondition('postop_hip')!.name)).toBeNull();
    expect(screen.getAllByText(en.cndCoachFoot)).toHaveLength(2);
  });

  it('shows nothing when nothing is shared', () => {
    const { container } = render(<CoachConditions view={{ full: [], effects: [] }} />);
    expect(container.textContent).toBe('');
  });

  it('skips a shared key the catalogue does not know, and a full entry without a key', () => {
    const { container } = render(
      <CoachConditions
        view={{
          full: [{ key: 'nope', severity: 2, effects: [] }, { severity: 2, effects: [] } as never],
          effects: [],
        }}
      />,
    );
    expect(container.querySelectorAll('.uirow')).toHaveLength(0);
  });
});
