import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { LOCALES, setLocale } from '../i18n';
import { __getStateForTests, __replaceStateForTests } from '../store';
import { enrichedCatalog } from '../data/equipmentCatalog';
import { localizedEquipName } from '../data/equipmentI18n';
import type { Gym } from '../types';
import type { Shell } from '../App';

const setGymEquipment = vi.fn();
vi.mock('../store', async (orig) => ({
  ...(await orig<typeof import('../store')>()),
  setGymEquipment: (...a: unknown[]) => setGymEquipment(...a),
}));

import { EquipmentBoard } from './EquipmentBoard';

const en = () => LOCALES.en;
const catalog = enrichedCatalog();
const item = (id: string) => catalog.find((e) => e.id === id)!;
const name = (id: string) => localizedEquipName(item(id), 'en');
const OLY = 'barbell-olympic'; // image, muscle: fullbody, aka "power bar"
const EZ = 'barbell-ez'; // image, biceps/triceps/forearms
const CURL_CAMBERED = 'barbell-curl-cambered'; // no image, biceps/forearms

const gym = (items?: string[]): Gym => ({ id: 'g1', name: 'Iron', equipmentItems: items }) as Gym;
const shellMock = () => {
  const shell = { snack: vi.fn(), openOverlay: vi.fn() };
  return { shell: shell as unknown as Shell, snack: shell.snack, openOverlay: shell.openOverlay };
};
function setup(items?: string[]) {
  const s = shellMock();
  const view = render(<EquipmentBoard gym={gym(items)} shell={s.shell} />);
  return { ...s, ...view };
}
const catRow = (label: string) => screen.getByRole('button', { name: new RegExp(`^${label}`) });
const openCat = (label: string) => {
  const row = catRow(label);
  if (row.getAttribute('aria-expanded') !== 'true') fireEvent.click(row);
};
const tile = (id: string) => screen.getByText(name(id)).closest('.eq-tile') as HTMLElement;
const toggleBtn = (id: string) => tile(id).querySelector('.eq-tile-toggle') as HTMLButtonElement;
const search = (q: string) =>
  fireEvent.change(screen.getByPlaceholderText(en().equipSearchPlaceholder), {
    target: { value: q },
  });
const funnel = () => screen.getByRole('button', { name: en().eqFilterByMuscle });
const withGoals = (grow: string[]) => {
  const emphasis: Record<string, string> = {};
  grow.forEach((g) => (emphasis[g] = 'grow'));
  __replaceStateForTests({ ...__getStateForTests(), goals: { focus: { emphasis } } } as never);
};

beforeEach(() => {
  setLocale('en');
  setGymEquipment.mockReset();
  __replaceStateForTests({ ...__getStateForTests(), goals: undefined } as never);
});
afterEach(cleanup);

describe('EquipmentBoard · browsing', () => {
  it('lists collapsed categories in the fixed display order with item counts', () => {
    setup();
    expect(screen.getByText(en().inventoryLabel)).toBeTruthy();
    expect(screen.queryByRole('button', { name: en().eqSelectedTitle })).toBeNull(); // no count chip yet
    const rows = [...document.querySelectorAll('.eq-cat')].map((c) =>
      c.querySelector('.ui-list-row, [aria-expanded]')?.getAttribute('aria-expanded'),
    );
    expect(rows.every((r) => r === 'false')).toBe(true);
    const labels = [...document.querySelectorAll('.eq-cat [aria-expanded]')].map(
      (r) => r.textContent ?? '',
    );
    const iBarbell = labels.findIndex((l) => /^Barbell/i.test(l));
    const iDumbbell = labels.findIndex((l) => /^Dumbbell/i.test(l));
    const iMachine = labels.findIndex((l) => /^Machine/i.test(l));
    expect(iBarbell).toBe(0);
    expect(iDumbbell).toBeGreaterThan(iBarbell);
    expect(iMachine).toBeGreaterThan(iDumbbell);
    expect(labels[0]).toMatch(/27$/);
    expect(document.querySelector('.eq-tile')).toBeNull();
  });

  it('expands and collapses a category', () => {
    setup();
    const row = catRow('Barbell');
    fireEvent.click(row);
    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelectorAll('.eq-tile')).toHaveLength(27);
    fireEvent.click(row);
    expect(document.querySelector('.eq-tile')).toBeNull();
  });

  it('shows a tile with name, muscle tags (max two) and a thumbnail', () => {
    setup();
    openCat('Barbell');
    const ez = tile(EZ);
    expect(ez.querySelector('img')).toBeTruthy();
    expect(ez.querySelectorAll('.eq-tile-mus > *').length).toBeLessThanOrEqual(2);
    expect(ez.querySelectorAll('.eq-tile-mus > *').length).toBeGreaterThan(0);
  });

  it('uses a placeholder for items without an image, and when the image fails to load', () => {
    setup();
    openCat('Barbell');
    expect(tile(CURL_CAMBERED).querySelector('.eq-thumb-ph')).toBeTruthy();
    expect(tile(CURL_CAMBERED).querySelector('img')).toBeNull();
    const img = tile(OLY).querySelector('img')!;
    expect(tile(OLY).querySelector('.eq-thumb-ph')).toBeNull();
    fireEvent.error(img);
    expect(tile(OLY).querySelector('img')).toBeNull();
    expect(tile(OLY).querySelector('.eq-thumb-ph')).toBeTruthy();
  });

  it('tapping a tile opens the machine detail for this gym', () => {
    const { openOverlay } = setup();
    openCat('Barbell');
    fireEvent.click(tile(EZ).querySelector('.eq-tile-main')!);
    expect(openOverlay).toHaveBeenCalledWith({ screen: 'equipment', itemId: EZ, gymId: 'g1' });
  });
});

describe('EquipmentBoard · selecting', () => {
  it('the corner control adds then removes an item, persisting the full selection each time', () => {
    setup();
    openCat('Barbell');
    const btn = () => toggleBtn(EZ);
    expect(btn().getAttribute('aria-pressed')).toBe('false');
    expect(btn().getAttribute('aria-label')).toBe(en().add);
    fireEvent.click(btn());
    expect(setGymEquipment).toHaveBeenLastCalledWith('g1', [EZ]);
    expect(btn().getAttribute('aria-pressed')).toBe('true');
    expect(btn().getAttribute('aria-label')).toBe(en().eqInThisGym);
    expect(tile(EZ).classList.contains('on')).toBe(true);
    fireEvent.click(toggleBtn(OLY));
    expect(setGymEquipment).toHaveBeenLastCalledWith('g1', [EZ, OLY]);
    fireEvent.click(btn());
    expect(setGymEquipment).toHaveBeenLastCalledWith('g1', [OLY]);
    expect(tile(EZ).classList.contains('on')).toBe(false);
  });

  it('the corner control does not open the detail', () => {
    const { openOverlay } = setup();
    openCat('Barbell');
    fireEvent.click(toggleBtn(EZ));
    expect(openOverlay).not.toHaveBeenCalled();
  });

  it('starts from the gym\'s saved items: ticked tiles, "n/total" on the row, count chip', () => {
    setup([EZ, OLY]);
    expect(catRow('Barbell').textContent).toMatch(/2\/27/);
    expect(screen.getByRole('button', { name: en().eqSelectedTitle }).textContent).toBe('2');
    openCat('Barbell');
    expect(toggleBtn(EZ).getAttribute('aria-pressed')).toBe('true');
    expect(toggleBtn(CURL_CAMBERED).getAttribute('aria-pressed')).toBe('false');
  });
});

describe('EquipmentBoard · search', () => {
  it('filters by localized name, auto-expands the matching categories and hides the rest', () => {
    setup();
    search('ez curl');
    expect(screen.getByText(name(EZ))).toBeTruthy();
    expect(screen.queryByText(name(OLY))).toBeNull();
    expect(catRow('Barbell').getAttribute('aria-expanded')).toBe('true');
    expect(screen.queryByRole('button', { name: /^Dumbbell/ })).toBeNull();
  });

  it('matches aliases in any word order', () => {
    setup();
    search('bar power');
    expect(screen.getByText(name(OLY))).toBeTruthy(); // aka "power bar"
  });

  it('matches brands', () => {
    setup();
    search('eleiko');
    expect(screen.getByText(name(OLY))).toBeTruthy();
  });

  it('shows a dash when nothing matches, and recovers when cleared', () => {
    setup();
    search('zzzzqqq');
    expect(document.querySelector('.eq-empty')!.textContent).toBe('—');
    expect(document.querySelector('.eq-cats')).toBeNull();
    search('');
    expect(document.querySelector('.eq-cats')).toBeTruthy();
    expect(document.querySelector('.eq-empty')).toBeNull();
  });

  it('a whitespace-only query is not a search', () => {
    setup();
    search('   ');
    expect(catRow('Barbell').getAttribute('aria-expanded')).toBe('false');
  });
});

describe('EquipmentBoard · muscle filter', () => {
  const chip = (label: string) =>
    within(document.querySelector('.eq-filter') as HTMLElement)
      .getByText(label)
      .closest('button, [role=button]') as HTMLElement;

  it('is hidden until the funnel is toggled, which reports aria-expanded', () => {
    setup();
    expect(document.querySelector('.eq-filter')).toBeNull();
    expect(funnel().getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(funnel());
    expect(funnel().getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('.eq-filter')).toBeTruthy();
    fireEvent.click(funnel());
    expect(document.querySelector('.eq-filter')).toBeNull();
  });

  it('offers only muscles the catalog tags, and filters items by the chosen ones', () => {
    setup();
    fireEvent.click(funnel());
    const offered = document.querySelectorAll('.eq-fchip');
    expect(offered.length).toBeGreaterThan(5);
    expect(offered.length).toBeLessThanOrEqual(15);
    fireEvent.click(chip('Biceps'));
    expect(funnel().textContent).toBe('1');
    expect(document.querySelector('.eq-matchline')!.textContent).toMatch(/^\d+ match$/);
    // filtering expands the categories; only equipment training biceps remains
    expect(screen.getByText(name(EZ))).toBeTruthy();
    expect(screen.queryByText(name(OLY))).toBeNull();
    const count = Number(document.querySelector('.eq-matchline')!.textContent!.split(' ')[0]);
    expect(document.querySelectorAll('.eq-tile')).toHaveLength(count);
  });

  it('several muscles widen the match; unticking one narrows it; Clear resets', () => {
    setup();
    fireEvent.click(funnel());
    fireEvent.click(chip('Biceps'));
    const one = document.querySelectorAll('.eq-tile').length;
    fireEvent.click(chip('Chest'));
    expect(funnel().textContent).toBe('2');
    expect(document.querySelectorAll('.eq-tile').length).toBeGreaterThan(one);
    fireEvent.click(chip('Chest'));
    expect(document.querySelectorAll('.eq-tile').length).toBe(one);
    fireEvent.click(screen.getByRole('button', { name: en().eqClearFilter }));
    expect(document.querySelector('.eq-matchline')).toBeNull();
    expect(document.querySelector('.eq-tile')).toBeNull();
    expect(screen.queryByRole('button', { name: en().eqClearFilter })).toBeNull();
  });

  it('combines with text search (both must hold)', () => {
    setup();
    fireEvent.click(funnel());
    fireEvent.click(chip('Biceps'));
    search('olympic');
    expect(document.querySelector('.eq-empty')).toBeTruthy();
    search('ez curl');
    expect(screen.getByText(name(EZ))).toBeTruthy();
  });

  it('"My focus" is offered only with grow goals and loads the matching muscle groups', () => {
    const a = setup();
    fireEvent.click(funnel());
    expect(screen.queryByRole('button', { name: en().eqMyFocus })).toBeNull();
    a.unmount();
    withGoals(['biceps', 'quads']);
    setup();
    fireEvent.click(funnel());
    fireEvent.click(screen.getByRole('button', { name: en().eqMyFocus }));
    expect(funnel().textContent).toBe('2');
    expect(chip('Biceps').closest('.eq-fchip')!.classList.contains('on')).toBe(true);
    expect(chip('Quads').closest('.eq-fchip')!.classList.contains('on')).toBe(true);
    expect(chip('Chest').closest('.eq-fchip')!.classList.contains('on')).toBe(false);
  });
});

describe('EquipmentBoard · manage selected', () => {
  const sheet = () => document.querySelector('.eq-manage') as HTMLElement;
  const dialog = (title: string) =>
    screen.getByText(title).closest('[role=dialog], [role=alertdialog]') as HTMLElement;

  it('the count chip opens a sheet listing the picked items alphabetically with a total', () => {
    setup([OLY, EZ]);
    fireEvent.click(screen.getByRole('button', { name: en().eqSelectedTitle }));
    expect(screen.getByText(en().eqSelectedTitle, { selector: '.ep-title' })).toBeTruthy();
    const names = [...sheet().querySelectorAll('.eq-manage-name')].map((n) => n.textContent);
    expect(names).toEqual([name(EZ), name(OLY)].sort((a, b) => a.localeCompare(b)));
    expect(sheet().querySelector('.eq-manage-row img')).toBeTruthy();
  });

  it('shows the placeholder for a picked item with no image, and after an image error', () => {
    setup([CURL_CAMBERED, OLY]);
    fireEvent.click(screen.getByRole('button', { name: en().eqSelectedTitle }));
    const rows = [...sheet().querySelectorAll('.eq-manage-row')] as HTMLElement[];
    const row = (n: string) => rows.find((r) => r.textContent!.includes(n))!;
    expect(row(name(CURL_CAMBERED)).querySelector('.eq-thumb-ph')).toBeTruthy();
    fireEvent.error(row(name(OLY)).querySelector('img')!);
    expect(row(name(OLY)).querySelector('.eq-thumb-ph')).toBeTruthy();
  });

  it('ignores saved ids that are no longer in the catalog', () => {
    setup(['gone-item', EZ]);
    fireEvent.click(screen.getByRole('button', { name: en().eqSelectedTitle }));
    expect(sheet().querySelectorAll('.eq-manage-row')).toHaveLength(1);
    expect(screen.getByRole('button', { name: en().eqSelectedTitle }).textContent).toBe('2'); // the gym still counts it
  });

  it('removing one asks first; confirming persists, snacks, and Undo restores', () => {
    const { snack } = setup([EZ, OLY]);
    fireEvent.click(screen.getByRole('button', { name: en().eqSelectedTitle }));
    fireEvent.click(within(sheet()).getAllByRole('button', { name: en().eqRemove })[0]);
    expect(screen.getByText(en().eqRemoveOneTitle)).toBeTruthy();
    expect(screen.getByText(en().eqRemoveOneBody(name(EZ)))).toBeTruthy();
    expect(setGymEquipment).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog(en().eqRemoveOneTitle)).getByRole('button', { name: en().eqRemove }),
    );
    expect(setGymEquipment).toHaveBeenLastCalledWith('g1', [OLY]);
    expect(snack).toHaveBeenCalledWith(
      expect.objectContaining({ text: en().eqRemovedSnack(name(EZ)) }),
    );
    expect(screen.getByRole('button', { name: en().eqSelectedTitle }).textContent).toBe('1');
    act(() => snack.mock.calls[0][0].onUndo());
    expect(setGymEquipment).toHaveBeenLastCalledWith('g1', [EZ, OLY]);
  });

  it('cancelling the confirmation changes nothing', () => {
    setup([EZ, OLY]);
    fireEvent.click(screen.getByRole('button', { name: en().eqSelectedTitle }));
    fireEvent.click(within(sheet()).getAllByRole('button', { name: en().eqRemove })[0]);
    fireEvent.click(
      within(dialog(en().eqRemoveOneTitle)).getByRole('button', { name: en().cancel }),
    );
    expect(screen.queryByText(en().eqRemoveOneTitle)).toBeNull();
    expect(setGymEquipment).not.toHaveBeenCalled();
    expect(sheet().querySelectorAll('.eq-manage-row')).toHaveLength(2);
  });

  it('removing the last item closes the sheet', () => {
    setup([EZ]);
    fireEvent.click(screen.getByRole('button', { name: en().eqSelectedTitle }));
    fireEvent.click(within(sheet()).getByRole('button', { name: en().eqRemove }));
    fireEvent.click(
      within(dialog(en().eqRemoveOneTitle)).getByRole('button', { name: en().eqRemove }),
    );
    expect(setGymEquipment).toHaveBeenLastCalledWith('g1', []);
    expect(document.querySelector('.eq-manage')).toBeNull();
    expect(screen.queryByRole('button', { name: en().eqSelectedTitle })).toBeNull();
  });

  it('clear all asks first, then empties, closes the sheet and offers Undo', () => {
    const { snack } = setup([EZ, OLY]);
    fireEvent.click(screen.getByRole('button', { name: en().eqSelectedTitle }));
    fireEvent.click(within(sheet()).getByRole('button', { name: new RegExp(en().eqClearAll) }));
    expect(screen.getByText(en().eqClearAllTitle)).toBeTruthy();
    expect(screen.getByText(en().eqClearAllBody(2))).toBeTruthy();
    expect(setGymEquipment).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog(en().eqClearAllTitle)).getByRole('button', { name: en().eqClearAll }),
    );
    expect(setGymEquipment).toHaveBeenLastCalledWith('g1', []);
    expect(document.querySelector('.eq-manage')).toBeNull();
    expect(snack).toHaveBeenCalledWith(expect.objectContaining({ text: en().eqClearedSnack(2) }));
    act(() => snack.mock.calls[0][0].onUndo());
    expect(setGymEquipment).toHaveBeenLastCalledWith('g1', [EZ, OLY]);
    expect(screen.getByRole('button', { name: en().eqSelectedTitle }).textContent).toBe('2');
  });

  it('cancelling clear-all keeps everything', () => {
    setup([EZ]);
    fireEvent.click(screen.getByRole('button', { name: en().eqSelectedTitle }));
    fireEvent.click(within(sheet()).getByRole('button', { name: new RegExp(en().eqClearAll) }));
    fireEvent.click(
      within(dialog(en().eqClearAllTitle)).getByRole('button', { name: en().cancel }),
    );
    expect(setGymEquipment).not.toHaveBeenCalled();
    expect(screen.queryByText(en().eqClearAllTitle)).toBeNull();
  });
});
