import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { setViewport } from '../../coach/testViewport';
import { setLocale } from '../../i18n';
import { en } from '../../i18n/en';
import { pgEn } from '../../i18n/coachProgram.en';
import { freshProgram, type Program } from './model';

const m = vi.hoisted(() => ({
  uid: 'u1' as string | null,
  role: 'member' as string,
  setDoc: vi.fn(),
  callFn: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, col: string, id: string) => ({ col, id }),
  setDoc: m.setDoc,
  deleteField: () => 'DELETE',
}));
vi.mock('../../firebase', () => ({ db: {} }));
vi.mock('../../api', async (orig) => ({
  ...(await orig<typeof import('../../api')>()),
  currentUid: () => m.uid,
  getRole: () => m.role,
  getUsername: () => 'Ada',
  trackMutation: <T,>(p: Promise<T>) => p,
  callFn: m.callFn,
}));

import { ProgramPage, useLibraryNames } from './ProgramPage';

const bench = (day: number, id = `i${day}`) => ({
  id,
  day,
  position: 0,
  name: 'Barbell Bench Press',
  kind: 'strength' as const,
  sets: 3,
  reps: 8,
  durationMin: null,
  equipment: [],
});
const prog = (over: Partial<Program> = {}): Program => ({
  ...freshProgram('Push'),
  id: 'p1',
  authorId: 'u1',
  weeks: 6,
  status: 'draft',
  dayNames: { '1': 'Upper' },
  items: [bench(1)],
  ...over,
});

const props = (over: Partial<Parameters<typeof ProgramPage>[0]> = {}) => ({
  initial: prog(),
  saved: true,
  library: [] as Program[],
  shell: { openOverlay: vi.fn() } as never,
  onClose: vi.fn(),
  onSaved: vi.fn(),
  onDeleted: vi.fn(),
  ...over,
});
const mount = (over: Partial<Parameters<typeof ProgramPage>[0]> = {}) => {
  const p = props(over);
  return { ...render(<ProgramPage {...p} />), p };
};
const btn = (name: string | RegExp) => screen.getByRole('button', { name }) as HTMLButtonElement;
const menu = async (item: string) => {
  fireEvent.click(btn(pgEn.edMoreActions));
  fireEvent.click(await screen.findByRole('menuitem', { name: new RegExp(item) }));
};

beforeEach(() => {
  setLocale('en');
  setViewport(1440);
  m.uid = 'u1';
  m.role = 'member';
  m.setDoc.mockReset().mockResolvedValue(undefined);
  m.callFn.mockReset().mockResolvedValue({});
});
afterEach(cleanup);

describe('ProgramPage: header', () => {
  it('names the person and summarises the program', () => {
    mount();
    expect(
      screen.getByText(`Push · ${en.progWeeksCount(6)} · ${en.progDaysCount(1)}`),
    ).toBeTruthy();
    expect(screen.getByText(en.progStatusDraft)).toBeTruthy();
    expect(screen.getByText(en.pgReadyAll(1))).toBeTruthy();
  });

  it('an open-ended program reads Ongoing in the summary and the band', () => {
    mount({ initial: prog({ weeks: 0 }) });
    expect(screen.getByText(`Push · ${en.progOpenEnded} · ${en.progDaysCount(1)}`)).toBeTruthy();
    expect(screen.getByText(`∞ ${en.progOpenEnded}`)).toBeTruthy();
  });

  it('an unnamed program is called "New program"', () => {
    mount({ initial: prog({ name: '' }) });
    expect(screen.getByText(new RegExp(`^${en.progNew} · `))).toBeTruthy();
  });

  it('weeks can be stepped and the no-end toggle flips between 0 and 8', () => {
    mount();
    fireEvent.click(btn(/Increase|\+/));
    expect(screen.getByText(/7 weeks/)).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: en.progNoEndDate }));
    expect(screen.getByText(`∞ ${en.progOpenEnded}`)).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: en.progNoEndDate }));
    expect(screen.getByText(/8 weeks/)).toBeTruthy();
  });

  it('typing the name marks the program as having unsaved changes', () => {
    mount();
    expect(screen.queryByText(pgEn.edUnsaved)).toBeNull();
    fireEvent.change(screen.getByLabelText(en.progName), { target: { value: 'Pull' } });
    expect(screen.getByText(pgEn.edUnsaved)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(en.progName), { target: { value: 'Push' } });
    expect(screen.queryByText(pgEn.edUnsaved)).toBeNull();
  });
});

describe('ProgramPage: saving', () => {
  it('Save draft writes the document for the signed-in user and confirms', async () => {
    const { p } = mount({ saved: false, initial: prog({ id: 'p9', name: 'Fresh' }) });
    fireEvent.click(btn(en.pgSaveDraft));
    await screen.findByText(pgEn.edSaved);
    expect(m.setDoc).toHaveBeenCalledTimes(1);
    const [ref, stored] = m.setDoc.mock.calls[0];
    expect(ref).toEqual({ col: 'programs', id: 'p9' });
    expect(stored).toMatchObject({ id: 'p9', name: 'Fresh', authorId: 'u1', status: 'draft' });
    expect(p.onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 'p9' }));
    expect(m.callFn).not.toHaveBeenCalled();
    expect(btn(en.pgSaveDraft).disabled).toBe(true);
  });

  it('Save draft is disabled while nothing changed on a saved program', () => {
    mount();
    expect(btn(en.pgSaveDraft).disabled).toBe(true);
  });

  it('a failed write shows the error and leaves the changes unsaved', async () => {
    m.setDoc.mockRejectedValue(new Error('offline'));
    const { p } = mount({ saved: false });
    fireEvent.click(btn(en.pgSaveDraft));
    expect((await screen.findByRole('alert')).textContent).toContain(en.pgSaveFailed);
    expect(p.onSaved).not.toHaveBeenCalled();
    expect(screen.getByText(pgEn.edUnsaved)).toBeTruthy();
  });

  it('saving with no signed-in user writes nothing', async () => {
    m.uid = null;
    const { p } = mount({ saved: false });
    fireEvent.click(btn(en.pgSaveDraft));
    await act(async () => undefined);
    expect(m.setDoc).not.toHaveBeenCalled();
    expect(p.onSaved).not.toHaveBeenCalled();
  });

  it('planned activities need the vault key: without it the save fails visibly', async () => {
    const { p } = mount({
      saved: false,
      initial: prog({
        activities: [{ id: 'x', day: 2, type: 'run', minutes: 20, effort: 'light', when: 'after' }],
      }),
    });
    fireEvent.click(btn(en.pgSaveDraft));
    expect((await screen.findByRole('alert')).textContent).toContain(en.pgSaveFailed);
    expect(m.setDoc).not.toHaveBeenCalled();
    expect(p.onSaved).not.toHaveBeenCalled();
  });
});

describe('ProgramPage: activating and the primary action', () => {
  it('a ready draft with edits offers Activate: saves, then switches the status on the server', async () => {
    const { p } = mount();
    fireEvent.change(screen.getByLabelText(en.progName), { target: { value: 'Push v2' } });
    fireEvent.click(btn(en.progActivate));
    await waitFor(() => expect(p.onSaved).toHaveBeenCalledTimes(1));
    expect(m.callFn).toHaveBeenCalledWith('setProgramStatus', { id: 'p1', status: 'active' });
    expect(p.onSaved).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'p1', name: 'Push v2', status: 'active' }),
    );
    expect(m.setDoc).toHaveBeenCalledTimes(1);
    expect(m.setDoc.mock.invocationCallOrder[0]).toBeLessThan(m.callFn.mock.invocationCallOrder[0]);
    await screen.findByText(en.progStatusActive);
    expect(screen.queryByRole('button', { name: en.pgSaveDraft })).toBeNull();
  });

  it('with unchanged saved content Activate skips the write and only sets the status', async () => {
    const { p } = mount();
    fireEvent.click(btn(en.progActivate));
    await waitFor(() => expect(p.onSaved).toHaveBeenCalled());
    // dirty after status change? the snapshot is refreshed, so Archive then needs no write either
    m.setDoc.mockClear();
    await menu(en.progArchive);
    await waitFor(() =>
      expect(m.callFn).toHaveBeenLastCalledWith('setProgramStatus', {
        id: 'p1',
        status: 'archived',
      }),
    );
    expect(m.setDoc).not.toHaveBeenCalled();
    expect(p.onSaved).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'archived' }));
    await screen.findByText(en.progStatusArchived);
  });

  it('a status change that the server refuses shows the error', async () => {
    m.callFn.mockRejectedValue(new Error('nope'));
    const { p } = mount({ saved: false });
    fireEvent.click(btn(en.progActivate));
    expect((await screen.findByRole('alert')).textContent).toContain(en.pgSaveFailed);
    expect(p.onSaved).not.toHaveBeenCalled();
  });

  it('a status change on a clean saved program that the server refuses shows the error', async () => {
    m.callFn.mockRejectedValue(new Error('nope'));
    const { p } = mount();
    fireEvent.click(btn(en.progActivate));
    expect((await screen.findByRole('alert')).textContent).toContain(en.pgSaveFailed);
    expect(p.onSaved).not.toHaveBeenCalled();
    expect(m.setDoc).not.toHaveBeenCalled();
  });

  it('an active program shows Save (not Save draft); it is enabled only after an edit', async () => {
    const { p } = mount({ initial: prog({ status: 'active' }) });
    expect(screen.queryByRole('button', { name: en.pgSaveDraft })).toBeNull();
    expect(btn(en.save).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(en.progName), { target: { value: 'Push v2' } });
    expect(btn(en.save).disabled).toBe(false);
    fireEvent.click(btn(en.save));
    await waitFor(() => expect(p.onSaved).toHaveBeenCalled());
    expect(m.callFn).not.toHaveBeenCalled();
    expect(screen.getByText(en.progStatusActive)).toBeTruthy();
  });

  it('the primary button names what is missing, and clicking it does not activate', () => {
    const { p } = mount({ initial: prog({ dayNames: {} }) });
    const b = btn(en.pgNeedsName(en.weekDayNames[0]));
    fireEvent.click(b);
    expect(m.setDoc).not.toHaveBeenCalled();
    expect(p.onSaved).not.toHaveBeenCalled();
  });

  it('with no training days the button says to pick days', () => {
    mount({ initial: prog({ items: [], dayNames: {} }) });
    expect(screen.getByText(en.pgNeedsDays)).toBeTruthy();
    fireEvent.click(btn(en.pgPickDaysAction));
    expect(m.setDoc).not.toHaveBeenCalled();
  });

  it('a named day without exercises asks to fill it', () => {
    mount({ initial: prog({ items: [], dayNames: { '1': 'Upper' } }) });
    expect(screen.queryByRole('button', { name: en.progActivate })).toBeNull();
  });
});

describe('ProgramPage: menu', () => {
  it('Delete asks, Keep cancels, confirm deletes on the server and reports', async () => {
    const { p } = mount();
    await menu(en.delete);
    expect(screen.getByText(en.deleteProgramTitle('Push'))).toBeTruthy();
    fireEvent.click(btn(en.keep));
    expect(screen.queryByText(en.deleteProgramTitle('Push'))).toBeNull();
    await menu(en.delete);
    const dlg = screen
      .getByText(en.deleteProgramTitle('Push'))
      .closest('[role="dialog"], [role="alertdialog"]') as HTMLElement;
    fireEvent.click(within(dlg).getByRole('button', { name: en.delete }));
    await waitFor(() => expect(p.onDeleted).toHaveBeenCalled());
    expect(m.callFn).toHaveBeenCalledWith('deleteProgram', { id: 'p1' });
  });

  it('a failed delete keeps the page and shows the error', async () => {
    m.callFn.mockRejectedValue(new Error('x'));
    const { p } = mount();
    await menu(en.delete);
    const dlg = screen
      .getByText(en.deleteProgramTitle('Push'))
      .closest('[role="dialog"], [role="alertdialog"]') as HTMLElement;
    fireEvent.click(within(dlg).getByRole('button', { name: en.delete }));
    expect((await screen.findByRole('alert')).textContent).toContain(en.pgSaveFailed);
    expect(p.onDeleted).not.toHaveBeenCalled();
  });

  it('a new program has no Delete or Archive entry', () => {
    mount({ saved: false });
    fireEvent.click(btn(pgEn.edMoreActions));
    expect(screen.queryByRole('menuitem', { name: new RegExp(en.delete) })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: new RegExp(en.progArchive) })).toBeNull();
  });

  it('Duplicate turns the page into an unsaved copy', async () => {
    mount();
    await menu(en.progDuplicate);
    expect((screen.getByLabelText(en.progName) as HTMLInputElement).value).toBe(
      en.progDuplicateName('Push'),
    );
    expect(screen.getByText(pgEn.edUnsaved)).toBeTruthy();
    fireEvent.click(btn(en.pgSaveDraft));
    await waitFor(() => expect(m.setDoc).toHaveBeenCalled());
    expect(m.setDoc.mock.calls[0][0].id).not.toBe('p1');
  });

  it('Export CSV downloads "<name>.csv" and releases the object URL', async () => {
    const created: string[] = [];
    const revoked: string[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => (created.push(String(b.size)), 'blob:x')) as never;
    URL.revokeObjectURL = vi.fn((u: string) => void revoked.push(u)) as never;
    const names: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });
    mount();
    await menu(en.csvExport);
    expect(names).toEqual(['Push.csv']);
    expect(Number(created[0])).toBeGreaterThan(20);
    expect(revoked).toEqual(['blob:x']);
    click.mockRestore();
  });

  it('Export CSV is disabled for a program without exercises', () => {
    mount({ initial: prog({ items: [], dayNames: {} }) });
    fireEvent.click(btn(pgEn.edMoreActions));
    const item = screen.getByRole('menuitem', {
      name: new RegExp(en.csvExport),
    }) as HTMLButtonElement;
    expect(item.disabled || item.getAttribute('aria-disabled') === 'true').toBe(true);
  });

  it('Assign appears only for trainers/admins with a handler; it saves a dirty program first', async () => {
    m.role = 'trainer';
    const onAssign = vi.fn();
    mount({ onAssign, saved: false });
    await menu(en.pgAssignToMembers);
    await waitFor(() => expect(onAssign).toHaveBeenCalledTimes(1));
    expect(m.setDoc).toHaveBeenCalledTimes(1);
    expect(onAssign.mock.calls[0][0]).toMatchObject({ id: 'p1', authorId: 'u1' });
  });

  it('Assign on a clean saved program does not rewrite it', async () => {
    m.role = 'admin';
    const onAssign = vi.fn();
    mount({ onAssign });
    await menu(en.pgAssignToMembers);
    await waitFor(() => expect(onAssign).toHaveBeenCalled());
    expect(m.setDoc).not.toHaveBeenCalled();
  });

  it('Assign is not offered to members, nor without a handler; a failed save does not assign', async () => {
    const onAssign = vi.fn();
    mount({ onAssign });
    fireEvent.click(btn(pgEn.edMoreActions));
    expect(screen.queryByRole('menuitem', { name: new RegExp(en.pgAssignToMembers) })).toBeNull();
    cleanup();
    m.role = 'trainer';
    m.setDoc.mockRejectedValue(new Error('x'));
    mount({ onAssign, saved: false });
    await menu(en.pgAssignToMembers);
    await screen.findByRole('alert');
    expect(onAssign).not.toHaveBeenCalled();
  });
});

describe('ProgramPage: starting a new program', () => {
  it('a new program offers CSV import and Duplicate; a saved one does not', () => {
    mount({ saved: false });
    expect(btn(en.csvImport)).toBeTruthy();
    cleanup();
    mount();
    expect(screen.queryByRole('button', { name: en.csvImport })).toBeNull();
  });

  it('Duplicate from: an empty library says so', () => {
    mount({ saved: false });
    fireEvent.click(btn(en.progDuplicate));
    expect(screen.getByText(en.pgDuplicateFrom)).toBeTruthy();
    expect(screen.getByText(en.progEmpty)).toBeTruthy();
  });

  it('Duplicate from: picking a program copies it as a new draft and closes the sheet', () => {
    const other = prog({
      id: 'p2',
      name: 'Legs',
      weeks: 0,
      dayNames: { '3': 'Lower' },
      items: [bench(3)],
    });
    mount({ saved: false, initial: prog({ name: '', items: [], dayNames: {} }), library: [other] });
    fireEvent.click(btn(en.progDuplicate));
    expect(screen.getByText(`${en.progOpenEnded} · ${en.progDaysCount(1)}`)).toBeTruthy();
    fireEvent.click(screen.getByText('Legs'));
    expect(screen.queryByText(en.pgDuplicateFrom)).toBeNull();
    expect((screen.getByLabelText(en.progName) as HTMLInputElement).value).toBe(
      en.progDuplicateName('Legs'),
    );
    expect(screen.getAllByRole('tab')).toHaveLength(1);
  });

  it('CSV import adds the rows, names the new days (keeping existing names) and closes the dialog', () => {
    mount({
      saved: false,
      initial: prog({
        items: [],
        dayNames: { '1': 'Upper' },
        targetMuscles: { '3': ['chest'] } as never,
      }),
    });
    fireEvent.click(btn(en.csvImport));
    fireEvent.change(screen.getByPlaceholderText(/day,/i), {
      target: { value: 'Day,Exercise,Sets,Reps\n1,Barbell Squat,4,6\n3,Barbell Bench Press,3,8' },
    });
    fireEvent.click(btn(en.csvContinue));
    fireEvent.click(btn(en.csvContinue));
    fireEvent.click(btn(en.csvImportN(2)));
    expect(screen.queryByText(en.csvMapBody)).toBeNull();
    const tabNames = screen.getAllByRole('tab').map((t) => t.textContent ?? '');
    expect(tabNames).toHaveLength(2);
    expect(tabNames[0]).toContain('Upper');
    expect(tabNames[1]).toContain(en.weekDayNames[2]);
    expect(screen.getByText(pgEn.edUnsaved)).toBeTruthy();
  });

  it('closing the import dialog leaves the program untouched', async () => {
    mount({ saved: false, initial: prog({ items: [], dayNames: {} }) });
    fireEvent.click(btn(en.csvImport));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByPlaceholderText(/day,/i)).toBeNull());
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });
});

describe('ProgramPage: leaving', () => {
  it('Discard on the confirmation closes without saving', () => {
    const { p } = mount();
    fireEvent.change(screen.getByLabelText(en.progName), { target: { value: 'Changed' } });
    fireEvent.click(btn(new RegExp(en.progTitle)));
    expect(screen.getByText(en.pgDiscardTitle)).toBeTruthy();
    fireEvent.click(btn(en.pgDiscard));
    expect(p.onClose).toHaveBeenCalledTimes(1);
    expect(m.setDoc).not.toHaveBeenCalled();
  });

  it('a new program with no changes still counts as unsaved and asks before leaving', () => {
    const { p } = mount({ saved: false });
    fireEvent.click(btn(new RegExp(en.progTitle)));
    expect(screen.getByText(en.pgDiscardTitle)).toBeTruthy();
    expect(p.onClose).not.toHaveBeenCalled();
  });

  it('read-only never asks and ignores edits', () => {
    const { p } = mount({ readOnly: true });
    expect((screen.getByLabelText(en.progName) as HTMLInputElement).readOnly).toBe(true);
    expect(screen.queryByText(en.progActivate)).toBeNull();
    expect(screen.queryByText(en.pgReadyAll(1))).toBeNull();
    fireEvent.click(btn(new RegExp(en.progTitle)));
    expect(p.onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ProgramPage: rest-day activities and helpers', () => {
  it('lists activities planned on rest days under the rest heading', () => {
    mount({
      initial: prog({
        activities: [{ id: 'x', day: 2, type: 'run', minutes: 20, effort: 'light', when: 'after' }],
      }),
    });
    expect(screen.getAllByText(en.progRestShort).length).toBeGreaterThan(0);
    expect(screen.getByText(/Run · 20 min/)).toBeTruthy();
  });

  it('warm-up lists, target muscles and several activities on one day do not make a clean program look edited', () => {
    mount({
      initial: prog({
        items: [
          { ...bench(1), warmupItems: [{ id: 'w', name: 'Band pull-apart', reps: 15 }] } as never,
          bench(3),
        ],
        dayNames: { '1': 'Upper', '3': 'Lower' },
        targetMuscles: { '3': ['quads', 'glutes'], '1': ['chest'] } as never,
        activities: [
          { id: 'b', day: 2, type: 'run', minutes: 20, effort: 'light', when: 'after' },
          { id: 'a', day: 2, type: 'walk', minutes: 30, effort: 'light', when: 'any' },
        ],
      }),
    });
    expect(screen.queryByText(pgEn.edUnsaved)).toBeNull();
    expect(btn(en.pgSaveDraft).disabled).toBe(true);
  });

  it('useLibraryNames maps ids to names', () => {
    const { result } = renderHook(() =>
      useLibraryNames([prog({ id: 'a', name: 'A' }), prog({ id: 'b', name: 'B' })]),
    );
    expect([...result.current]).toEqual([
      ['a', 'A'],
      ['b', 'B'],
    ]);
  });
});
