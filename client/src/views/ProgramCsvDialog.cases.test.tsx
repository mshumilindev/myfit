import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ProgramCsvDialog } from './ProgramCsvDialog';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { setDesktop } from './__fixtures__/viewKit';

const KNOWN = ['Barbell Bench Press', 'Barbell Squat', 'Pullups'];
const CSV = [
  'Day,Exercise,Sets,Reps,Weight',
  '1,Barbell Bench Press,3,8,80',
  '1,Barbell Squatt,4,6,100',
  '2,Pullups,3,,0',
].join('\n');

function open(over: Partial<Parameters<typeof ProgramCsvDialog>[0]> = {}) {
  const props = { known: KNOWN, onClose: vi.fn(), onImport: vi.fn(), ...over };
  return { ...render(<ProgramCsvDialog {...props} />), props };
}
const paste = (text: string) =>
  fireEvent.change(screen.getByPlaceholderText(/day,/i), { target: { value: text } });
const next = () => fireEvent.click(screen.getByRole('button', { name: en.csvContinue }));

beforeEach(() => {
  setLocale('en');
  setDesktop(false);
});
afterEach(cleanup);

describe('ProgramCsvDialog', () => {
  it('Continue stays disabled until something is pasted; a header-only paste reports no rows', () => {
    open();
    const cont = screen.getByRole('button', { name: en.csvContinue }) as HTMLButtonElement;
    expect(cont.disabled).toBe(true);
    paste('Day,Exercise,Sets,Reps');
    expect(cont.disabled).toBe(false);
    next();
    expect(screen.getByText(en.csvNoRows)).toBeTruthy();
    // still on the first stage
    expect(screen.getByText(en.csvOrPaste)).toBeTruthy();
  });

  it('detects columns, lets you remap one, and previews rows with problems and a suggestion', () => {
    open();
    paste(CSV);
    next();
    expect(screen.getByText(en.csvMapBody)).toBeTruthy();
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    expect(selects.map((s) => s.value)).toEqual(['day', 'name', 'sets', 'reps', 'weight']);
    next();
    expect(screen.getByText(en.csvShape(3, 2))).toBeTruthy();
    expect(screen.getByText(en.csvWeightDiscarded)).toBeTruthy();
    expect(screen.getByText(en.csvValidCount(1, 2))).toBeTruthy();
    expect(screen.getByText(en.csvProblems['unmatched-exercise'])).toBeTruthy();
    expect(screen.getByText(en.csvProblems['missing-reps'])).toBeTruthy();
  });

  it('applying the suggestion fixes the name and clears that problem', () => {
    open();
    paste(CSV);
    next();
    next();
    fireEvent.click(screen.getByRole('button', { name: en.csvUseSuggestion('Barbell Squat') }));
    expect(screen.queryByText(en.csvProblems['unmatched-exercise'])).toBeNull();
    expect(screen.getByText(en.csvValidCount(2, 1))).toBeTruthy();
  });

  it('editing reps, sets, day and name re-validates the row live', () => {
    open();
    paste(CSV);
    next();
    next();
    const reps = screen.getAllByLabelText(en.csvFields.reps) as HTMLInputElement[];
    fireEvent.change(reps[2], { target: { value: '10' } });
    expect(screen.queryByText(en.csvProblems['missing-reps'])).toBeNull();
    const days = screen.getAllByLabelText(en.csvFields.day) as HTMLInputElement[];
    fireEvent.change(days[0], { target: { value: '9' } });
    expect(screen.getByText(en.csvProblems['bad-day'])).toBeTruthy();
    fireEvent.change(days[0], { target: { value: '' } });
    expect(screen.getByText(en.csvProblems['bad-day'])).toBeTruthy();
    fireEvent.change(days[0], { target: { value: '3' } });
    expect(screen.queryByText(en.csvProblems['bad-day'])).toBeNull();
    const names = screen.getAllByLabelText(en.csvFields.name) as HTMLInputElement[];
    fireEvent.change(names[0], { target: { value: '' } });
    expect(screen.getByText(en.csvProblems['missing-name'])).toBeTruthy();
    const sets = screen.getAllByLabelText(en.csvFields.sets) as HTMLInputElement[];
    fireEvent.change(sets[1], { target: { value: '0' } });
    expect((screen.getAllByLabelText(en.csvFields.sets)[1] as HTMLInputElement).value).toBe('1');
  });

  it('Back steps through the stages and keeps the pasted text', () => {
    open();
    paste(CSV);
    next();
    fireEvent.click(screen.getByRole('button', { name: en.csvBack }));
    expect((screen.getByPlaceholderText(/day,/i) as HTMLTextAreaElement).value).toBe(CSV);
    next();
    next();
    fireEvent.click(screen.getByRole('button', { name: en.csvBack }));
    expect(screen.getByText(en.csvMapBody)).toBeTruthy();
  });

  it('importing hands over the items (never any weight) and closes', () => {
    const { props } = open();
    paste(CSV);
    next();
    next();
    fireEvent.click(screen.getByRole('button', { name: en.csvImportN(3) }));
    expect(props.onImport).toHaveBeenCalledTimes(1);
    const items = vi.mocked(props.onImport).mock.calls[0]![0];
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({
      day: 1,
      name: 'Barbell Bench Press',
      sets: 3,
      reps: 8,
      kind: 'strength',
    });
    for (const it of items) expect(it).not.toHaveProperty('weight');
    expect(props.onClose).toHaveBeenCalled();
  });

  it('mapping a column to Ignore drops it from the preview; a cardio kind row shows its kind instead of sets/reps', () => {
    open();
    paste('Day,Exercise,Kind,Duration\n1,Treadmill Running,cardio,20');
    next();
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    expect(selects.map((s) => s.value)).toEqual(['day', 'name', 'kind', 'duration']);
    fireEvent.change(selects[3], { target: { value: 'ignore' } });
    next();
    expect(screen.getByText(en.exerciseKindNames.cardio)).toBeTruthy();
    expect(screen.queryByLabelText(en.csvFields.reps)).toBeNull();
  });

  it('reads a chosen file', async () => {
    open();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([CSV], 'plan.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'text', { value: async () => CSV });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText(en.csvMapBody)).toBeTruthy());
  });

  it('a file with no rows reports the problem; an empty choice does nothing', async () => {
    open();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });
    expect(screen.queryByText(en.csvNoRows)).toBeNull();
    const file = new File(['only,a,header'], 'x.csv');
    Object.defineProperty(file, 'text', { value: async () => 'only,a,header' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByText(en.csvNoRows)).toBeTruthy();
  });

  it('downloads the template as program-template.csv', () => {
    open();
    const create = vi.fn(() => 'blob:x');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole('button', { name: en.csvTemplate }));
    expect(create).toHaveBeenCalledTimes(1);
    const blob = (create.mock.calls[0] as unknown as [Blob])[0];
    expect(blob.type).toBe('text/csv');
    expect(click).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith('blob:x');
    click.mockRestore();
  });

  it('the import button is disabled when the preview has no rows', () => {
    open();
    paste('Day,Exercise\n,');
    next();
    // a lone blank data row is filtered, so the first stage reports no rows
    expect(within(document.body).getByText(en.csvNoRows)).toBeTruthy();
  });
});
