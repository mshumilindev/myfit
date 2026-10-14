/**
 * The athlete app's program editor lives under the URL: #/programs/<id>/edit and #/programs/new. The hash decides what is
 * open (Back, reload and links agree); Back returns to the list that opened it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { setViewport } from '../coach/testViewport';
import { setLocale } from '../i18n';
import { pgEn } from '../i18n/coachProgram.en';
import { freshProgram, type Program } from './programs/model';

const stored: Program[] = [];
vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  documentId: () => 'id',
  query: () => ({}),
  where: () => ({}),
  doc: () => ({}),
  setDoc: async () => undefined,
  getDocs: async () => ({ docs: stored.map((p) => ({ id: p.id, data: () => p })) }),
}));
vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  currentUid: () => 'u1',
  getRole: () => 'member',
  getUsername: () => 'Ada',
  trackMutation: <T,>(p: Promise<T>) => p,
  callFn: async (name: string) => (name === 'programMine' ? { assignment: null } : {}),
}));
vi.mock('../coach/client/lazy', () => ({ ClientProgramExtrasLazy: () => null }));

import { ProgramsView } from './ProgramsView';

const shell = { openOverlay: vi.fn() } as never;
const mine = (): Program => ({
  ...freshProgram('Push Pull'),
  id: 'p-1',
  authorId: 'u1',
  dayNames: { '1': 'Push' },
  items: [
    {
      id: 'a',
      day: 1,
      position: 0,
      name: 'Barbell Bench Press',
      kind: 'strength',
      sets: 3,
      reps: 8,
      durationMin: null,
      equipment: [],
    },
  ],
});

beforeEach(() => {
  setLocale('en');
  setViewport(1440);
  stored.length = 0;
  stored.push(mine());
  window.location.hash = '#/programs';
});
afterEach(() => {
  cleanup();
  window.location.hash = '';
});

describe('Programs: the editor under #/programs/<id>/edit', () => {
  it('opening a program from the list puts its address in the URL; Back returns to the list', async () => {
    render(<ProgramsView shell={shell} />);
    fireEvent.click(await screen.findByRole('button', { name: /Push Pull/ }));
    expect(await screen.findByText(pgEn.edTitle, { selector: 'h1' })).toBeTruthy();
    expect(window.location.hash).toBe('#/programs/p-1/edit');
    fireEvent.click(screen.getByRole('button', { name: 'Programs' }));
    await waitFor(() => expect(window.location.hash).toBe('#/programs'));
    expect(await screen.findByRole('button', { name: /Push Pull/ })).toBeTruthy();
  });

  it('a reload (mounting on the address) opens that program', async () => {
    window.location.hash = '#/programs/p-1/edit';
    render(<ProgramsView shell={shell} />);
    expect(await screen.findByText(pgEn.edTitle, { selector: 'h1' })).toBeTruthy();
    expect(screen.getByDisplayValue('Push Pull')).toBeTruthy();
  });

  it('#/programs/<id> (no /edit) opens the editor too', async () => {
    window.location.hash = '#/programs/p-1';
    render(<ProgramsView shell={shell} />);
    expect(await screen.findByText(pgEn.edTitle, { selector: 'h1' })).toBeTruthy();
  });

  it('New program is #/programs/new; a link to a missing program falls back to the list', async () => {
    render(<ProgramsView shell={shell} />);
    fireEvent.click((await screen.findAllByRole('button', { name: /New program/ }))[0]);
    expect(await screen.findByText(pgEn.edTitle, { selector: 'h1' })).toBeTruthy();
    expect(window.location.hash).toBe('#/programs/new');
    cleanup();
    window.location.hash = '#/programs/nope/edit';
    render(<ProgramsView shell={shell} />);
    await waitFor(() => expect(window.location.hash).toBe('#/programs'));
    expect(await screen.findByRole('button', { name: /Push Pull/ })).toBeTruthy();
  });
});
