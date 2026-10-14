import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rosterEn as r } from '../../i18n/coachRoster.en';
import { createFixturesPort } from '../data/__fixtures__/fixtures';
import { ALL_OFF } from '../domain/consent';
import type { CoachClient, Evidence } from '../domain/types';
import { setViewport } from '../testViewport';
import { EvidenceBlock, SignalsScreen } from './SignalsScreen';
import { emptyRoster, worldPort } from './storyPorts';
import { safeEn } from '../../i18n/coachSafe.en';

afterEach(cleanup);
beforeEach(() => setViewport(1440));

const mount = (over: Partial<Parameters<typeof SignalsScreen>[0]> = {}) => {
  const onNavigate = vi.fn();
  render(<SignalsScreen onNavigate={onNavigate} port={createFixturesPort()} {...over} />);
  return { onNavigate };
};
const list = () => within(screen.getByRole('list', { name: r.sgListLabel }));

describe('Signals', () => {
  it('loading skeleton, then the list; the count is the number of rows', async () => {
    mount({ port: createFixturesPort({ delayMs: 40 }) });
    expect(screen.getByRole('status', { name: r.roLoading })).toBeTruthy();
    await waitFor(() => expect(list().getAllByRole('button').length).toBeGreaterThan(4));
    const n = list().getAllByRole('button').length;
    expect(screen.getByText(r.sgCount(n))).toBeTruthy();
  });

  it('error with nothing to show offers Try again', async () => {
    let fail = true;
    mount({ port: createFixturesPort({ failWith: () => (fail ? 'unavailable' : null) }) });
    expect(await screen.findByText(safeEn.pbUnknownTitle)).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: r.stTryAgain }));
    await waitFor(() => expect(list().getAllByRole('button').length).toBeGreaterThan(4));
  });

  it('urgent open signals first; the inspector opens the first one with its evidence', async () => {
    mount();
    await waitFor(() => list().getAllByRole('button'));
    const first = list().getAllByRole('button')[0];
    expect(first.textContent).toContain(r.roStatusUrgent);
    const insp = screen.getByRole('complementary', { name: r.sgEvidence });
    expect(within(insp).getByRole('heading', { level: 2 }).textContent).toMatch(
      /has not moved in 4 weeks/,
    );
    expect(within(insp).getByRole('heading', { name: r.sgEvidence })).toBeTruthy();
    expect(within(insp).getAllByRole('row').length).toBeGreaterThan(0);
  });

  it('the evidence is the lab line chart (min / max, first and last x label) and the client name opens the profile', async () => {
    const { onNavigate } = mount();
    await waitFor(() => list().getAllByRole('button'));
    const insp = screen.getByRole('complementary', { name: r.sgEvidence });
    expect(insp.querySelector('.uievc svg')).toBeTruthy();
    expect(insp.querySelector('.uievc-last')).toBeTruthy();
    expect(within(insp).queryByRole('button', { name: r.sgOpenClient })).toBeNull();
    fireEvent.click(within(insp).getByRole('button', { name: new RegExp(`${r.sgOpenClient}: `) }));
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ screen: 'client' }));
  });

  it('severity filter narrows; an impossible combination shows no-match and Clear filters resets', async () => {
    mount();
    await waitFor(() => list().getAllByRole('button'));
    const all = list().getAllByRole('button').length;
    fireEvent.change(screen.getByLabelText(r.sgFilterLabelSeverity), {
      target: { value: 'urgent' },
    });
    const urgent = list().getAllByRole('button');
    expect(urgent.length).toBeLessThan(all);
    expect(urgent.every((b) => b.textContent!.includes(r.roStatusUrgent))).toBe(true);
    fireEvent.change(screen.getByLabelText(r.sgFilterLabelClient), { target: { value: 'c2' } });
    expect(screen.getByText(r.sgNoMatch)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: r.sgClearFilters }));
    expect(list().getAllByRole('button')).toHaveLength(all);
  });

  it('a decided signal carries the Decided pill', async () => {
    mount();
    await waitFor(() => list().getAllByRole('button'));
    fireEvent.change(screen.getByLabelText(r.sgFilterLabelState), { target: { value: 'decided' } });
    const rows = screen
      .queryAllByRole('button')
      .filter((b) => b.textContent?.includes(r.sgStateDecided) && b.className.includes('ros-sig'));
    if (rows.length)
      expect(rows.every((b) => b.textContent!.includes(r.sgStateDecided))).toBe(true);
    else expect(screen.getByText(r.sgNoMatch)).toBeTruthy();
  });

  it('empty: nothing to show says so', async () => {
    mount({ port: worldPort(emptyRoster) });
    expect(await screen.findByText(r.sgEmptyH)).toBeTruthy();
  });

  it('Open decision hands the signal key over; default goes to the decisions list', async () => {
    const onOpenDecision = vi.fn();
    const { onNavigate } = mount({ onOpenDecision });
    await waitFor(() => list().getAllByRole('button'));
    fireEvent.click(screen.getByRole('button', { name: r.sgOpenDecision }));
    expect(onOpenDecision).toHaveBeenCalledWith(expect.stringContaining('|stall|'));
    expect(onNavigate).not.toHaveBeenCalled();
    cleanup();
    const b = mount();
    await waitFor(() => list().getAllByRole('button'));
    fireEvent.click(screen.getByRole('button', { name: r.sgOpenDecision }));
    expect(b.onNavigate).toHaveBeenCalledWith({ screen: 'decisions' });
  });

  it('phone: a row opens the evidence in a drawer; Esc closes it', async () => {
    setViewport(390);
    mount();
    await waitFor(() => list().getAllByRole('button'));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(list().getAllByRole('button')[0]);
    const dlg = screen.getByRole('dialog');
    expect(within(dlg).getByRole('button', { name: r.sgOpenDecision })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    // the kit Sheet closes after its exit animation
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

const client = (over: Partial<CoachClient> = {}): CoachClient => ({
  id: 'c1',
  name: 'Oleh Bondar',
  goal: '',
  program: 'P',
  programWeek: 1,
  gym: 'G',
  mode: 'app',
  consent: { ...ALL_OFF, totals: 'full', sets: 'full' },
  streakWeeks: 0,
  planned: 0,
  done: 0,
  lastSessionAt: null,
  trainerDays: [],
  ...over,
});
const ev = (category: Evidence['category'], granular = true): Evidence => ({
  category,
  level: 'full',
  granular,
  rows: [{ at: null, label: 'SECRET-LIFT', value: 116, unit: 'kg', detail: '116x5' }],
});

describe('EvidenceBlock: locked categories never render evidence', () => {
  it('consent off now -> the locked sentence, none of the rows (even if the signal carries them)', () => {
    render(
      <EvidenceBlock
        signal={{ evidence: [ev('sets')] }}
        client={client({ consent: { ...ALL_OFF, totals: 'full' } })}
        r={r}
      />,
    );
    expect(screen.getByText(r.sgEvidenceLocked('Oleh'))).toBeTruthy();
    expect(screen.queryByText('SECRET-LIFT')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('program-only: everything is locked whatever the stored consent says', () => {
    render(
      <EvidenceBlock
        signal={{ evidence: [ev('totals')] }}
        client={client({ mode: 'program', consent: { ...ALL_OFF, totals: 'full' } })}
        r={r}
      />,
    );
    expect(screen.queryByText('SECRET-LIFT')).toBeNull();
    expect(screen.getByText(r.sgEvidenceLocked('Oleh'))).toBeTruthy();
  });

  it('shared: rows with units; weekly-only evidence says set-by-set needs Full', () => {
    render(<EvidenceBlock signal={{ evidence: [ev('sets', false)] }} client={client()} r={r} />);
    expect(screen.getByText('SECRET-LIFT')).toBeTruthy();
    expect(screen.getByText('116 kg')).toBeTruthy();
    expect(screen.getByText(r.sgEvidenceNeedsFull)).toBeTruthy();
  });

  it('no rows at all says so', () => {
    render(<EvidenceBlock signal={{ evidence: [] }} client={client()} r={r} />);
    expect(screen.getByText(r.sgEvidenceNone)).toBeTruthy();
  });
});
