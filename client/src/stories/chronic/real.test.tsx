import { cleanup, render } from '@testing-library/react';
import { writeFileSync, mkdirSync } from 'node:fs';
import { test, vi } from 'vitest';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Tag } from '../../components/ui/Tag';
import { Notice } from '../../components/ui/Notice';
import { IconButton } from '../../components/ui/Button';
import { IconTile } from '../../components/ui/IconTile';
import { GroupedList, ListRow } from '../../components/ui/GroupedList';
import { Switch } from '../../components/ui/Switch';
import { __getStateForTests, __replaceStateForTests } from '../../store';
import { setLocale } from '../../i18n';
import type { Shell } from '../../App';
import type { Exercise, Workout } from '../../types';

vi.mock('react-dom', async (orig) => ({
  ...(await orig<typeof import('react-dom')>()),
  createPortal: (c: unknown) => c,
}));

const OUT = process.env.CHRONIC_OUT ?? '/tmp/chronic-out';
const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const NOW = new Date(2026, 8, 30, 18, 10).getTime();

const sh = (): Shell => ({
  openOverlay: vi.fn(),
  replaceOverlay: vi.fn(),
  goTab: vi.fn(),
  goPlaybook: vi.fn(),
  openStart: vi.fn(),
  toast: vi.fn(),
  snack: vi.fn(),
  signOut: vi.fn(),
  queueLength: 0,
});

const ex = (
  i: number,
  name: string,
  muscle: string,
  sets: [number, number][],
  done = true,
): Exercise => ({
  id: `e${i}${name}`,
  name,
  position: i,
  primaryMuscle: muscle,
  sets: sets.map(([reps, weight], k) => ({
    id: `s${i}${k}`,
    reps: done ? reps : 0,
    weight: done ? weight : 0,
    isWarmup: false,
    position: k,
  })),
});

const live: Workout = {
  id: 'now',
  startedAt: NOW - 25 * MIN,
  finishedAt: null,
  autoFinished: false,
  dayName: 'Leg day',
  exercises: [
    ex(0, 'Barbell Squat', 'quads', [
      [5, 60],
      [5, 60],
      [5, 60],
    ]),
    ex(
      1,
      'Leg Press',
      'quads',
      [
        [10, 130],
        [10, 130],
      ],
      false,
    ),
    ex(2, 'Romanian Deadlift', 'hamstrings', [[8, 60]], false),
  ],
};
const past = (i: number, name: string, day: string): Workout => ({
  id: `p${i}`,
  startedAt: NOW - i * 2 * DAY - 3 * 60 * MIN,
  finishedAt: NOW - i * 2 * DAY - 3 * 60 * MIN + 52 * MIN,
  autoFinished: false,
  dayName: day,
  exercises: [
    ex(0, name, 'quads', [
      [5, 80],
      [5, 80],
      [5, 80],
    ]),
    ex(1, 'Leg Press', 'quads', [
      [10, 140],
      [10, 140],
    ]),
  ],
});

const H = (el: ReactElement) => renderToStaticMarkup(el);
/** Smallest element whose own text is exactly `text`. */
function findText(root: ParentNode, text: string): HTMLElement | null {
  let hit: HTMLElement | null = null;
  root.querySelectorAll<HTMLElement>('*').forEach((e) => {
    if (e.children.length === 0 && e.textContent?.trim() === text && !hit) hit = e;
  });
  return hit;
}
const flag = (kind: 'avoid' | 'careful' | 'ok', why?: string) =>
  H(
    kind === 'ok' ? (
      <Tag tone="neutral">Fine for you</Tag>
    ) : kind === 'avoid' ? (
      <Tag tone="chronic" solid>{`Avoid${why ? ` · ${why}` : ''}`}</Tag>
    ) : (
      <Tag tone="chronic">{`Careful${why ? ` · ${why}` : ''}`}</Tag>
    ),
  );

async function grab(name: string, el: ReactElement, settle = 0, mut?: (c: HTMLElement) => void) {
  try {
    const { container } = render(el);
    if (settle) await new Promise((r) => setTimeout(r, settle));
    mut?.(container);
    writeFileSync(`${OUT}/${name}.html`, container.innerHTML);
  } catch (e) {
    console.log('FAILED', name, String(e).slice(0, 200));
  }
  cleanup();
}

test('real', async () => {
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  mkdirSync(OUT, { recursive: true });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  localStorage.clear();
  setLocale('en');
  __replaceStateForTests({
    ...__getStateForTests(),
    workouts: [
      live,
      past(1, 'Barbell Squat', 'Leg day'),
      past(2, 'Barbell Squat', 'Upper body'),
      past(3, 'Barbell Squat', 'Leg day'),
    ],
    activities: [],
    sleeps: [],
    restPeriods: [],
    injuries: [],
  });
  const { SessionView } = await import('../../views/SessionView');
  await grab(
    'r_session',
    <SessionView workoutId="now" shell={sh()} onClose={() => undefined} />,
    50,
    (c) => {
      const names = [...c.querySelectorAll<HTMLElement>('.exn-primary')].filter(
        (e) => e.textContent === 'Barbell Squat' && !e.closest('.current-strip'),
      );
      names[0]?.closest('.exn')?.insertAdjacentHTML('afterend', flag('careful', 'back'));
      const hint = c.querySelector('.prog-hint');
      if (hint) {
        hint.querySelector('.ph-delta')!.textContent = '−25%';
        hint.querySelector('.ph-target')!.textContent = '60 kg';
        hint.querySelector('.ph-action')!.textContent = 'For your back';
        hint.insertAdjacentHTML(
          'afterend',
          H(
            <Notice tone="chronic" icon="shield-check">
              Adapted for you: back and knee. Your choice always wins.
            </Notice>,
          ),
        );
      }
      c.querySelector('.live-label')?.insertAdjacentHTML(
        'afterend',
        `<span style="margin-left:8px">${H(<Tag tone="chronic">Adapted</Tag>)}</span>`,
      );
    },
  );
  const finished = {
    ...live,
    id: 'done',
    finishedAt: NOW - 2 * MIN,
    exercises: live.exercises.map((e) => ({
      ...e,
      sets: e.sets.map((x) => ({ ...x, reps: 5, weight: 60 })),
    })),
  };
  __replaceStateForTests({
    ...__getStateForTests(),
    workouts: [finished, ...__getStateForTests().workouts.filter((w) => w.id !== 'now')],
  });
  const { markSummaryReturn } = await import('../../views/sessionSummary/NextUp');
  markSummaryReturn('done');
  await grab(
    'r_summary',
    <SessionView workoutId="done" shell={sh()} onClose={() => undefined} />,
    50,
    (c) => {
      const first = c.querySelector('.stat-grid');
      first?.insertAdjacentHTML(
        'beforebegin',
        H(
          <Notice tone="chronic" icon="shield-check">
            Adapted for you: loads −25%, jumps swapped. Your progress and standards are not lowered.
          </Notice>,
        ),
      );
    },
  );
  __replaceStateForTests({
    ...__getStateForTests(),
    workouts: [live, ...__getStateForTests().workouts.filter((w) => w.id !== 'done')],
  });
  const { HistoryListView } = await import('../../views/HistoryListView');
  await grab('r_history', <HistoryListView shell={sh()} onClose={() => undefined} />, 50, (c) => {
    c.querySelectorAll('.hist-workout').forEach((r, i) => {
      if (i === 0)
        r.querySelector('.uirow-lb')?.insertAdjacentHTML(
          'afterend',
          `<span class="uirow-v">${H(<Tag tone="chronic">Adapted</Tag>)}</span>`,
        );
    });
  });
  const { HealthView } = await import('../../views/HealthView');
  await grab(
    'r_health',
    <HealthView shell={sh()} onClose={() => undefined} {...({} as object)} />,
    50,
    (c) => {
      const host = [...c.querySelectorAll<HTMLElement>('.uigl-h')]
        .find((e) => e.textContent === 'History')
        ?.closest('section');
      host?.insertAdjacentHTML(
        'beforebegin',
        H(
          <GroupedList header="Long-term conditions">
            <ListRow
              icon={<IconTile tone="chronic" size={30} icon="person-simple" />}
              label="Chronic lower back pain"
              sub="Squats, deadlifts, rows adapt"
              value={<Tag tone="chronic">Moderate</Tag>}
              chevron
            />
            <ListRow
              icon={<IconTile tone="chronic" size={30} icon="sneaker-move" />}
              label="Knee pain, undiagnosed"
              sub="Right knee · jumps and deep bends adapt"
              value={<Tag tone="chronic">Mild</Tag>}
              chevron
            />
            <ListRow
              icon={<IconTile tone="chronic" size={30} icon="heartbeat" />}
              label="High blood pressure"
              sub="Effort and breathing adapt"
              value={<Tag tone="chronic">Moderate</Tag>}
              chevron
            />
            <ListRow
              icon={<IconTile tone="chronic" size={30} icon="plus" />}
              label="Add a long-term condition"
              action
            />
          </GroupedList>,
        ),
      );
      const start = c.querySelector('.uigl:has(.uit--illness)');
      void start;
    },
  );
  const { HurtsSheet, SwapSheet } = await import('./flow');
  const { SessionView: SV2 } = await import('../../views/SessionView');
  await grab(
    'r_hurts',
    <>
      <SV2 workoutId="now" shell={sh()} onClose={() => undefined} />
      <HurtsSheet />
    </>,
    50,
  );
  await grab(
    'r_swap',
    <>
      <SV2 workoutId="now" shell={sh()} onClose={() => undefined} />
      <SwapSheet />
    </>,
    50,
  );
  const { StartSheet } = await import('../../components/StartSheet');
  await grab('r_start', <StartSheet shell={sh()} onClose={() => undefined} />, 50, (c) => {
    const d = findText(c, 'Sleep, recovery, injury, unwell');
    if (d) d.textContent = 'Sleep, injury, long-term conditions';
  });
  const { TodayView } = await import('../../views/TodayView');
  await grab(
    'r_today',
    <TodayView shell={sh()} store={__getStateForTests() as never} />,
    100,
    (c) => {
      c.querySelector('.td-topbar-actions')?.insertAdjacentHTML(
        'afterbegin',
        H(
          <IconButton icon="shield-check" label="Long-term conditions" variant="ghost" size="sm" />,
        ),
      );
    },
  );
  const { ProfileView } = await import('../../views/ProfileView');
  await grab('r_profile', <ProfileView userId="me" shell={sh()} onClose={() => undefined} />, 100);
  const { ExercisePicker } = await import('../../components/ExercisePicker');
  await grab(
    'r_picker',
    <ExercisePicker
      workout={live}
      gym={null}
      onPick={() => undefined}
      onMarker={() => undefined}
      onCardio={() => undefined}
      onCreate={() => undefined}
      onClose={() => undefined}
    />,
    100,
    (c) => {
      const map: Record<string, string> = {
        'Flutter Kicks': flag('careful', 'back'),
        'Pull Through': flag('careful', 'back'),
        'Step-up with Knee Raise': flag('avoid', 'knee'),
        'Glute Kickback': flag('ok'),
        'Balance Board': flag('ok'),
      };
      c.querySelectorAll<HTMLElement>('.exn-primary').forEach((e) => {
        const f = map[e.textContent ?? ''];
        if (f)
          e.closest('.exn')?.insertAdjacentHTML(
            'afterend',
            `<span class="ul-flex umt-4">${f}</span>`,
          );
      });
      const done = [...c.querySelectorAll<HTMLElement>('*')].find(
        (e) => e.children.length === 0 && e.textContent?.startsWith('Done today'),
      );
      (done?.parentElement ?? c.querySelector('.xp-sugs-list'))?.insertAdjacentHTML(
        'afterend',
        H(
          <div className="umt-12 umb-8">
            <GroupedList>
              <ListRow
                dense
                icon={<IconTile tone="chronic" size={30} icon="shield-check" />}
                label="Hide what doesn't suit me"
                trailing={
                  <Switch
                    checked
                    onChange={() => undefined}
                    tone="chronic"
                    aria-label="Hide what doesn't suit me"
                  />
                }
                as="label"
              />
            </GroupedList>
          </div>,
        ),
      );
    },
  );
  const { ProgramBuilder } = await import('../../views/programs/ProgramBuilder');
  const item = (i: number, name: string, sets: number, reps: number) => ({
    id: `i${i}`,
    day: 1,
    position: i,
    name,
    kind: 'strength' as never,
    sets,
    reps,
    durationMin: null,
    equipment: [] as never[],
  });
  const program = {
    id: 'pg',
    name: 'Strength 3x',
    weeks: 8,
    daysPerWeek: 3,
    status: 'active' as const,
    authorId: 'me',
    dayNames: { '1': 'Leg day', '3': 'Upper', '5': 'Full body' },
    targetMuscles: {},
    items: [
      item(0, 'Barbell Squat', 4, 5),
      item(1, 'Leg Press', 3, 10),
      item(2, 'Box Jump (Multiple Response)', 3, 5),
      item(3, 'Romanian Deadlift', 3, 8),
    ],
  };
  const progFlags: Record<string, string> = {
    'Barbell Squat': flag('careful', 'back'),
    'Box Jump': flag('avoid', 'knee'),
    'Romanian Deadlift': flag('careful', 'back'),
    'Leg Press': flag('ok'),
  };
  for (const step of ['week', 'day'] as const)
    await grab(
      `r_program_${step}`,
      <ProgramBuilder
        initial={program as never}
        saved
        startStep={step}
        library={[]}
        shell={sh()}
        onClose={() => undefined}
        onSaved={() => undefined}
        onDeleted={() => undefined}
        onAssign={() => undefined}
      />,
      100,
      (c) => {
        if (step !== 'day') return;
        c.querySelectorAll<HTMLElement>('.pg-row .n').forEach((n) => {
          const f = Object.entries(progFlags).find(([k]) =>
            (n.textContent ?? '').startsWith(k),
          )?.[1];
          if (f) n.insertAdjacentHTML('beforeend', `<span class="ul-flex umt-4">${f}</span>`);
        });
        c.querySelector('.pg-ex')?.insertAdjacentHTML(
          'beforebegin',
          H(
            <Notice tone="chronic" icon="shield-check">
              3 exercises are flagged for you. Nothing is removed.
            </Notice>,
          ),
        );
      },
    );
});
