/** The notes list of one client: what is private stays private, what is shared says so, every write is explicit and undoable. */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notesEn as nt } from '../../i18n/coachNotes.en';
import { FIXTURE_NOW } from '../data/__fixtures__/fixtures';
import { createFixturesNotesPort } from './__fixtures__/fixtures';
import type { NotesPort } from './port';
import { MAX_NOTE, NOTE_UNDO_MS, type Note, type NoteAnchor } from './types';
import { NotesPanel, type NotesPanelProps } from './NotesPanel';

const NOW = FIXTURE_NOW;
const note = (
  id: string,
  text: string,
  vis: Note['vis'],
  anchor: NoteAnchor = { kind: 'none' },
): Note => ({
  id,
  clientId: 'c1',
  text,
  vis,
  anchor,
  at: NOW - 60_000,
  updatedAt: NOW - 60_000,
});

function mount(over: Partial<NotesPanelProps> = {}, seed?: Note[], failing?: { on: boolean }) {
  const port = createFixturesNotesPort({
    now: () => NOW,
    ...(seed ? { seed: { c1: seed } } : {}),
    ...(failing ? { failWith: () => failing.on } : {}),
  });
  const utils = render(
    <NotesPanel clientId="c1" first="Oleh" coachFirst="Iryna" now={NOW} port={port} {...over} />,
  );
  return { port, ...utils };
}
const list = () => screen.findByRole('list', { name: nt.nListAria });
const itemOf = async (text: string) =>
  within(await list())
    .getAllByRole('listitem')
    .find((li) => li.textContent?.includes(text))!;
/** Sync twin of `itemOf` for the tests that run on fake timers (findBy* would wait on a clock that never ticks). */
const itemNow = (text: string) =>
  within(screen.getByRole('list', { name: nt.nListAria }))
    .getAllByRole('listitem')
    .find((li) => li.textContent?.includes(text))!;
const typeNote = (value: string) =>
  fireEvent.change(screen.getByRole('textbox', { name: nt.nAddAria }), { target: { value } });

beforeEach(() => vi.useFakeTimers({ toFake: ['Date'], now: NOW }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('adding a note', () => {
  it('stores the trimmed text as private, General, clears the field and says nothing about sharing', async () => {
    const { port } = mount();
    await list();
    typeNote('  Knee is better  ');
    fireEvent.click(screen.getByRole('button', { name: nt.nAdd }));
    await waitFor(() => expect(port.all('c1')[0].text).toBe('Knee is better'));
    expect(port.all('c1')[0]).toMatchObject({ vis: 'private', anchor: { kind: 'none' } });
    expect((screen.getByRole('textbox', { name: nt.nAddAria }) as HTMLTextAreaElement).value).toBe(
      '',
    );
    expect(screen.queryByText(nt.nToastShared('Oleh'))).toBeNull();
  });

  it('a note shared with the client is stored shared and confirms where the client reads it', async () => {
    const { port } = mount();
    await list();
    typeNote('Bring a towel');
    fireEvent.click(screen.getByRole('button', { name: new RegExp(nt.nSharedWith('Oleh')) }));
    fireEvent.click(screen.getByRole('button', { name: nt.nAdd }));
    expect(await screen.findByText(nt.nToastShared('Oleh'))).toBeTruthy();
    expect(port.all('c1')[0]).toMatchObject({ text: 'Bring a towel', vis: 'shared' });
  });

  it('a whitespace-only draft cannot be added, and a draft over the limit is refused with the limit named', async () => {
    const { port } = mount();
    await list();
    const add = screen.getByRole('button', { name: nt.nAdd }) as HTMLButtonElement;
    typeNote('   \n ');
    expect(add.disabled).toBe(true);
    typeNote('x'.repeat(MAX_NOTE));
    expect(add.disabled).toBe(false);
    typeNote('x'.repeat(MAX_NOTE + 1));
    expect(add.disabled).toBe(true);
    expect(screen.getByText(nt.nTooLong(MAX_NOTE))).toBeTruthy();
    fireEvent.click(add);
    expect(port.all('c1')).toHaveLength(5);
  });

  it('the note can hang on a context offered by the screen; General is always first', async () => {
    const anchors: NoteAnchor[] = [
      { kind: 'message', id: 'm9', at: NOW - 3_600_000 },
      { kind: 'decision', id: 'd1', text: 'Deload week' },
    ];
    const { port } = mount({ anchors });
    await list();
    const group = screen.getByRole('group', { name: nt.nAttach });
    const chips = within(group).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toEqual([
      nt.nAnchorNone,
      nt.nCtxMessage,
      nt.nCtxDecision,
    ]);
    expect(chips[0].getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(chips[2]);
    expect(chips[2].getAttribute('aria-pressed')).toBe('true');
    expect(chips[0].getAttribute('aria-pressed')).toBe('false');
    typeNote('Reconsider after the deload');
    fireEvent.click(screen.getByRole('button', { name: nt.nAdd }));
    await waitFor(() => expect(port.all('c1')[0].text).toBe('Reconsider after the deload'));
    expect(port.all('c1')[0].anchor).toMatchObject({ kind: 'decision', id: 'd1' });
  });

  it('a failed save keeps the text in the field and shows the failure; Cancel on the notice clears it', async () => {
    const failing = { on: false };
    mount({}, undefined, failing);
    await list();
    failing.on = true;
    typeNote('Do not lose me');
    fireEvent.click(screen.getByRole('button', { name: nt.nAdd }));
    expect(await screen.findByText(nt.nSaveFailed)).toBeTruthy();
    expect((screen.getByRole('textbox', { name: nt.nAddAria }) as HTMLTextAreaElement).value).toBe(
      'Do not lose me',
    );
    fireEvent.click(
      within(screen.getByText(nt.nSaveFailed).closest('div')!.parentElement!).getByRole('button', {
        name: nt.nCancel,
      }),
    );
    await waitFor(() => expect(screen.queryByText(nt.nSaveFailed)).toBeNull());
  });
});

describe('sharing and un-sharing', () => {
  it('"Share with Oleh" moves a private note to the client and says so; "Make private" takes it back', async () => {
    const { port } = mount({}, [note('a', 'Hamstring tight', 'private')]);
    fireEvent.click(
      within(await itemOf('Hamstring')).getByRole('button', { name: nt.nShareWith('Oleh') }),
    );
    expect(await screen.findByText(nt.nToastShared('Oleh'))).toBeTruthy();
    expect(port.all('c1')[0].vis).toBe('shared');
    fireEvent.click(
      within(await itemOf('Hamstring')).getByRole('button', { name: nt.nMakePrivate }),
    );
    expect(await screen.findByText(nt.nToastPrivate('Oleh'))).toBeTruthy();
    expect(port.all('c1')[0].vis).toBe('private');
  });

  it('the confirmation fades after 2.2 s', async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ now: NOW });
    mount({}, [note('a', 'Hamstring tight', 'private')]);
    await act(async () => void (await vi.advanceTimersByTimeAsync(10)));
    fireEvent.click(
      within(itemNow('Hamstring')).getByRole('button', { name: nt.nShareWith('Oleh') }),
    );
    await act(async () => void (await vi.advanceTimersByTimeAsync(10)));
    expect(screen.getByText(nt.nToastShared('Oleh'))).toBeTruthy();
    await act(async () => void (await vi.advanceTimersByTimeAsync(2300)));
    expect(screen.queryByText(nt.nToastShared('Oleh'))).toBeNull();
  });

  it('a refused change does not claim success', async () => {
    const failing = { on: false };
    const { port } = mount({}, [note('a', 'Hamstring tight', 'private')], failing);
    const row = await itemOf('Hamstring');
    failing.on = true;
    fireEvent.click(within(row).getByRole('button', { name: nt.nShareWith('Oleh') }));
    await waitFor(() => expect(screen.queryByText(nt.nToastShared('Oleh'))).toBeNull());
    expect(port.all('c1')[0].vis).toBe('private');
  });
});

describe('editing', () => {
  it('Cancel drops the edit; Save is off for an empty text; a refused save keeps the editor open with the text', async () => {
    const failing = { on: false };
    const { port } = mount({}, [note('a', 'Original', 'private')], failing);
    fireEvent.click(within(await itemOf('Original')).getByRole('button', { name: nt.nEdit }));
    const box = screen.getByRole('textbox', { name: nt.nEditAria }) as HTMLTextAreaElement;
    expect(box.value).toBe('Original');
    fireEvent.change(box, { target: { value: '  ' } });
    expect((screen.getByRole('button', { name: nt.nSave }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.change(box, { target: { value: 'Changed' } });
    failing.on = true;
    fireEvent.click(screen.getByRole('button', { name: nt.nSave }));
    await screen.findByText(nt.nSaveFailed);
    expect(screen.getByRole('textbox', { name: nt.nEditAria })).toBeTruthy();
    expect(port.all('c1')[0].text).toBe('Original');
    fireEvent.click(
      within(
        screen.getByRole('textbox', { name: nt.nEditAria }).closest('.nts-edit') as HTMLElement,
      ).getByRole('button', { name: nt.nCancel }),
    );
    expect(screen.queryByRole('textbox', { name: nt.nEditAria })).toBeNull();
  });
});

describe('deleting', () => {
  it('Cancel on the confirmation leaves the note; confirming hides it at once and removes it for good after the undo window', async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ now: NOW });
    const { port } = mount({}, [
      note('a', 'Remove me', 'private'),
      note('b', 'Keep me', 'private'),
    ]);
    await act(async () => void (await vi.advanceTimersByTimeAsync(10)));
    fireEvent.click(within(itemNow('Remove me')).getByRole('button', { name: nt.nDelete }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: nt.nCancel }),
    );
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(itemNow('Remove me')).toBeTruthy();
    fireEvent.click(within(itemNow('Remove me')).getByRole('button', { name: nt.nDelete }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: nt.nDelConfirm }),
    );
    expect(screen.getByText(nt.nDeleted)).toBeTruthy();
    expect(port.all('c1')).toHaveLength(2);
    await act(async () => void (await vi.advanceTimersByTimeAsync(NOTE_UNDO_MS + 50)));
    expect(port.all('c1').map((n) => n.id)).toEqual(['b']);
  });
});

describe('finding notes', () => {
  it('search narrows the list and counts; clearing brings everything back; a miss says so', async () => {
    mount({}, [note('a', 'Sore knee', 'private'), note('b', 'Great squat', 'shared')]);
    await list();
    const box = screen.getByPlaceholderText(nt.nSearch);
    fireEvent.change(box, { target: { value: 'knee' } });
    expect(screen.getByRole('status').textContent).toBe(nt.nFound(1));
    expect(
      within(screen.getByRole('list', { name: nt.nListAria })).getAllByRole('listitem'),
    ).toHaveLength(1);
    fireEvent.change(box, { target: { value: 'zzz' } });
    expect(screen.getByText(nt.nNoMatchH('zzz'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: nt.nSearchClear }));
    expect(within(await list()).getAllByRole('listitem')).toHaveLength(2);
  });
});

describe('the context line', () => {
  it('opens its page for every kind except General, which is plain text', async () => {
    const onJump = vi.fn();
    mount({ onJump }, [
      note('m', 'on a message', 'private', { kind: 'message', id: 'm1', at: NOW - 3_600_000 }),
      note('d', 'on a decision', 'private', { kind: 'decision', id: 'd1', text: 'Deload' }),
      note('g', 'general one', 'private'),
    ]);
    await list();
    fireEvent.click(
      within(await itemOf('on a message')).getByRole('button', { name: new RegExp(nt.nJump) }),
    );
    fireEvent.click(
      within(await itemOf('on a decision')).getByRole('button', { name: new RegExp(nt.nOpenCtx) }),
    );
    expect(onJump.mock.calls.map((c) => c[0].kind)).toEqual(['message', 'decision']);
    expect(
      within(await itemOf('general one')).queryByRole('button', { name: new RegExp(nt.nOpenCtx) }),
    ).toBeNull();
  });
});

describe("the trainer's own page versus the client's view", () => {
  it('the client side shows only shared notes, with no way to add, edit, share or delete, and no private text anywhere in the page', async () => {
    const { container } = mount({ side: 'client' }, [
      note('a', 'PRIVATE-SECRET', 'private'),
      note('b', 'Bring a towel', 'shared'),
    ]);
    const items = within(await list()).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain('Bring a towel');
    expect(items[0].textContent).toContain(nt.nFrom('Iryna'));
    expect(container.textContent).not.toContain('PRIVATE-SECRET');
    expect(screen.queryByRole('textbox')).toBeNull();
    for (const name of [nt.nAdd, nt.nEdit, nt.nDelete, nt.nMakePrivate])
      expect(screen.queryByRole('button', { name })).toBeNull();
    expect(screen.getByText(nt.nReadOnly('Iryna'))).toBeTruthy();
    expect(screen.getByRole('region', { name: nt.nTitleClient('Iryna') })).toBeTruthy();
  });

  it('a client whose trainer shared nothing sees the empty state, not the private notes', async () => {
    const { container } = mount({ side: 'client' }, [note('a', 'PRIVATE-SECRET', 'private')]);
    expect(await screen.findByText(nt.nEmptyClientH)).toBeTruthy();
    expect(screen.getByText(nt.nEmptyClientB('Iryna'))).toBeTruthy();
    expect(container.textContent).not.toContain('PRIVATE-SECRET');
  });
});

describe('loading and failing', () => {
  function failingPort(over: Partial<NotesPort> = {}): NotesPort {
    const base = createFixturesNotesPort({ now: () => NOW });
    return { ...base, ...over };
  }

  it('with nothing cached a failed load is a failure state with Retry that subscribes again', async () => {
    let tries = 0;
    const port = failingPort({
      subscribe: (id, on, onError) => {
        tries += 1;
        if (tries === 1) {
          queueMicrotask(() => onError(new Error('x')));
          return () => undefined;
        }
        queueMicrotask(() => on([note('a', 'Back again', 'private')]));
        return () => undefined;
      },
    });
    render(<NotesPanel clientId="c1" first="Oleh" now={NOW} port={port} />);
    // the notice and the failure state each offer Retry: both do the same thing
    expect((await screen.findAllByRole('button', { name: nt.nRetry })).length).toBe(2);
    fireEvent.click(screen.getAllByRole('button', { name: nt.nRetry })[0]);
    expect(await screen.findByText('Back again')).toBeTruthy();
    expect(tries).toBe(2);
  });

  it('with notes already shown a later failure says offline and keeps them', async () => {
    let fire!: (e: unknown) => void;
    const port = failingPort({
      subscribe: (_id, on, onError) => {
        queueMicrotask(() => on([note('a', 'Still here', 'private')]));
        fire = onError;
        return () => undefined;
      },
    });
    render(<NotesPanel clientId="c1" first="Oleh" now={NOW} port={port} />);
    await screen.findByText('Still here');
    act(() => fire(new Error('lost')));
    expect(await screen.findByText(nt.nUnavailableOffline)).toBeTruthy();
    expect(screen.getByText('Still here')).toBeTruthy();
  });

  it('while loading with nothing to show it is a labelled skeleton', () => {
    const port = failingPort({ subscribe: () => () => undefined });
    render(<NotesPanel clientId="c1" first="Oleh" now={NOW} port={port} />);
    expect(screen.getByRole('status', { name: nt.nTitle('Oleh') })).toBeTruthy();
  });
});

describe('chrome', () => {
  it('a close button appears for the drawer and the page but never for the sheet', async () => {
    const onClose = vi.fn();
    mount({ onClose, variant: 'drawer' });
    await list();
    fireEvent.click(screen.getByRole('button', { name: nt.nClose }));
    expect(onClose).toHaveBeenCalledTimes(1);
    cleanup();
    mount({ onClose, variant: 'sheet' });
    await list();
    expect(screen.queryByRole('button', { name: nt.nClose })).toBeNull();
  });

  it('highlights only the note the thread just jumped to', async () => {
    mount({ highlightId: 'b' }, [note('a', 'First', 'private'), note('b', 'Second', 'private')]);
    const lit = (await itemOf('Second')).querySelector('.is-hl');
    expect(lit).not.toBeNull();
    expect((await itemOf('First')).querySelector('.is-hl')).toBeNull();
  });
});
