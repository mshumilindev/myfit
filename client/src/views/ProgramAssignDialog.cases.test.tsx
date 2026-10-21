import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { ProgramAssignDialog } from './ProgramAssignDialog';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { freezeClock, setDesktop } from './__fixtures__/viewKit';

const CLIENTS = [
  { id: 'u1', name: 'Ada Lovelace' },
  { id: 'u2', name: 'Bob Marley' },
  { id: 'u3', name: 'Adam West' },
];

function Harness(p: {
  clients?: typeof CLIENTS;
  weeks?: number;
  onConfirm?: (w: number) => Promise<void>;
  onClose?: () => void;
  initial?: string[];
}) {
  const [ids, setIds] = useState<string[]>(p.initial ?? []);
  return (
    <ProgramAssignDialog
      clients={p.clients ?? CLIENTS}
      programName="Push Pull"
      selectedIds={ids}
      onToggle={(id) => setIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))}
      weeks={p.weeks ?? 4}
      onClose={p.onClose ?? (() => undefined)}
      onConfirm={p.onConfirm ?? (async () => undefined)}
    />
  );
}

beforeEach(() => {
  freezeClock(); // Saturday 26 Sep 2026
  setLocale('en');
  setDesktop(false);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ProgramAssignDialog', () => {
  it('with no clients explains it and keeps Assign disabled', () => {
    render(<Harness clients={[]} />);
    expect(screen.getByText(en.progNoClients)).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: en.assignConfirmN(0) }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('titles the sheet with the program and warns that the active program is replaced', () => {
    render(<Harness />);
    expect(screen.getByText(en.assignTitle('Push Pull'))).toBeTruthy();
    expect(screen.getByText(en.assignReplaceWarn)).toBeTruthy();
    expect(screen.getByText(en.assignStartPoint(1, 'Saturday'))).toBeTruthy();
  });

  it('selects and deselects members, showing chips and a count on the confirm button', () => {
    render(<Harness />);
    const confirm = () => screen.getByRole('button', { name: /^Assign/ }) as HTMLButtonElement;
    expect(confirm().disabled).toBe(true);
    fireEvent.click(screen.getByText('Ada Lovelace'));
    expect(confirm().textContent).toBe(en.assignConfirmN(1));
    fireEvent.click(screen.getByText('Bob Marley'));
    expect(confirm().textContent).toBe(en.assignConfirmN(2));
    expect(confirm().disabled).toBe(false);
    // the selected chip removes the member again
    const chips = document.querySelectorAll('.equipment-chips button');
    expect(chips.length).toBe(2);
    fireEvent.click(chips[0]);
    expect(confirm().textContent).toBe(en.assignConfirmN(1));
  });

  it('filters members by the search text, case-insensitively', () => {
    render(<Harness />);
    fireEvent.change(screen.getByPlaceholderText(en.assignSearchMembers), {
      target: { value: ' ADA ' },
    });
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.getByText('Adam West')).toBeTruthy();
    expect(screen.queryByText('Bob Marley')).toBeNull();
  });

  it('offers one start-week option per week and passes the chosen week to confirm, then closes', async () => {
    const onConfirm = vi.fn(async () => undefined);
    const onClose = vi.fn();
    render(<Harness weeks={3} initial={['u2']} onConfirm={onConfirm} onClose={onClose} />);
    const sel = screen.getByLabelText(en.assignStartWeek) as HTMLSelectElement;
    expect([...sel.options].map((o) => o.textContent)).toEqual(['Week 1', 'Week 2', 'Week 3']);
    fireEvent.change(sel, { target: { value: '3' } });
    expect(screen.getByText(en.assignStartPoint(3, 'Saturday'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.assignConfirmN(1) }));
    expect(screen.getByRole('button', { name: en.saving })).toBeTruthy();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onConfirm).toHaveBeenCalledWith(3);
  });

  it('a program of zero weeks still offers week 1', () => {
    render(<Harness weeks={0} initial={['u1']} />);
    expect((screen.getByLabelText(en.assignStartWeek) as HTMLSelectElement).options.length).toBe(1);
  });

  it('Cancel closes without confirming', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn(async () => undefined);
    render(<Harness onClose={onClose} onConfirm={onConfirm} initial={['u1']} />);
    fireEvent.click(screen.getAllByRole('button', { name: en.cancel }).pop() as HTMLElement);
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
