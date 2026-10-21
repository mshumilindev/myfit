import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { EquipmentDetailView } from './EquipmentDetailView';
import { enrichedCatalog, equipmentById } from '../data/equipmentCatalog';
import { localizedEquipName } from '../data/equipmentI18n';
import { __getStateForTests } from '../store';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { emptyState, freezeClock, makeShell, seed } from './__fixtures__/viewKit';

const cat = enrichedCatalog();
const legPress =
  cat.find((e) => e.id.includes('leg-press')) ?? cat.find((e) => e.muscles.includes('quads'))!;
const withModels = cat.find((e) => e.models && e.models.length > 0 && e.muscles.length > 0)!;
const withAka = cat.find((e) => e.aka && e.aka.length > 0)!;
const noMuscles = cat.find(
  (e) => e.muscles.filter((m) => m !== 'cardio' && m !== 'fullbody').length === 0,
)!;
const barbell =
  cat.find((e) => e.id === 'barbell-olympic') ?? cat.find((e) => e.category === 'barbell')!;

beforeEach(() => {
  freezeClock();
  setLocale('en');
  seed({
    ...emptyState(),
    gyms: [
      { id: 'g2', name: 'Home Rack', lat: 5, lng: 5, radiusM: 50, equipmentItems: [barbell.id] },
    ],
  } as never);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const open = (itemId: string, gymId?: string) => {
  const shell = makeShell();
  const onClose = vi.fn();
  const out = render(
    <EquipmentDetailView itemId={itemId} gymId={gymId} shell={shell} onClose={onClose} />,
  );
  return { ...out, shell, onClose };
};

describe('EquipmentDetailView', () => {
  it('an unknown item shows a dash and a working back button', () => {
    const { onClose } = open('no-such-item');
    expect(screen.getByText('—')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.backAction }));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the name, category, what it is and the muscles it works', () => {
    const { container } = open(legPress.id);
    expect(container.querySelector('.eqd-title')?.textContent).toBe(
      localizedEquipName(legPress, 'en'),
    );
    expect(container.querySelector('.eqd-cat')?.textContent?.length).toBeGreaterThan(0);
    expect(screen.getByText(en.eqMusclesWorked)).toBeTruthy();
    expect(screen.getByText(en.eqPrimary)).toBeTruthy();
    expect(container.querySelectorAll('.eqd-chips')[0].children.length).toBe(
      legPress.muscles.length,
    );
  });

  it('lists up to eight exercises for it and opens one', () => {
    const { container, shell } = open(legPress.id);
    expect(screen.getByText(en.eqExercisesOnIt)).toBeTruthy();
    const rows = container.querySelectorAll('.eqd-exs button');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(8);
    expect(container.querySelector('.eqd-count')?.textContent).toBe(String(rows.length));
    fireEvent.click(rows[0]);
    expect(shell.openOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ screen: 'exercise-detail' }),
    );
  });

  it('"Log a set" starts a workout with the first exercise and opens the session', () => {
    const { shell } = open(legPress.id);
    expect(__getStateForTests().workouts.length).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.eqLogSet) }));
    const w = __getStateForTests().workouts[0];
    expect(w.finishedAt).toBeNull();
    expect(w.exercises).toHaveLength(1);
    expect(shell.openOverlay).toHaveBeenCalledWith({ screen: 'session', workoutId: w.id });
  });

  it('"Log a set" adds to the workout already in progress instead of starting another', () => {
    const { shell } = open(legPress.id);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.eqLogSet) }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.eqLogSet) }));
    const ws = __getStateForTests().workouts;
    expect(ws).toHaveLength(1);
    expect(shell.openOverlay).toHaveBeenCalledTimes(2);
  });

  it('kit that is not trained on (no muscles) shows no exercise list and no log button', () => {
    open(noMuscles.id);
    expect(screen.queryByText(en.eqExercisesOnIt)).toBeNull();
    expect(screen.queryByRole('button', { name: new RegExp(en.eqLogSet) })).toBeNull();
  });

  it('shows model lines and aliases when the catalog has them', () => {
    const { container } = open(withModels.id);
    expect(screen.getByText(en.eqCommonModels)).toBeTruthy();
    expect(container.querySelectorAll('.eqd-model').length).toBe(withModels.models!.length);
    expect(container.querySelector('.eqd-model-brand')?.textContent).toBe(
      withModels.models![0].brand,
    );
    cleanup();
    const out = open(withAka.id);
    expect(screen.getByText(en.eqAlsoKnownAs)).toBeTruthy();
    expect([...out.container.querySelectorAll('.eqd-aka')].map((a) => a.textContent)).toEqual(
      withAka.aka,
    );
  });

  it('suggests up to six same-muscle alternatives and opens one, carrying the gym', () => {
    const { container, shell } = open(legPress.id, 'g2');
    const alts = container.querySelectorAll('.eqd-alt');
    expect(alts.length).toBeGreaterThan(0);
    expect(alts.length).toBeLessThanOrEqual(6);
    const first = alts[0] as HTMLElement;
    fireEvent.click(first);
    const call = (shell.openOverlay as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.screen).toBe('equipment');
    expect(call.gymId).toBe('g2');
    expect(equipmentById(call.itemId)).toBeTruthy();
    expect(call.itemId).not.toBe(legPress.id);
  });

  it('without a gym there is no add-to-gym button and alternatives carry no here/not-here flag', () => {
    const { container } = open(legPress.id);
    expect(screen.queryByRole('button', { name: en.eqAddToGym })).toBeNull();
    expect(container.querySelector('.eqd-alt-flag')).toBeNull();
  });

  it('with a gym: add to it, then it reads "In this gym" and can be removed again', () => {
    open(legPress.id, 'g2');
    fireEvent.click(screen.getByRole('button', { name: en.eqAddToGym }));
    expect(__getStateForTests().gyms[0].equipmentItems).toContain(legPress.id);
    expect(screen.getByRole('button', { name: en.eqInThisGym })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.eqInThisGym }));
    expect(__getStateForTests().gyms[0].equipmentItems).not.toContain(legPress.id);
    expect(screen.getByRole('button', { name: en.eqAddToGym })).toBeTruthy();
  });

  it('flags each alternative as here or not here for that gym', () => {
    const probe = open(legPress.id, 'g2');
    const shell0 = probe.shell;
    fireEvent.click(probe.container.querySelector('.eqd-alt') as HTMLElement);
    const altId = (shell0.openOverlay as ReturnType<typeof vi.fn>).mock.calls[0][0]
      .itemId as string;
    cleanup();
    seed({
      ...emptyState(),
      gyms: [{ id: 'g2', name: 'Home Rack', lat: 5, lng: 5, radiusM: 50, equipmentItems: [altId] }],
    } as never);
    const { container } = open(legPress.id, 'g2');
    const flags = [...container.querySelectorAll('.eqd-alt-flag')];
    expect(flags.length).toBeGreaterThan(0);
    expect(
      flags.some((f) => f.classList.contains('on') && f.textContent?.includes(en.eqHere)),
    ).toBe(true);
    expect(flags.some((f) => !f.classList.contains('on') && f.textContent === en.eqNotHere)).toBe(
      true,
    );
  });

  it('mentions the muscles that are on the current block grow list', () => {
    seed({
      ...emptyState(),
      goals: { focus: { label: 'B', startedAt: 1, weeks: 6, emphasis: { quads: 'grow' } } },
    } as never);
    open(legPress.id);
    expect(
      screen.getByText(new RegExp(`${en.eqHits} .*${en.muscleGroups.quads}.* ${en.eqOnGrowList}`)),
    ).toBeTruthy();
  });

  it('no goal line when nothing it trains is on the grow list', () => {
    open(legPress.id);
    expect(screen.queryByText(new RegExp(en.eqOnGrowList))).toBeNull();
  });

  it('hides a photo that fails to load', () => {
    const withImg = cat.find((e) => e.image)!;
    const { container } = open(withImg.id);
    const img = container.querySelector('.eqd-hero img') as HTMLImageElement;
    fireEvent.error(img);
    expect(img.style.display).toBe('none');
  });

  it('localises the name for the selected language', () => {
    setLocale('uk');
    const { container } = open(legPress.id);
    expect(container.querySelector('.eqd-title')?.textContent).toBe(
      localizedEquipName(legPress, 'uk'),
    );
    within(container).getByText(/./, { selector: '.eqd-title' });
  });
});
