import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { addonsPref } from '../../addons/enabledSet';
import '../../periodization/periodizationBoot';
import { setLocale } from '../../i18n';
import { en } from '../../i18n/en';
import { freezeClock, setDesktop } from '../__fixtures__/viewKit';
import { AssigneesSheet } from './AssigneesSheet';
import { freshProgram, type Program } from './model';

const program = (cycle?: Program['cycle']): Program => ({
  ...freshProgram('5/3/1'),
  id: 'p1',
  weeks: 8,
  status: 'active',
  ...(cycle ? { cycle } : {}),
});
const cycle = { length: 4, weeks: [] } as unknown as Program['cycle'];

function open(p: Program) {
  const onSave = vi.fn(async () => undefined);
  render(
    <AssigneesSheet
      program={p}
      people={[{ id: 'a', name: 'Ada Lovelace' }]}
      assignments={[]}
      programNames={new Map()}
      onSave={onSave}
      onClose={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('checkbox', { name: /Ada/ }));
  return onSave;
}

beforeEach(() => {
  freezeClock();
  setLocale('en');
  setDesktop(false);
});
afterEach(() => {
  cleanup();
  addonsPref.reset();
});

describe('start week of a cycle program', () => {
  it('module on and a cycle: asks which week to start on and passes it', async () => {
    addonsPref.set(['periodization']);
    const onSave = open(program(cycle));
    expect(screen.getAllByLabelText('Start in cycle week').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${en.save}`) }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(['a'], [], 1));
  });
  it('module off: no field, and the call is the plain two-argument one', async () => {
    const onSave = open(program(cycle));
    expect(screen.queryAllByLabelText('Start in cycle week')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${en.save}`) }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(['a'], []));
  });
  it('no cycle: no field even with the module on', () => {
    addonsPref.set(['periodization']);
    open(program());
    expect(screen.queryAllByLabelText('Start in cycle week')).toHaveLength(0);
  });
});
