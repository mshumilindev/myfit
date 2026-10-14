import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pgEn } from '../../i18n/coachProgram.en';
import { createFixturesPort } from '../data/__fixtures__/fixtures';
import { configureCoachData } from '../data/config';
import { isProgramPage, programPageClient, programPageRoute, type CoachRoute } from '../routes';
import { setViewport } from '../testViewport';
import { CheckScreen } from './CheckScreen';
import { configureProgramData } from './config';
import { EditorScreen } from './EditorScreen';
import { fixtureWorldLite } from './__fixtures__/fixtures';
import { createFixturesProgramPort } from './__fixtures__/programPort';
import { ProgramTab } from './ProgramTab';
import { buildFixtureWorld } from '../data/__fixtures__/fixtures';

const W = buildFixtureWorld();
const oleh = W.clients.find((c) => c.name === 'Oleh Bondar')!;
const p = pgEn;

beforeEach(() => {
  configureCoachData({ world: createFixturesPort({ warm: true }) });
  configureProgramData({
    port: createFixturesProgramPort({ world: fixtureWorldLite(), warm: true }),
  });
  setViewport(1440);
});
afterEach(() => {
  cleanup();
  configureCoachData();
  configureProgramData();
});

function Router({ start }: { start: CoachRoute }) {
  const [r, setR] = useState<CoachRoute>(start);
  const to = (x: CoachRoute) => setR(x);
  if (isProgramPage(r) && r.sub === 'check')
    return (
      <CheckScreen cid={programPageClient(r)} from={r.cid ? 'client' : 'list'} onNavigate={to} />
    );
  if (isProgramPage(r) && r.sub === 'edit')
    return (
      <EditorScreen cid={programPageClient(r)} from={r.cid ? 'client' : 'list'} onNavigate={to} />
    );
  return <div data-testid="elsewhere">{JSON.stringify(r)}</div>;
}
const edit: CoachRoute = programPageRoute(oleh.id, 'edit', 'client');
const check: CoachRoute = programPageRoute(oleh.id, 'check', 'client');

describe('Program tab', () => {
  it('shows the program by weekday and opens the editor', async () => {
    const seen: CoachRoute[] = [];
    render(<ProgramTab client={oleh} onNavigate={(r) => seen.push(r)} />);
    await waitFor(() => expect(screen.getByText(p.ptOpenEditor)).toBeTruthy());
    expect(screen.getByText('Upper/Lower 4x')).toBeTruthy();
    fireEvent.click(screen.getByText(p.ptOpenEditor));
    expect(seen.at(-1)).toEqual({
      screen: 'programs',
      programId: `prg-${oleh.id}`,
      sub: 'edit',
      cid: oleh.id,
    });
  });
});

describe('Editor', () => {
  it('Send is soft-disabled with a reason while items are to fix, and opens the gate', async () => {
    render(<Router start={edit} />);
    const send = await screen.findByRole('button', { name: p.edSendTo('Oleh') });
    expect(send.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText(p.edSendUnlocks)).toBeTruthy();
    fireEvent.click(send);
    const dlg = await screen.findByRole('alertdialog');
    expect(within(dlg).getByText(p.edGateTitle(2))).toBeTruthy();
    fireEvent.click(within(dlg).getByRole('button', { name: p.edGateOpen }));
    await screen.findByText(p.ckTitle, { selector: 'h1' });
  });

  it('selecting a row shows its targets; "just the exercise" removes them', async () => {
    render(<Router start={edit} />);
    const row = await screen.findByRole('button', { name: new RegExp('Barbell Bench Press') });
    fireEvent.click(row);
    const seg = await screen.findByRole('group', { name: p.edRowType });
    fireEvent.click(within(seg).getByRole('button', { name: p.edJustEx }));
    expect(await screen.findByText(p.edBareBody('Oleh'))).toBeTruthy();
  });

  it('the mode switch asks before it drops exercises, and can be undone', async () => {
    render(<Router start={edit} />);
    await screen.findByRole('button', { name: p.edSendTo('Oleh') });
    const seg = await screen.findByRole('group', { name: p.edDayMode });
    fireEvent.click(within(seg).getByRole('button', { name: new RegExp(p.edMuscles) }));
    const dlg = await screen.findByRole('alertdialog');
    expect(within(dlg).getByText(p.edSwitchTitle)).toBeTruthy();
    fireEvent.click(within(dlg).getByRole('button', { name: p.edKeepEx }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('a client that does not exist shows the empty state, not a blank page', async () => {
    render(<Router start={programPageRoute('nope', 'edit', 'client')} />);
    await screen.findByText(p.edNoClientTitle);
  });
});

describe('Check before sending', () => {
  it('lists the two items to fix and gates Send; Fix in editor goes to the editor', async () => {
    render(<Router start={check} />);
    await screen.findByText(p.ckTitle, { selector: 'h1' });
    expect(screen.getAllByText(p.ckToFix).length).toBeGreaterThan(0);
    const send = screen.getByRole('button', { name: p.ckSendTo('Oleh') });
    expect(send.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText(p.ckUnlocks(2))).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: p.ckFixInEditor })[0]);
    await screen.findByText(p.edTitle, { selector: 'h1' });
  });

  it('bar labels say the state in words (never colour only)', async () => {
    render(<Router start={check} />);
    await screen.findByText(p.ckSetsPerMuscle);
    const imgs = screen.getAllByRole('img');
    expect(
      imgs.some(
        (i) =>
          /range \d+–?\d*/.test(i.getAttribute('aria-label') ?? '') ||
          /range/.test(i.getAttribute('aria-label') ?? ''),
      ),
    ).toBe(true);
    expect(screen.getAllByText(p.ckBelow).length).toBeGreaterThan(0);
  });

  it('the phone has a sticky Send bar', async () => {
    setViewport(390);
    render(<Router start={check} />);
    await screen.findByText(p.ckTitle, { selector: 'h1' });
    expect(screen.getAllByRole('button', { name: p.ckSendBar }).length).toBeGreaterThan(0);
  });
});
