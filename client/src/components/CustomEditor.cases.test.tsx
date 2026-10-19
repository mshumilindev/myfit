import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { LOCALES, setLocale } from '../i18n';
import { CustomEditor } from './ExerciseGallery';

const en = () => LOCALES.en;

beforeEach(() => setLocale('en'));
afterEach(cleanup);

describe('CustomEditor', () => {
  const init = { id: null, name: '', primary: null, secondary: [], equipment: [] };
  const chipsRow = (label: string) => screen.getByText(label).nextElementSibling as HTMLElement;
  const pick = (row: HTMLElement, name: string) =>
    fireEvent.click(within(row).getByRole('button', { name }));
  const on = (row: HTMLElement, name: string) =>
    within(row).getByRole('button', { name }).getAttribute('aria-pressed');

  it('a blank or whitespace name cannot be saved', () => {
    render(<CustomEditor init={init} onClose={() => undefined} onSave={() => undefined} />);
    const save = screen.getByRole('button', { name: en().libCreateExercise }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText(en().exerciseNamePlaceholder), {
      target: { value: '   ' },
    });
    expect(save.disabled).toBe(true);
  });

  it('choosing a primary removes it from the secondary list, and toggling it off clears it', () => {
    const onSave = vi.fn();
    render(
      <CustomEditor
        init={{ ...init, name: 'X', secondary: ['back'] }}
        onClose={() => undefined}
        onSave={onSave}
      />,
    );
    const primary = chipsRow(en().primaryMuscleLabel);
    const secondary = () => chipsRow(en().secondaryMuscleLabel);
    expect(on(secondary(), 'Back')).toBe('true');
    pick(primary, 'Back');
    expect(within(secondary()).queryByRole('button', { name: 'Back' })).toBeNull(); // hidden: it is the primary now
    fireEvent.click(screen.getByRole('button', { name: en().libCreateExercise }));
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({ primary: 'back', secondary: [] }),
    );
    pick(primary, 'Back'); // toggle off
    fireEvent.click(screen.getByRole('button', { name: en().libCreateExercise }));
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ primary: null }));
  });

  it('secondary muscles toggle on and off', () => {
    const onSave = vi.fn();
    render(
      <CustomEditor init={{ ...init, name: 'X' }} onClose={() => undefined} onSave={onSave} />,
    );
    const secondary = chipsRow(en().secondaryMuscleLabel);
    pick(secondary, 'Core');
    pick(secondary, 'Glutes');
    pick(secondary, 'Core');
    fireEvent.click(screen.getByRole('button', { name: en().libCreateExercise }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ secondary: ['glutes'] }));
  });

  it('equipment is single-choice: picking another replaces, picking the same clears', () => {
    const onSave = vi.fn();
    render(
      <CustomEditor init={{ ...init, name: 'X' }} onClose={() => undefined} onSave={onSave} />,
    );
    const eq = chipsRow(en().equipmentLabelField);
    pick(eq, 'Barbell');
    pick(eq, 'Cable');
    fireEvent.click(screen.getByRole('button', { name: en().libCreateExercise }));
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ equipment: ['cable'] }));
    pick(eq, 'Cable');
    fireEvent.click(screen.getByRole('button', { name: en().libCreateExercise }));
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ equipment: [] }));
  });

  it('chest and shoulders offer fine sub-regions; selections are saved only for the active groups', () => {
    const onSave = vi.fn();
    render(
      <CustomEditor init={{ ...init, name: 'X' }} onClose={() => undefined} onSave={onSave} />,
    );
    expect(screen.queryByText(en().subRegionsLabel)).toBeNull();
    pick(chipsRow(en().primaryMuscleLabel), 'Chest');
    const sub = chipsRow(en().subRegionsLabel);
    pick(sub, 'Upper chest');
    pick(chipsRow(en().secondaryMuscleLabel), 'Shoulders');
    const subSec = chipsRow(en().subRegionsSecondaryLabel);
    pick(subSec, 'Rear delt');
    fireEvent.click(screen.getByRole('button', { name: en().libCreateExercise }));
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        subRegions: { primary: ['chest-upper'], secondary: ['delt-rear'] },
      }),
    );
    // un-picking a sub-region again, and dropping the shoulders group, drops them from the result
    pick(sub, 'Upper chest');
    pick(chipsRow(en().secondaryMuscleLabel), 'Shoulders');
    fireEvent.click(screen.getByRole('button', { name: en().libCreateExercise }));
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ subRegions: undefined }));
  });

  it('a stale sub-region from a changed primary is not saved', () => {
    const onSave = vi.fn();
    render(
      <CustomEditor
        init={{ ...init, name: 'X', primary: 'chest', subRegions: { primary: ['chest-lower'] } }}
        onClose={() => undefined}
        onSave={onSave}
      />,
    );
    pick(chipsRow(en().primaryMuscleLabel), 'Back');
    fireEvent.click(screen.getByRole('button', { name: en().libCreateExercise }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ primary: 'back', subRegions: undefined }),
    );
  });

  it('prefills sub-regions of a built-in lift being cloned, and an edit shows Save', () => {
    const onSave = vi.fn();
    render(
      <CustomEditor
        init={{
          ...init,
          id: 'e1',
          name: 'X',
          primary: 'shoulders',
          subRegions: { primary: ['delt-side'] },
        }}
        onClose={() => undefined}
        onSave={onSave}
      />,
    );
    expect(screen.getByText(en().libEditExercise)).toBeTruthy();
    expect(on(chipsRow(en().subRegionsLabel), 'Side delt')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: en().save }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'e1', subRegions: { primary: ['delt-side'] } }),
    );
  });
});
