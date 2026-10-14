import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { notesEn as nt } from '../../i18n/coachNotes.en';
import { createFixturesNotesPort } from './__fixtures__/fixtures';
import { NotesPanel } from './NotesPanel';

afterEach(cleanup);

const mount = (over: Partial<Parameters<typeof NotesPanel>[0]> = {}) => {
  const port = createFixturesNotesPort();
  const utils = render(
    <NotesPanel clientId="c1" first="Oleh" coachFirst="Iryna" port={port} {...over} />,
  );
  return { port, ...utils };
};
const list = () => screen.findByRole('list', { name: nt.nListAria });

describe('NotesPanel (trainer)', () => {
  it('lists the notes newest first with visibility and context', async () => {
    mount();
    const items = within(await list()).getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(items[0].textContent).toContain(nt.nSharedWith('Oleh'));
    expect(items[0].textContent).toContain(nt.nAnchorDay('Upper A'));
    expect(items[1].textContent).toContain(nt.nPrivate);
    expect(items[4].textContent).toContain(nt.nAnchorNone);
  });

  it('adds a private note on top; Add is disabled while the field is empty', async () => {
    const { port } = mount();
    await list();
    const add = screen.getByRole('button', { name: nt.nAdd }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    fireEvent.change(screen.getByRole('textbox', { name: nt.nAddAria }), {
      target: { value: 'Knee is better' },
    });
    expect(add.disabled).toBe(false);
    fireEvent.click(add);
    await waitFor(() => expect(port.all('c1')[0].text).toBe('Knee is better'));
    expect(port.all('c1')[0].vis).toBe('private');
  });

  it('choosing "Shared" explains what the client sees', async () => {
    mount();
    await list();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(nt.nSharedWith('Oleh')) }));
    expect(screen.getByText(nt.nSharedHint('Oleh'))).toBeTruthy();
  });

  it('search filters by text and by context; no match says so', async () => {
    mount();
    await list();
    const box = screen.getByRole('searchbox', { name: nt.nSearch });
    fireEvent.change(box, { target: { value: 'bench' } });
    expect(
      within(screen.getByRole('list', { name: nt.nListAria })).getAllByRole('listitem'),
    ).toHaveLength(2); // n2 (decision) and n4
    fireEvent.change(box, { target: { value: 'qqqq' } });
    expect(screen.getByText(nt.nNoMatchH('qqqq'))).toBeTruthy();
  });

  it('delete asks first, says who stops seeing it, then offers Undo for 8 s', async () => {
    const { port } = mount();
    const items = within(await list()).getAllByRole('listitem');
    fireEvent.click(within(items[0]).getByRole('button', { name: nt.nDelete }));
    const dlg = await screen.findByRole('alertdialog');
    expect(dlg.textContent).toContain(nt.nDelBodyShared('Oleh'));
    fireEvent.click(within(dlg).getByRole('button', { name: nt.nDelConfirm }));
    expect(await screen.findByRole('button', { name: nt.nUndo })).toBeTruthy();
    expect(port.all('c1')).toHaveLength(5); // nothing written yet
    fireEvent.click(screen.getByRole('button', { name: nt.nUndo }));
    await waitFor(() =>
      expect(
        within(screen.getByRole('list', { name: nt.nListAria })).getAllByRole('listitem'),
      ).toHaveLength(5),
    );
  });

  it('a private note is deleted with the shorter copy (only you see it)', async () => {
    mount();
    const items = within(await list()).getAllByRole('listitem');
    fireEvent.click(within(items[1]).getByRole('button', { name: nt.nDelete }));
    expect((await screen.findByRole('alertdialog')).textContent).toContain(nt.nDelBodyPrivate);
  });

  it('a context line is a button that jumps', async () => {
    const onJump = vi.fn();
    mount({ onJump });
    const items = within(await list()).getAllByRole('listitem');
    fireEvent.click(
      within(items[2]).getByRole('button', { name: new RegExp(nt.nAnchorMessage('')) }),
    );
    expect(onJump).toHaveBeenCalledWith(expect.objectContaining({ kind: 'message' }));
  });

  it('editing saves the new text', async () => {
    const { port } = mount();
    const items = within(await list()).getAllByRole('listitem');
    fireEvent.click(within(items[4]).getByRole('button', { name: nt.nEdit }));
    fireEvent.change(screen.getByRole('textbox', { name: nt.nEditAria }), {
      target: { value: 'Train after 19:00' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: nt.nSave }));
    });
    await waitFor(() =>
      expect(port.all('c1').find((n) => n.id === 'n5')?.text).toBe('Train after 19:00'),
    );
  });
});

describe('NotesPanel (client, read-only)', () => {
  it('shows only the shared notes, with no add field and no actions', async () => {
    mount({ side: 'client' });
    const items = within(await list()).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(screen.queryByRole('textbox', { name: nt.nAddAria })).toBeNull();
    expect(screen.queryByRole('button', { name: nt.nDelete })).toBeNull();
    expect(screen.queryByRole('button', { name: nt.nEdit })).toBeNull();
    expect(screen.getByText(nt.nReadOnly('Iryna'))).toBeTruthy();
    expect(items[0].textContent).toContain(nt.nFrom('Iryna'));
    expect(document.body.textContent).not.toContain('He pauses for 1 s'); // a private note
  });

  it('empty: says when the trainer shares something', async () => {
    const port = createFixturesNotesPort({ seed: { c1: [] } });
    render(<NotesPanel clientId="c1" first="Oleh" coachFirst="Iryna" side="client" port={port} />);
    expect(await screen.findByText(nt.nEmptyClientH)).toBeTruthy();
  });
});

describe('NotesPanel states', () => {
  it('empty (trainer) invites to write the first note', async () => {
    const port = createFixturesNotesPort({ seed: { c1: [] } });
    render(<NotesPanel clientId="c1" first="Oleh" port={port} />);
    expect(await screen.findByText(nt.nEmptyH('Oleh'))).toBeTruthy();
  });
  it('a failed save is a visible state', async () => {
    let fail = false;
    const port = createFixturesNotesPort({ failWith: () => fail });
    render(<NotesPanel clientId="c1" first="Oleh" port={port} />);
    await list();
    fail = true;
    fireEvent.change(screen.getByRole('textbox', { name: nt.nAddAria }), {
      target: { value: 'x' },
    });
    fireEvent.click(screen.getByRole('button', { name: nt.nAdd }));
    expect(await screen.findByText(nt.nSaveFailed)).toBeTruthy();
  });
});
