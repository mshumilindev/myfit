import { currentHash } from '../route';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { setViewport } from '../coach/testViewport';
import { setLocale } from '../i18n';
import { en } from '../i18n/en';
import { pgEn } from '../i18n/coachProgram.en';
import { setProgramSeed, takeProgramSeed } from '../data/programSeed';
import { freshProgram, type Program } from './programs/model';
import { DAY, NOW } from './__fixtures__/viewKit';

const m = vi.hoisted(() => ({
  uid: 'u1' as string | null,
  role: 'member' as string,
  programs: [] as unknown[],
  assignDocs: [] as unknown[],
  getDocsFail: false,
  callFn: vi.fn(),
  mine: { assignment: null as unknown },
  snapshot: null as unknown,
  reval: { rows: [] as unknown[], fail: false },
  queryCalls: [] as string[],
}));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => ({ name }),
  documentId: () => 'id',
  query: (c: { name: string }) => c,
  where: (_f: string, _op: string, v: unknown) => ({ v }),
  doc: () => ({}),
  setDoc: async () => undefined,
  deleteField: () => 'DELETE',
  getDocs: async (q: { name: string }) => {
    m.queryCalls.push(q.name);
    if (m.getDocsFail) throw new Error('offline');
    const rows = q.name === 'programs' ? m.programs : m.assignDocs;
    return {
      docs: rows.map((r) => ({
        id: (r as { id?: string; memberId?: string }).id ?? (r as { memberId: string }).memberId,
        data: () => r,
      })),
    };
  },
}));
vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  currentUid: () => m.uid,
  getRole: () => m.role,
  getUsername: () => 'Ada',
  trackMutation: <T,>(p: Promise<T>) => p,
  callFn: m.callFn,
}));
vi.mock('../offline/offlineCache', () => ({
  offlineDedupe: (_k: string, run: () => Promise<unknown>) => run(),
  offlineHydrate: async (_k: string, apply: (d: unknown) => void) => {
    if (m.snapshot) apply(m.snapshot);
  },
  offlineRevalidate: (o: {
    fetch: () => Promise<unknown>;
    apply: (d: unknown) => void;
    onError?: () => void;
  }) => {
    o.fetch().then(o.apply, () => o.onError?.());
    return () => undefined;
  },
}));
vi.mock('../coach/client/lazy', () => ({
  ClientProgramExtrasLazy: () => <div data-testid="extras" />,
  ClientTrainerDayTagLazy: () => null,
}));

import { ProgramsView } from './ProgramsView';

const item = (day: number, id = `i${day}`) => ({
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
const prog = (id: string, name: string, over: Partial<Program> = {}): Program => ({
  ...freshProgram(name),
  id,
  authorId: 'u1',
  weeks: 6,
  status: 'draft',
  dayNames: { '1': 'Upper' },
  items: [item(1)],
  ...over,
});
const assignment = (p: Program, over: Record<string, unknown> = {}) => ({
  program: p,
  week: 2,
  startedAt: NOW - 10 * DAY,
  assignedBy: null,
  ...over,
});

const shell = { openOverlay: vi.fn() } as never;
const mount = () => render(<ProgramsView shell={shell} />);

beforeEach(() => {
  setLocale('en');
  setViewport(1440);
  m.uid = 'u1';
  m.role = 'member';
  m.programs = [];
  m.assignDocs = [];
  m.getDocsFail = false;
  m.mine.assignment = null;
  m.snapshot = null;
  m.reval = { rows: [], fail: false };
  m.queryCalls = [];
  m.callFn.mockReset().mockImplementation(async (name: string) => {
    if (name === 'programMine') return { assignment: m.mine.assignment };
    if (name === 'trainerClients') return { clients: m.reval.rows };
    if (name === 'adminPeople') return { people: m.reval.rows };
    return {};
  });
  window.location.hash = '#/programs';
});
afterEach(() => {
  cleanup();
  takeProgramSeed();
  window.location.hash = '';
});

describe('ProgramsView: the list', () => {
  it('shows an empty state and an empty "My program" for a member with nothing', async () => {
    mount();
    expect(await screen.findByText(en.progNone)).toBeTruthy();
    expect(screen.getByText(en.progMemberEmpty)).toBeTruthy();
    expect(await screen.findByText(en.progEmpty)).toBeTruthy();
    expect(screen.getByTestId('extras')).toBeTruthy();
    expect(screen.queryByText(en.pgArchivedN(1))).toBeNull();
  });

  it('lists my programs newest first, with length and status', async () => {
    m.programs = [
      prog('a', 'Old', { updatedAt: 1, status: 'active' }),
      prog('b', 'New', { updatedAt: 5, weeks: 0 }),
    ];
    mount();
    await screen.findByText('New');
    const order = [...document.querySelectorAll('.pg-tile')].map((t) => t.textContent ?? '');
    expect(order[0]).toContain('New');
    expect(order[0]).toContain(en.progOpenEnded);
    expect(order[0]).toContain(en.progStatusDraft);
    expect(order[1]).toContain('Old');
    expect(order[1]).toContain(en.progWeeksCount(6));
    expect(order[1]).toContain(en.progStatusActive);
    expect(document.querySelector('.pg-count')?.textContent).toBe('2');
  });

  it('archived programs are hidden until asked for', async () => {
    m.programs = [prog('a', 'Live'), prog('z', 'Shelved', { status: 'archived' })];
    mount();
    await screen.findByText('Live');
    expect(screen.queryByText('Shelved')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en.pgArchivedN(1) }));
    expect(screen.getByText('Shelved')).toBeTruthy();
    expect(document.querySelector('.pg-count')?.textContent).toBe('2');
    fireEvent.click(screen.getByRole('button', { name: en.pgHideArchived }));
    expect(screen.queryByText('Shelved')).toBeNull();
  });

  it('a failed load shows Retry, which reloads', async () => {
    m.getDocsFail = true;
    mount();
    const retry = await screen.findByRole('button', { name: new RegExp(en.retry) });
    m.getDocsFail = false;
    m.programs = [prog('a', 'Back again')];
    fireEvent.click(retry);
    expect(await screen.findByText('Back again')).toBeTruthy();
    expect(screen.queryByRole('button', { name: new RegExp(en.retry) })).toBeNull();
  });

  it('with nobody signed in nothing is loaded', async () => {
    m.uid = null;
    mount();
    await act(async () => undefined);
    expect(m.queryCalls).not.toContain('programs');
  });

  it('the back link goes to the Overview hub', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: en.overviewTab }));
    expect(currentHash()).toBe('#/overview');
  });
});

describe('ProgramsView: My program', () => {
  it('shows the program I am on, the week and who set it', async () => {
    m.mine.assignment = assignment(prog('t1', 'Coach plan', { authorId: 'tr' }), {
      assignedBy: 'Carl',
    });
    mount();
    expect(await screen.findByText('Coach plan')).toBeTruthy();
    expect(screen.getByText(en.pgActiveWeekOf(2, 6))).toBeTruthy();
    expect(screen.getByText(en.pgByTrainer('Carl'))).toBeTruthy();
  });

  it('an open-ended plan I made myself says "mine" and counts weeks without a total', async () => {
    m.mine.assignment = assignment(prog('self', 'Mine', { weeks: 0 }), {
      week: 9,
      assignedBy: 'Ada',
    });
    mount();
    expect(await screen.findByText(en.pgActiveWeek(9))).toBeTruthy();
    expect(document.querySelector('.pg-mine .pg-by')?.textContent).toBe(en.progStatusMine);
  });

  it('clamps the week to the plan length', async () => {
    m.mine.assignment = assignment(prog('t1', 'Short', { weeks: 4, authorId: 'tr' }), { week: 7 });
    mount();
    expect(await screen.findByText(en.pgActiveWeekOf(4, 4))).toBeTruthy();
  });

  it("opening a trainer's program is read only (no weekday toggles)", async () => {
    m.mine.assignment = assignment(prog('t1', 'Coach plan', { authorId: 'tr' }), {
      assignedBy: 'Carl',
    });
    mount();
    fireEvent.click(await screen.findByText('Coach plan'));
    await screen.findByText(pgEn.edTitle, { selector: 'h1' });
    expect(currentHash()).toBe('#/programs/t1/edit');
    expect(screen.queryByRole('button', { name: /^Train on / })).toBeNull();
  });

  it('opening my own assigned program opens the editable copy from my library', async () => {
    const own = prog('own', 'Self made');
    m.programs = [own];
    m.mine.assignment = assignment(own, { assignedBy: 'Ada' });
    mount();
    fireEvent.click((await screen.findAllByText('Self made'))[0].closest('button')!);
    await waitFor(() => expect(currentHash()).toBe('#/programs/own/edit'));
    expect(await screen.findAllByRole('button', { name: /^Train on / })).toHaveLength(7);
  });

  it('shows the last sealed assignment while the network is still unanswered', async () => {
    m.snapshot = assignment(prog('t1', 'Cached plan', { authorId: 'tr' }), { assignedBy: 'Carl' });
    m.callFn.mockImplementation(() => new Promise(() => undefined));
    mount();
    expect(await screen.findByText('Cached plan')).toBeTruthy();
  });

  it('a failed network read keeps the empty state', async () => {
    m.callFn.mockRejectedValue(new Error('offline'));
    mount();
    expect(await screen.findByText(en.progNone)).toBeTruthy();
  });
});

describe('ProgramsView: new programs and import', () => {
  it('a suggested program (seed) opens the editor prefilled, once', async () => {
    setProgramSeed({
      name: 'Suggested split',
      weeks: 4,
      daysPerWeek: 1,
      dayNames: { '1': 'Push' },
      targetMuscles: { '1': ['chest'] },
      items: [{ ...item(1), equipment: [] }],
    });
    mount();
    await waitFor(() => expect(currentHash()).toBe('#/programs/new'));
    expect(await screen.findByDisplayValue('Suggested split')).toBeTruthy();
    expect(screen.getByText(en.pgOrStartFrom)).toBeTruthy();
    expect(takeProgramSeed()).toBeNull();
  });

  it('Import CSV on the list creates an unsaved program with the rows and named days', async () => {
    mount();
    await screen.findByText(en.progEmpty);
    fireEvent.click(screen.getAllByRole('button', { name: en.csvImport })[0]);
    fireEvent.change(await screen.findByPlaceholderText(/day,/i), {
      target: { value: 'Day,Exercise,Sets,Reps\n2,Barbell Squat,4,6' },
    });
    fireEvent.click(screen.getByRole('button', { name: en.csvContinue }));
    fireEvent.click(screen.getByRole('button', { name: en.csvContinue }));
    fireEvent.click(screen.getByRole('button', { name: en.csvImportN(1) }));
    await waitFor(() => expect(currentHash()).toBe('#/programs/new'));
    expect(((await screen.findByLabelText(en.progName)) as HTMLInputElement).value).toBe(
      en.progNew,
    );
    const tab = await screen.findByRole('tab');
    expect(tab.textContent).toContain(en.weekDayNames[1]);
  });

  it('closing the import dialog changes nothing', async () => {
    mount();
    await screen.findByText(en.progEmpty);
    fireEvent.click(screen.getAllByRole('button', { name: en.csvImport })[0]);
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByPlaceholderText(/day,/i)).toBeNull());
    expect(currentHash()).toBe('#/programs');
  });
});

describe('ProgramsView: saving and closing the editor', () => {
  it('saving a new program rewrites the address to its own id and reloads the list', async () => {
    mount();
    await screen.findByText(en.progEmpty);
    fireEvent.click(screen.getAllByRole('button', { name: new RegExp(en.progNew) })[0]);
    fireEvent.change(await screen.findByLabelText(en.progName), { target: { value: 'Fresh' } });
    m.programs = [prog('will-not-match', 'Fresh')];
    fireEvent.click(screen.getByRole('button', { name: en.pgSaveDraft }));
    await waitFor(() => expect(currentHash()).toMatch(/^#\/programs\/[^/]+\/edit$/));
    expect(currentHash()).not.toBe('#/programs/new');
    expect(m.queryCalls.filter((q) => q === 'programs').length).toBeGreaterThanOrEqual(2);
  });

  it('Back from an editor opened by a direct link replaces it with the list', async () => {
    m.programs = [prog('p1', 'Push')];
    window.location.hash = '#/programs/p1/edit';
    mount();
    fireEvent.click(await screen.findByRole('button', { name: en.progTitle }));
    await waitFor(() => expect(currentHash()).toBe('#/programs'));
    expect(await screen.findByText(en.pgCreatedByMe)).toBeTruthy();
  });

  it('deleting from the editor returns to the list without the program', async () => {
    m.programs = [prog('p1', 'Push')];
    window.location.hash = '#/programs/p1/edit';
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'More actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: new RegExp(en.delete) }));
    const dlg = screen
      .getByText(en.deleteProgramTitle('Push'))
      .closest('[role="dialog"], [role="alertdialog"]') as HTMLElement;
    m.programs = [];
    fireEvent.click(within(dlg).getByRole('button', { name: en.delete }));
    await waitFor(() => expect(currentHash()).toBe('#/programs'));
    expect(m.callFn).toHaveBeenCalledWith('deleteProgram', { id: 'p1' });
    expect(await screen.findByText(en.progEmpty)).toBeTruthy();
  });

  it('while the programs load, a deep link shows a busy placeholder', () => {
    window.location.hash = '#/programs/p1/edit';
    m.callFn.mockImplementation(() => new Promise(() => undefined));
    const { container } = mount();
    expect(container.querySelector('[aria-busy]')).toBeTruthy();
  });

  it('a hashchange (browser Back) switches between the list and the editor', async () => {
    m.programs = [prog('p1', 'Push')];
    mount();
    await screen.findByText('Push');
    act(() => {
      window.location.hash = '#/programs/p1/edit';
    });
    expect(await screen.findByLabelText(en.progName)).toBeTruthy();
    act(() => {
      window.location.hash = '#/programs';
    });
    expect(await screen.findByText(en.pgCreatedByMe)).toBeTruthy();
  });
});

describe('ProgramsView: coaches', () => {
  const people = [
    { id: 'm1', name: 'Mia Member' },
    { id: 'm2', name: 'Max Member' },
    { id: '', name: 'No id' },
  ];

  it('a member never sees the assign controls or loads a roster', async () => {
    m.programs = [prog('p1', 'Push')];
    mount();
    await screen.findByText('Push');
    expect(screen.queryByRole('button', { name: en.pgMembersOn('Push') })).toBeNull();
    expect(m.callFn).not.toHaveBeenCalledWith('trainerClients');
  });

  it('a trainer loads clients and sees an Assign link until someone is on the program', async () => {
    m.role = 'trainer';
    m.programs = [prog('p1', 'Push'), prog('p2', 'Pull')];
    m.reval.rows = people;
    m.assignDocs = [{ memberId: 'm1', programId: 'p1', startedAt: NOW }];
    mount();
    await screen.findByText('Push');
    await waitFor(() => expect(m.queryCalls).toContain('assignments'));
    const on = await screen.findByRole('button', { name: en.pgMembersOn('Push') });
    await waitFor(() => expect(within(on).queryByText(en.progAssign)).toBeNull());
    expect(
      within(screen.getByRole('button', { name: en.pgMembersOn('Pull') })).getByText(en.progAssign),
    ).toBeTruthy();
    expect(m.callFn).toHaveBeenCalledWith('trainerClients');
  });

  it('an admin loads the people list instead', async () => {
    m.role = 'admin';
    m.programs = [prog('p1', 'Push')];
    m.reval.rows = people;
    mount();
    await screen.findByText('Push');
    await waitFor(() => expect(m.callFn).toHaveBeenCalledWith('adminPeople'));
  });

  it('assigning from the members drawer calls the server per member and reloads', async () => {
    m.role = 'trainer';
    m.programs = [prog('p1', 'Push')];
    m.reval.rows = people;
    mount();
    await screen.findByText('Push');
    await waitFor(() => expect(m.callFn).toHaveBeenCalledWith('trainerClients'));
    fireEvent.click(await screen.findByRole('button', { name: en.pgMembersOn('Push') }));
    fireEvent.click(await screen.findByRole('checkbox', { name: /Mia Member/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Max Member/ }));
    const before = m.queryCalls.filter((q) => q === 'programs').length;
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${en.save}`) }));
    await waitFor(() =>
      expect(m.callFn).toHaveBeenCalledWith('assignProgram', {
        id: 'p1',
        memberId: 'm2',
        startWeek: 1,
      }),
    );
    expect(m.callFn).toHaveBeenCalledWith('assignProgram', {
      id: 'p1',
      memberId: 'm1',
      startWeek: 1,
    });
    await waitFor(() =>
      expect(m.queryCalls.filter((q) => q === 'programs').length).toBeGreaterThan(before),
    );
  });

  it('assigning myself refreshes My program', async () => {
    m.role = 'trainer';
    m.programs = [prog('p1', 'Push')];
    m.reval.rows = [{ id: 'u1', name: 'Ada Self' }, ...people];
    mount();
    await screen.findByText('Push');
    await waitFor(() => expect(m.callFn).toHaveBeenCalledWith('trainerClients'));
    fireEvent.click(await screen.findByRole('button', { name: en.pgMembersOn('Push') }));
    fireEvent.click(await screen.findByRole('checkbox', { name: /Ada Self/ }));
    const mineBefore = m.callFn.mock.calls.filter((c) => c[0] === 'programMine').length;
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${en.save}`) }));
    await waitFor(() =>
      expect(m.callFn.mock.calls.filter((c) => c[0] === 'programMine').length).toBeGreaterThan(
        mineBefore,
      ),
    );
  });

  it('a failed assignments read leaves no assignees', async () => {
    m.role = 'trainer';
    m.programs = [prog('p1', 'Push')];
    m.reval.rows = people;
    mount();
    await screen.findByText('Push');
    m.getDocsFail = true;
    await act(async () => undefined);
    expect(screen.getByRole('button', { name: en.pgMembersOn('Push') })).toBeTruthy();
  });

  it('a failed roster read keeps the list working', async () => {
    m.role = 'trainer';
    m.programs = [prog('p1', 'Push')];
    m.callFn.mockImplementation(async (name: string) => {
      if (name === 'trainerClients') throw new Error('x');
      return { assignment: null };
    });
    mount();
    expect(await screen.findByText('Push')).toBeTruthy();
  });

  it("the editor's Assign action opens the members drawer for that program", async () => {
    m.role = 'trainer';
    m.programs = [prog('p1', 'Push')];
    m.reval.rows = people;
    window.location.hash = '#/programs/p1/edit';
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'More actions' }));
    fireEvent.click(
      await screen.findByRole('menuitem', { name: new RegExp(en.pgAssignToMembers) }),
    );
    expect(await screen.findByRole('checkbox', { name: /Mia Member/ })).toBeTruthy();
  });
});
