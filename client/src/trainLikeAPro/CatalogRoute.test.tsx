import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CATALOG } from './catalog';
import { addonsPref } from '../addons/enabledSet';
import type { StartOutcome } from './startProgram';

const h = vi.hoisted(() => ({
  outcome: { kind: 'started', id: 'x' } as StartOutcome,
  start: vi.fn(),
  assignment: null as null | { program: { id: string; name: string; authorId: string } },
}));

vi.mock('./startProgram', () => ({
  startCatalogProgram: (e: unknown) => {
    h.start(e);
    return Promise.resolve(h.outcome);
  },
}));
vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  currentUid: () => 'u1',
}));
vi.mock('../data/programMine', () => ({
  useProgramMine: () => ({ assignment: h.assignment }),
  refreshProgramMine: () => undefined,
}));

import { CatalogRoute } from './CatalogRoute';

const plain = CATALOG.find((e) => e.id === 'linear-5x5-ab')!;
const open = () => {
  fireEvent.click(screen.getByRole('button', { name: `${plain.who}. ${plain.title}` }));
};
const start = () => fireEvent.click(screen.getByRole('button', { name: 'Start this program' }));

describe('CatalogRoute (the Start flow)', () => {
  beforeEach(() => {
    addonsPref.reset();
    h.start.mockClear();
    h.outcome = { kind: 'started', id: 'x' };
    h.assignment = null;
  });
  afterEach(cleanup);

  it('with no active program it starts at once and closes', async () => {
    const onClose = vi.fn();
    render(<CatalogRoute onClose={onClose} />);
    open();
    start();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(h.start).toHaveBeenCalledWith(plain);
  });

  it("the member's own active program is replaced only after the confirmation", async () => {
    h.assignment = { program: { id: 'prg-1', name: 'My plan', authorId: 'u1' } };
    const onClose = vi.fn();
    render(<CatalogRoute onClose={onClose} />);
    open();
    start();
    expect(h.start).not.toHaveBeenCalled();
    expect(screen.getByText('Replace your current program?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(h.start).not.toHaveBeenCalled();
    start();
    fireEvent.click(screen.getByRole('button', { name: 'Replace and start' }));
    await waitFor(() => expect(h.start).toHaveBeenCalledTimes(1));
  });

  it('starting the program that is already active asks nothing', async () => {
    h.assignment = { program: { id: `tl-u1-${plain.id}`, name: 'x', authorId: 'u1' } };
    render(<CatalogRoute onClose={() => {}} />);
    open();
    start();
    await waitFor(() => expect(h.start).toHaveBeenCalledTimes(1));
  });

  it("a trainer's active program turns Start off and says why", () => {
    h.assignment = { program: { id: 'prg-t', name: 'Coach plan', authorId: 't1' } };
    render(<CatalogRoute onClose={() => {}} />);
    open();
    expect(
      (screen.getByRole('button', { name: 'Start this program' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByText(/can't be replaced here/)).toBeTruthy();
  });

  it('queued and failed outcomes stay on the page with a line', async () => {
    h.outcome = { kind: 'queued', id: 'x' };
    const onClose = vi.fn();
    render(<CatalogRoute onClose={onClose} />);
    open();
    start();
    await screen.findByText(/It starts when you are online/);
    expect(onClose).not.toHaveBeenCalled();
    h.outcome = { kind: 'failed' };
    start();
    await screen.findByText('Could not start the program. Try again.');
  });

  it('a refusal from the server (held) shows the same hint', async () => {
    h.outcome = { kind: 'held' };
    render(<CatalogRoute onClose={() => {}} />);
    open();
    start();
    await screen.findByText(/can't be replaced here/);
  });
});
