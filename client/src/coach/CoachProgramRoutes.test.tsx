import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { coachEn } from '../i18n/coach.en';
import { pgEn } from '../i18n/coachProgram.en';
import { CoachApp } from './CoachApp';
import { configureCoachData } from './data/config';
import { createFixturesPort } from './data/__fixtures__/fixtures';
import { configureProgramData, getProgramPort } from './program/config';
import { fixtureWorldLite, olehDraft } from './program/__fixtures__/fixtures';
import type { ProgramPort } from './program/port';
import { createFixturesProgramPort } from './program/__fixtures__/programPort';
import { setViewport } from './testViewport';

const p = pgEn;

beforeEach(() => {
  localStorage.clear();
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
  window.location.hash = '';
});

function mount(hash: string) {
  window.location.hash = hash;
  return render(
    <CoachApp
      role="trainer"
      name="Iryna Melnyk"
      onExitToWorkouts={() => undefined}
      onOpenShell={() => undefined}
    />,
  );
}

describe('CoachApp program routes (whole shell, fixtures port)', () => {
  it('#/c/clients/c1/program renders the Program tab inside the shell, never a skeleton for ever', async () => {
    mount('#/c/clients/c1/program');
    expect(screen.getByRole('complementary')).toBeTruthy(); // the rail
    expect(await screen.findByText(p.ptOpenEditor, {}, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByText('Upper/Lower 4x')).toBeTruthy();
  });

  it('#/c/programs/prg-c1/edit renders the editor inside the shell', async () => {
    mount('#/c/programs/prg-c1/edit');
    expect(screen.getByRole('complementary')).toBeTruthy();
    expect(await screen.findByText(p.edTitle, { selector: 'h1' }, { timeout: 3000 })).toBeTruthy();
    await waitFor(() =>
      expect(screen.getAllByText(/Barbell Bench Press/).length).toBeGreaterThan(0),
    );
  });

  it('#/c/programs/prg-c1/check renders the check inside the shell', async () => {
    mount('#/c/programs/prg-c1/check');
    expect(await screen.findByText(p.ckTitle, { selector: 'h1' }, { timeout: 3000 })).toBeTruthy();
  });

  it.each(['edit', 'check'])(
    'the old URL #/c/clients/c1/program/%s redirects to the one under programs',
    async (sub) => {
      mount(`#/c/clients/c1/program/${sub}`);
      expect(
        await screen.findByText(
          sub === 'edit' ? p.edTitle : p.ckTitle,
          { selector: 'h1' },
          { timeout: 3000 },
        ),
      ).toBeTruthy();
      expect(window.location.hash).toBe(`#/c/programs/prg-c1/${sub}?client=c1`);
    },
  );

  it('Back returns to the opener: the client tab when opened from it, the list otherwise', async () => {
    mount('#/c/programs/prg-c1/edit?client=c1');
    await screen.findByText(p.edTitle, { selector: 'h1' }, { timeout: 3000 });
    fireEvent.click(screen.getByRole('button', { name: p.edBack }));
    expect(await screen.findByText(p.ptOpenEditor, {}, { timeout: 3000 })).toBeTruthy();
    expect(window.location.hash).toBe('#/c/clients/c1/program');
    cleanup();
    mount('#/c/programs/prg-c1/edit');
    await screen.findByText(p.edTitle, { selector: 'h1' }, { timeout: 3000 });
    fireEvent.click(screen.getByRole('button', { name: p.edBack }));
    await waitFor(() => expect(window.location.hash).toBe('#/c/programs'));
  });
});

const benchRow = (n: number, reps: number) =>
  screen.findByRole('button', { name: new RegExp(`Barbell Bench Press.*${n} × ${reps}`) });

describe('CoachApp program editor: the whole flow in the real shell', () => {
  it('add an exercise, change sets, reorder, undo / redo, save the draft, Check before sending', async () => {
    mount('#/c/programs/prg-c1/edit?client=c1');
    await screen.findByText(p.edTitle, { selector: 'h1' }, { timeout: 3000 });
    const bench = olehDraft().items.find((i) => /Barbell Bench Press/.test(i.name))!;

    // add an exercise from the library: it appears as "just the exercise"
    fireEvent.click(await screen.findByRole('button', { name: p.edAddExercise }));
    fireEvent.change(await screen.findByPlaceholderText(p.edSearchEx), {
      target: { value: 'Dumbbell Flyes' },
    });
    fireEvent.click(await screen.findByText('Dumbbell Flyes'));
    await waitFor(() => expect(screen.getAllByText('Dumbbell Flyes').length).toBeGreaterThan(0));
    expect(await screen.findByText(p.edUnsaved)).toBeTruthy();

    // select the bench press and add a set
    fireEvent.click(await benchRow(bench.sets, bench.reps));
    const sets = within(await screen.findByRole('group', { name: p.edSets }));
    fireEvent.click(sets.getByRole('button', { name: '+' }));
    await benchRow(bench.sets + 1, bench.reps);

    // reorder
    const rowsBefore = screen.getAllByRole('button', { name: /Barbell Bench Press/ }).length;
    fireEvent.click(await screen.findByRole('button', { name: p.edMoveDown }));
    expect(screen.getAllByRole('button', { name: /Barbell Bench Press/ }).length).toBe(rowsBefore);

    // undo (the move), undo (the set), redo (the set)
    fireEvent.click(screen.getByRole('button', { name: p.edUndo }));
    fireEvent.click(screen.getByRole('button', { name: p.edUndo }));
    await benchRow(bench.sets, bench.reps);
    fireEvent.click(screen.getByRole('button', { name: p.edRedo }));
    await benchRow(bench.sets + 1, bench.reps);

    // save the draft: the port holds it
    fireEvent.click(screen.getByRole('button', { name: p.edSaveDraft }));
    await screen.findByText(p.edSaved);
    const saved = getProgramPort().peek('c1')!.draft;
    expect(saved.items.some((i) => i.name === 'Dumbbell Flyes')).toBe(true);
    expect(saved.items.find((i) => /Barbell Bench Press/.test(i.name))?.sets).toBe(bench.sets + 1);

    // Check before sending sees the same draft; "Fix in editor" comes back to it
    fireEvent.click(
      screen.getAllByRole('button', { name: new RegExp(`^${p.edCheck(2).slice(0, 12)}`) })[0],
    );
    await screen.findByText(p.ckTitle, { selector: 'h1' });
    expect(screen.getAllByText(p.ckToFix).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: p.ckFixInEditor })[0]);
    await screen.findByText(p.edTitle, { selector: 'h1' });
    // the draft is the same one: the exercise added earlier is on its day
    fireEvent.click(await screen.findByRole('tab', { name: /Upper A/ }));
    await screen.findAllByText('Dumbbell Flyes');
  });

  it('Send is gated while items are to fix and the gate leads to the check', async () => {
    mount('#/c/programs/prg-c1/edit?client=c1');
    const send = await screen.findByRole('button', { name: p.edSendTo('Oleh') }, { timeout: 3000 });
    expect(send.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(send);
    const dlg = await screen.findByRole('alertdialog');
    fireEvent.click(within(dlg).getByRole('button', { name: p.edGateOpen }));
    await screen.findByText(p.ckTitle, { selector: 'h1' });
  });
});

describe('a failing screen never blanks the shell', () => {
  const failing = (): ProgramPort => ({
    ...createFixturesProgramPort({ world: fixtureWorldLite(), warm: true }),
    peek: () => {
      throw new Error('program cache exploded');
    },
  });

  it('a render error shows a calm card with Retry inside the shell; the rail stays', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    configureProgramData({ port: failing() });
    mount('#/c/programs/prg-c1/edit?client=c1');
    expect(await screen.findByText(coachEn.screenFailedTitle, {}, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByRole('complementary')).toBeTruthy(); // the rail is still there
    expect(screen.getByRole('main')).toBeTruthy();
    // Retry after the cause is gone brings the editor back
    configureProgramData({
      port: createFixturesProgramPort({ world: fixtureWorldLite(), warm: true }),
    });
    fireEvent.click(screen.getByRole('button', { name: coachEn.screenFailedRetry }));
    expect(await screen.findByText(p.edTitle, { selector: 'h1' }, { timeout: 3000 })).toBeTruthy();
    spy.mockRestore();
  });

  it('navigating to another screen clears the failure', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    configureProgramData({ port: failing() });
    mount('#/c/programs/prg-c1/edit?client=c1');
    await screen.findByText(coachEn.screenFailedTitle, {}, { timeout: 3000 });
    configureProgramData({
      port: createFixturesProgramPort({ world: fixtureWorldLite(), warm: true }),
    });
    window.location.hash = '#/c/clients/c1/program';
    expect(await screen.findByText(p.ptOpenEditor, {}, { timeout: 3000 })).toBeTruthy();
    expect(screen.queryByText(coachEn.screenFailedTitle)).toBeNull();
    spy.mockRestore();
  });
});
