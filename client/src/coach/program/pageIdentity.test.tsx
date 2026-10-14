/**
 * The REAL hosts, not the Storybook pair: the Coach editor screen and the athlete's Programs page render the same chrome
 * skeleton (back pill, title block, action cluster, info band, toolbar, training-days section, day card, inspector).
 * Their document content differs on purpose, so the day strip, the day card body and the inspector pane are compared as
 * containers only.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n';
import { firstToken, skeleton } from '../../tools/programEditor/ui/domSkeleton';
import { freshProgram, type Program } from '../../views/programs/model';
import { ProgramPage } from '../../views/programs/ProgramPage';
import { configureCoachData } from '../data/config';
import { createFixturesPort } from '../data/__fixtures__/fixtures';
import { setViewport } from '../testViewport';
import { configureProgramData } from './config';
import { EditorScreen } from './EditorScreen';
import { fixtureWorldLite } from './__fixtures__/fixtures';
import { createFixturesProgramPort } from './__fixtures__/programPort';

const BODY = ['.pe-days', '.pe-dc', '.pe-insp-b'];

const athleteProgram = (): Program => ({
  ...freshProgram('Push Pull'),
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
  localStorage.clear();
  configureCoachData({ world: createFixturesPort({ warm: true }) });
  configureProgramData({
    port: createFixturesProgramPort({ world: fixtureWorldLite(), warm: true }),
  });
});
afterEach(() => {
  cleanup();
  configureCoachData();
  configureProgramData();
});

async function coachPage(): Promise<Element> {
  const { container } = render(<EditorScreen cid="c1" onNavigate={() => undefined} />);
  await screen.findByRole('tablist');
  return container.querySelector('.pe-page')!;
}
function athletePage(): Element {
  const { container } = render(
    <ProgramPage
      initial={athleteProgram()}
      saved
      library={[]}
      shell={{ openOverlay: vi.fn() } as never}
      onClose={vi.fn()}
      onSaved={() => undefined}
      onDeleted={() => undefined}
    />,
  );
  return container.querySelector('.pe-page')!;
}

describe.each([1440, 768, 390])('program editor page, real hosts at %s', (width) => {
  it('the Coach editor and the athlete page share one chrome skeleton', async () => {
    setViewport(width);
    const coach = skeleton(await coachPage(), BODY);
    cleanup();
    const athlete = skeleton(athletePage(), BODY);
    expect(athlete.join('\n')).toBe(coach.join('\n'));
  });

  it('the same slots in the same order, one h1, no page chrome of its own', async () => {
    setViewport(width);
    const pages = [await coachPage()];
    cleanup();
    pages.push(athletePage());
    for (const page of pages) {
      const order = [...page.children].map((c) => firstToken(c));
      expect(order.slice(0, 3)).toEqual(['pe-page-back', 'pe-page-head', 'pe-band']);
      expect(order.indexOf('pe-root')).toBeGreaterThan(2);
      expect(order.filter((o) => o === 'pe-page-bar').length).toBe(width < 768 ? 1 : 0);
      expect(page.querySelectorAll('h1')).toHaveLength(1);
      await waitFor(() => expect(page.querySelector('.pe-page-sub .uiav')).toBeTruthy());
    }
  });
});
