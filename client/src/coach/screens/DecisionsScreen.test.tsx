import { markReauthed } from '../security/reauth';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { c360En as c } from '../../i18n/coachClient360.en';
import { decisionsEn as d } from '../../i18n/coachDecisions.en';
import { todayEn as t } from '../../i18n/coachToday.en';
import type { CoachWorldPort } from '../data/port';
import { createFixturesPort } from '../data/__fixtures__/fixtures';
import { setViewport } from '../testViewport';
import { DecisionsScreen } from './DecisionsScreen';
import { worldPort } from './storyPorts';
import { safeEn as sf } from '../../i18n/coachSafe.en';
import { configureNotes, getNotesPort } from '../notes/useNotes';
import { createFixturesNotesPort } from '../notes/__fixtures__/fixtures';

afterEach(cleanup);
beforeEach(() => setViewport(1440));

const mount = (port: CoachWorldPort = createFixturesPort()) => {
  const onNavigate = vi.fn();
  render(<DecisionsScreen onNavigate={onNavigate} port={port} />);
  return { onNavigate };
};
const list = () => within(screen.getByRole('list', { name: d.dcList }));

describe('Decisions (receipts)', () => {
  it('loading skeleton, then summary and the first page of the list', async () => {
    mount(createFixturesPort({ delayMs: 40 }));
    expect(screen.getByRole('status', { name: d.dcLoading })).toBeTruthy();
    await waitFor(() => expect(list().getAllByRole('button').length).toBe(12));
    expect(screen.getByText('26 of 42')).toBeTruthy();
    expect(screen.getAllByText(d.dcCount(42)).length).toBe(2); // header + history
  });

  it('filters by outcome and the chip counts reconcile with the list', async () => {
    mount();
    await waitFor(() => list().getAllByRole('button'));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${t.declined} 4$`) }));
    expect(list().getAllByRole('button').length).toBe(4);
    expect(list().getAllByText(t.declined).length).toBe(4);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${t.measuring} 2$`) }));
    expect(list().getAllByRole('button').length).toBe(2);
  });

  it('search with no match shows the empty state and Clear filters restores the list', async () => {
    mount();
    await waitFor(() => list().getAllByRole('button'));
    fireEvent.change(screen.getByRole('searchbox', { name: d.dcSearch }), {
      target: { value: 'zzzz' },
    });
    expect(screen.getByText(d.dcNoMatch)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: d.dcClear }));
    await waitFor(() => expect(list().getAllByRole('button').length).toBe(12));
  });

  it('Show more pages the list by 12', async () => {
    mount();
    await waitFor(() => list().getAllByRole('button'));
    fireEvent.click(screen.getByRole('button', { name: d.dcMore(12, 30) }));
    expect(list().getAllByRole('button').length).toBe(24);
  });

  it('wide: the first row is selected and its Decision record is shown beside the list', async () => {
    mount();
    await waitFor(() => list().getAllByRole('button'));
    const rec = screen.getByRole('complementary', { name: c.drRecord });
    for (const k of [c.drWhat, c.drEvidence, c.drDecision, c.drResult]) {
      expect(within(rec).getByText(k)).toBeTruthy();
    }
    expect(within(rec).getByRole('button', { name: c.drOpenEvidence })).toBeTruthy();
    expect(within(rec).getByText(/never your private notes/)).toBeTruthy();
    expect(list().getAllByRole('button')[0].getAttribute('aria-current')).toBe('true');
  });

  it('selecting another row swaps the record; the client name opens Client 360', async () => {
    const { onNavigate } = mount();
    await waitFor(() => list().getAllByRole('button'));
    fireEvent.click(list().getAllByRole('button')[1]);
    expect(list().getAllByRole('button')[1].getAttribute('aria-current')).toBe('true');
    const rec = screen.getByRole('complementary', { name: c.drRecord });
    fireEvent.click(within(rec).getAllByRole('button')[0]);
    expect(onNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ screen: 'client', cid: expect.any(String) }),
    );
  });

  it('Open evidence hands the signal key to the Decision screen', async () => {
    const onOpenDecision = vi.fn();
    render(
      <DecisionsScreen
        onNavigate={vi.fn()}
        onOpenDecision={onOpenDecision}
        port={createFixturesPort()}
      />,
    );
    await waitFor(() => list().getAllByRole('button'));
    fireEvent.click(screen.getByRole('button', { name: c.drOpenEvidence }));
    expect(onOpenDecision).toHaveBeenCalledWith(expect.stringContaining('|'));
  });

  it('phone: the record opens inline under the row (aria-expanded)', async () => {
    setViewport(390);
    mount();
    await waitFor(() => list().getAllByRole('button'));
    expect(screen.queryByRole('complementary')).toBeNull();
    const row = list().getAllByRole('button')[0];
    expect(row.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(row);
    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(c.drWhat)).toBeTruthy();
    fireEvent.click(row);
    expect(screen.queryByText(c.drWhat)).toBeNull();
  });

  it('Filters panel narrows by client and shows a removable chip', async () => {
    mount();
    await waitFor(() => list().getAllByRole('button'));
    fireEvent.click(screen.getByRole('button', { name: c.drFiltersBtn }));
    const dlg = screen.getByRole('dialog', { name: c.drFiltersTitle });
    fireEvent.change(within(dlg).getByLabelText(c.drFClient), {
      target: {
        value: within(dlg).getByRole('option', { name: 'Oleh Bondar' }).getAttribute('value'),
      },
    });
    const n = list().getAllByRole('button').length;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(12);
    fireEvent.click(screen.getByRole('button', { name: c.drFShow(n) }));
    fireEvent.click(screen.getByRole('button', { name: c.drFRemove('Oleh Bondar') }));
    await waitFor(() => expect(list().getAllByRole('button').length).toBe(12));
  });

  it('shows the insight only when the numbers support it', async () => {
    mount();
    await waitFor(() => list().getAllByRole('button'));
    const empty = worldPort((w) => ({
      ...w,
      book: { ...w.book, decisions: w.book.decisions.slice(0, 3) },
    }));
    cleanup();
    mount(empty);
    await waitFor(() => list().getAllByRole('button'));
    expect(screen.queryByText(/worked most often/)).toBeNull();
  });

  it('Export opens the panel with the columns and downloads a CSV', async () => {
    markReauthed();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:x';
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => undefined;
    mount();
    await waitFor(() => list().getAllByRole('button'));
    fireEvent.click(screen.getByRole('button', { name: c.exLabel }));
    const dlg = screen.getByRole('dialog', { name: c.exTitle(c.exScopeDecisions) });
    expect(
      within(dlg).getByText(c.exCols(5, Object.values(c.exColDecisions).join(', '))),
    ).toBeTruthy();
    fireEvent.click(within(dlg).getByRole('button', { name: c.exSubmit }));
    // the file is released after the password check (a recent confirmation covers it)
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(await screen.findByText(c.exDone(c.exFileDecisions, 42))).toBeTruthy();
    click.mockRestore();
  });

  it('no decisions: empty state that points to Today', async () => {
    const { onNavigate } = mount(worldPort((w) => ({ ...w, book: { ...w.book, decisions: [] } })));
    expect(await screen.findByText(d.dcEmptyH)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: d.dcToAgenda }));
    expect(onNavigate).toHaveBeenCalledWith({ screen: 'agenda' });
  });

  it('load failure with nothing cached offers Try again', async () => {
    mount(createFixturesPort({ failWith: () => 'unavailable' }));
    expect(await screen.findByText(sf.pbUnknownTitle)).toBeTruthy();
    expect(screen.getByRole('button', { name: d.dcTryAgain })).toBeTruthy();
  });

  it('Group by splits the history into labelled sections in order and keeps paging across them', async () => {
    mount();
    await waitFor(() => list().getAllByRole('button'));
    fireEvent.click(screen.getByRole('button', { name: c.drFiltersBtn }));
    const dlg = screen.getByRole('dialog', { name: c.drFiltersTitle });
    fireEvent.change(within(dlg).getByLabelText(d.dcGroupBy), { target: { value: 'result' } });
    fireEvent.click(
      within(dlg).getByRole('button', { name: new RegExp(c.drFShow(42).slice(0, 4)) }),
    );
    // one heading per result, improved first
    const heads = screen
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent ?? '')
      .filter((x) => x.startsWith(t.improved) || x.startsWith(t.declined));
    expect(heads[0].startsWith(t.improved)).toBe(true);
    expect(screen.getByRole('list', { name: t.improved })).toBeTruthy();
    // a removable chip says what the list is grouped by
    const chip = screen.getByRole('button', {
      name: c.drFRemove(`${d.dcGrouped}: ${d.dcGroupResult}`),
    });
    fireEvent.click(chip);
    await waitFor(() => expect(screen.getByRole('list', { name: d.dcList })).toBeTruthy());
  });
});

describe('Decision share (S-19) is a real write', () => {
  beforeEach(() => configureNotes(createFixturesNotesPort()));
  afterEach(() => configureNotes(null));

  const sharedNotes = async () => {
    const latest = new Map<string, { vis: string; anchor: { kind: string } }[]>();
    const offs: (() => void)[] = [];
    for (let i = 1; i <= 12; i++)
      offs.push(
        getNotesPort().subscribe(
          `c${i}`,
          (n) => latest.set(`c${i}`, n as never),
          () => undefined,
        ),
      );
    await new Promise((r) => setTimeout(r, 20));
    offs.forEach((f) => f());
    return [...latest.values()]
      .flat()
      .filter((n) => n.vis === 'shared' && n.anchor.kind === 'decision');
  };

  it('Share writes a shared note anchored to the decision; Undo takes it back; the button reflects the store', async () => {
    mount();
    await waitFor(() => list().getAllByRole('button'));
    const rec = screen.getByRole('complementary', { name: c.drRecord });
    const btn = () => within(rec).getByRole('button', { name: /^Share with|^Shared with/ });
    expect(btn().getAttribute('aria-pressed')).toBe('false');
    const target = btn().textContent;
    fireEvent.click(btn());
    await waitFor(() => expect(btn().getAttribute('aria-pressed')).toBe('true'));
    expect(target).toMatch(/^Share with/);
    expect((await sharedNotes()).length).toBe(1);
    fireEvent.click(await screen.findByRole('button', { name: sf.undo }));
    await waitFor(() => expect(btn().getAttribute('aria-pressed')).toBe('false'));
    expect((await sharedNotes()).length).toBe(0);
  });

  it('Stop sharing hides it at once and Undo restores it', async () => {
    mount();
    await waitFor(() => list().getAllByRole('button'));
    const rec = screen.getByRole('complementary', { name: c.drRecord });
    const btn = () => within(rec).getByRole('button', { name: /^Share with|^Shared with/ });
    fireEvent.click(btn());
    await waitFor(() => expect(btn().getAttribute('aria-pressed')).toBe('true'));
    fireEvent.click(btn());
    await waitFor(() => expect(btn().getAttribute('aria-pressed')).toBe('false'));
    fireEvent.click(await screen.findByRole('button', { name: sf.undo }));
    await waitFor(() => expect(btn().getAttribute('aria-pressed')).toBe('true'));
  });
});
