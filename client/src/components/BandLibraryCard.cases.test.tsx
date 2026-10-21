import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setLocale } from '../i18n';
import type { Gym } from '../types';
import { BAND_COLORS } from '../loads';

const setLib = vi.fn();
vi.mock('../store', async (orig) => ({
  ...(await orig<typeof import('../store')>()),
  setGymBandLibrary: (...a: unknown[]) => setLib(...a),
}));

import { BandLibraryCard } from './BandLibraryCard';

const gym = (bandLibrary?: Gym['bandLibrary']): Gym =>
  ({ id: 'g1', name: 'Iron', equipment: [], bandLibrary }) as unknown as Gym;

beforeEach(() => {
  setLocale('en');
  setLib.mockReset();
});
afterEach(cleanup);

const kgInputs = () => screen.getAllByRole('spinbutton') as HTMLInputElement[];
const saveBtn = () =>
  screen.getByRole('button', { name: /Save library|Saved/ }) as HTMLButtonElement;

describe('BandLibraryCard', () => {
  it('starts empty (and Save disabled) for a gym without a library', () => {
    render(<BandLibraryCard gym={gym()} />);
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
    expect(saveBtn().disabled).toBe(true);
  });

  it('seeds the defaults when asked, and they count as clean (not dirty)', () => {
    render(<BandLibraryCard gym={gym()} seedDefaults />);
    expect(kgInputs().map((i) => i.value)).toEqual(['7', '11', '15', '23']);
    expect(saveBtn().disabled).toBe(true);
  });

  it('shows the gym library over the defaults', () => {
    render(<BandLibraryCard gym={gym([{ color: 'blue', kg: 30 }])} seedDefaults />);
    expect(kgInputs().map((i) => i.value)).toEqual(['30']);
    expect(screen.getByText('Blue')).toBeTruthy();
  });

  it('adds a row in the first unused colour, and falls back to yellow when all are used', () => {
    render(<BandLibraryCard gym={gym([{ color: 'yellow', kg: 5 }])} />);
    fireEvent.click(screen.getByRole('button', { name: /Add band/ }));
    expect(screen.getAllByText('Green')).toHaveLength(1);
    expect(kgInputs()).toHaveLength(2);
    expect(saveBtn().disabled).toBe(false);
  });

  it('adds yellow once every palette colour is used', () => {
    const all = BAND_COLORS.map((c, i) => ({ color: c, kg: i + 1 })) as Gym['bandLibrary'];
    render(<BandLibraryCard gym={gym(all)} />);
    fireEvent.click(screen.getByRole('button', { name: /Add band/ }));
    expect(kgInputs()).toHaveLength(all!.length + 1);
    expect(kgInputs().at(-1)!.value).toBe('0');
    expect(document.querySelectorAll('.band-lib-name')[all!.length].textContent).toBe('Yellow');
  });

  it('edits kg, clamps negatives and garbage to 0', () => {
    render(<BandLibraryCard gym={gym([{ color: 'red', kg: 15 }])} />);
    const input = kgInputs()[0];
    fireEvent.change(input, { target: { value: '12.5' } });
    expect(input.value).toBe('12.5');
    fireEvent.change(input, { target: { value: '-4' } });
    expect(input.value).toBe('0');
    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('0');
  });

  it('opens the swatch picker, marks the current colour and switches colour', () => {
    render(<BandLibraryCard gym={gym([{ color: 'red', kg: 15 }])} />);
    const trigger = screen.getAllByRole('button', { name: 'Red' })[0];
    fireEvent.click(trigger);
    expect(document.querySelectorAll('.band-swatches button')).toHaveLength(BAND_COLORS.length);
    expect(
      document.querySelector('.band-swatches [aria-pressed="true"]')!.getAttribute('aria-label'),
    ).toBe('Red');
    fireEvent.click(document.querySelector('.band-swatches [aria-label="Blue"]')!);
    expect(document.querySelector('.band-swatches')).toBeNull();
    expect(document.querySelector('.band-lib-name')!.textContent).toBe('Blue');
  });

  it('toggles the swatch picker closed on a second tap', () => {
    render(<BandLibraryCard gym={gym([{ color: 'red', kg: 15 }])} />);
    const trigger = screen.getAllByRole('button', { name: 'Red' })[0];
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(document.querySelector('.band-swatches')).toBeNull();
  });

  it('removes a row', () => {
    render(
      <BandLibraryCard
        gym={gym([
          { color: 'red', kg: 15 },
          { color: 'blue', kg: 30 },
        ])}
      />,
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    expect(kgInputs().map((i) => i.value)).toEqual(['30']);
  });

  it('saves the rungs sorted by kg and notifies the parent', () => {
    const onSaved = vi.fn();
    render(
      <BandLibraryCard
        gym={gym([
          { color: 'blue', kg: 30 },
          { color: 'red', kg: 15 },
        ])}
        onSaved={onSaved}
      />,
    );
    fireEvent.change(kgInputs()[0], { target: { value: '5' } });
    fireEvent.click(saveBtn());
    expect(setLib).toHaveBeenCalledWith('g1', [
      { color: 'blue', kg: 5 },
      { color: 'red', kg: 15 },
    ]);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('shows "Saved" once the saved library matches the editor, and "Save" again after an edit', () => {
    const lib = [{ color: 'red', kg: 15 }] as Gym['bandLibrary'];
    const { rerender } = render(<BandLibraryCard gym={gym(lib)} />);
    fireEvent.change(kgInputs()[0], { target: { value: '16' } });
    fireEvent.click(saveBtn());
    rerender(<BandLibraryCard gym={gym([{ color: 'red', kg: 16 }])} />);
    expect(saveBtn().textContent).toBe('Saved');
    expect(saveBtn().disabled).toBe(true);
    fireEvent.change(kgInputs()[0], { target: { value: '17' } });
    expect(saveBtn().textContent).toBe('Save library');
  });
});
