/** The Storybook frame of the program screens: its scenarios change exactly what they promise, and the frame renders the real shell. */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setRole } from '../../api';
import { pgEn } from '../../i18n/coachProgram.en';
import { buildFixtureWorld } from '../data/__fixtures__/fixtures';
import { configureCoachData } from '../data/config';
import { programPageRoute } from '../routes';
import { setViewport } from '../testViewport';
import { configureProgramData } from './config';
import { buildBundle, fixtureWorldLite } from './__fixtures__/fixtures';
import { isBare } from '../../views/programs/model';
import { bareRows, musclesDay, ProgramStoryFrame } from './storyKit';

const oleh = buildFixtureWorld().clients.find((c) => c.name === 'Oleh Bondar')!;
const bundle = () => buildBundle(oleh, fixtureWorldLite());

beforeEach(() => {
  setViewport(1440);
  setRole('trainer');
});
afterEach(() => {
  cleanup();
  setRole('member');
  configureCoachData();
  configureProgramData();
});

describe('scenarios', () => {
  it('bareRows turns exactly the three named exercises into "just the exercise" rows and leaves the live program alone', () => {
    const b = bundle();
    const named = ['Paused bench press', 'Incline Dumbbell Press', 'Weighted plank'];
    const out = bareRows(b);
    for (const name of named) {
      expect(isBare(b.draft.items.find((i) => i.name === name)!)).toBe(false);
      expect(isBare(out.draft.items.find((i) => i.name === name)!)).toBe(true);
    }
    const others = out.draft.items.filter((i) => !named.includes(i.name));
    expect(others.some((i) => isBare(i))).toBe(false);
    expect(out.draft.items).toHaveLength(b.draft.items.length);
    expect(out.live).toBe(b.live);
    expect(out.draftVersion).toBe(b.draftVersion);
  });

  it("musclesDay empties Lower B (day 6) of exercises and keeps its muscles as the day's target", () => {
    const b = bundle();
    expect(b.draft.items.some((i) => i.day === 6)).toBe(true);
    const out = musclesDay(b);
    expect(out.draft.items.some((i) => i.day === 6)).toBe(false);
    expect(out.draft.targetMuscles['6'].length).toBeGreaterThan(0);
    expect(out.draft.targetMuscles['6'].length).toBeLessThanOrEqual(6);
    // the other days keep their exercises
    expect(out.draft.items.filter((i) => i.day !== 6)).toHaveLength(
      b.draft.items.filter((i) => i.day !== 6).length,
    );
  });
});

describe('ProgramStoryFrame', () => {
  const edit = programPageRoute(oleh.id, 'edit', 'client');

  it('renders the trainer shell on the programs list from the fixtures world', async () => {
    render(<ProgramStoryFrame route={{ screen: 'programs' }} />);
    expect(await screen.findByText('Upper/Lower 4x')).toBeTruthy();
  });

  it("opens the editor of the client's plan: Check shows the draft's two items to fix", async () => {
    render(<ProgramStoryFrame route={edit} />);
    expect(await screen.findByRole('button', { name: pgEn.edCheck(2) })).toBeTruthy();
    expect(screen.getByRole('button', { name: pgEn.edSendTo('Oleh') })).toBeTruthy();
  });

  it('the scenario reshapes the draft the editor shows (a muscles-only day leaves Lower B uncovered: five to fix, not two)', async () => {
    render(<ProgramStoryFrame route={edit} scenario={musclesDay} />);
    const check = await screen.findByRole('button', { name: /^Check before sending/ });
    expect(check.textContent).toBe(pgEn.edCheck(5));
  });

  it('a slow network shows the skeleton first, then the editor', async () => {
    render(<ProgramStoryFrame route={edit} delayMs={40} />);
    expect(screen.queryByRole('button', { name: pgEn.edSendTo('Oleh') })).toBeNull();
    expect(await screen.findByRole('button', { name: pgEn.edSendTo('Oleh') })).toBeTruthy();
  });

  it('a save that fails on purpose is reported by the editor, and trying again goes through', async () => {
    render(<ProgramStoryFrame route={edit} failNext="offline" />);
    await screen.findByRole('button', { name: pgEn.edSendTo('Oleh') });
    fireEvent.click(screen.getByRole('button', { name: /^Thursday, / }));
    fireEvent.click(screen.getByRole('button', { name: pgEn.edSaveDraft }));
    expect(await screen.findByText(pgEn.edErrOffline)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: pgEn.edRetry }));
    expect(await screen.findByText(pgEn.edSaved)).toBeTruthy();
  });

  it("the shell's exits are inert in a story: the editor stays on screen", async () => {
    setViewport(390);
    render(<ProgramStoryFrame route={edit} />);
    await screen.findByRole('button', { name: pgEn.edSendShort });
    fireEvent.click(screen.getByRole('button', { name: 'Switch app' }));
    fireEvent.click(screen.getByRole('button', { name: 'Profile and mode' }));
    fireEvent.click(await screen.findByText('My workouts'));
    fireEvent.click(screen.getByRole('button', { name: 'Profile and mode' }));
    fireEvent.click(await screen.findByText('Profile'));
    expect(screen.getByRole('button', { name: pgEn.edSendShort })).toBeTruthy();
  });

  it('the scenario also applies when the plan arrives from the network, not only from the cache', async () => {
    render(<ProgramStoryFrame route={edit} scenario={musclesDay} delayMs={30} />);
    expect(await screen.findByRole('button', { name: pgEn.edCheck(5) })).toBeTruthy();
  });
});

describe('scenarios on another client', () => {
  it('bareRows leaves a draft without those exercises untouched', () => {
    const b = buildBundle(
      buildFixtureWorld().clients.find((c) => c.id === 'c2')!,
      fixtureWorldLite(),
    );
    expect(bareRows(b).draft.items).toEqual(b.draft.items);
  });
});
