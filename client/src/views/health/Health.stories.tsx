import type { Meta, StoryObj } from '@storybook/react-vite';
import { HealthView } from '../HealthView';
import {
  dayFromToday,
  kneeInjury,
  period,
  seedStore,
  storyShell,
  workoutOn,
} from '../../stories/fixtures';
import { PageFrame } from '../../stories/PageFrame';

/** Composed page sections of Health (docs/design/health F01–F10, W01–W03). */
const meta = {
  title: 'Pages/Health',
  component: HealthView,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <PageFrame>
        <Story />
      </PageFrame>
    ),
  ],
  args: { shell: storyShell, onClose: () => undefined },
} satisfies Meta<typeof HealthView>;
export default meta;
type Story = StoryObj<typeof meta>;

const history = () => [
  period({ id: 'flu', mode: 'illness', name: 'Flu' }),
  period({ id: 'vac', startDay: dayFromToday(-40), endDay: dayFromToday(-31), name: 'Vacation' }),
  period({ id: 'del', mode: 'active', startDay: dayFromToday(-70), endDay: dayFromToday(-68) }),
];

/** F01 — nothing active: Now, Sleep, Start, Log the past, History. */
export const HomeGroups: Story = {
  beforeEach: () => seedStore({ restPeriods: history() }),
};

/** F02 — illness ongoing (day 3) and a knee in rehab. */
export const HomeActive: Story = {
  beforeEach: () =>
    seedStore({
      restPeriods: [
        period({
          id: 'ill',
          mode: 'illness',
          startDay: dayFromToday(-2),
          endDay: dayFromToday(-2),
          open: true,
        }),
        ...history(),
      ],
      injuries: [kneeInjury()],
    }),
};

/** F03 — schedule full rest: presets + the shared calendar. */
export const FormStartRest: Story = {
  args: { form: { kind: 'new', ctx: 'start', type: 'off' } },
  beforeEach: () => seedStore({}),
};

/** F04 — backfill an illness over a logged workout (gold dot). */
export const FormPastIllness: Story = {
  args: { form: { kind: 'new', ctx: 'past', type: 'illness' } },
  beforeEach: () => seedStore({ workouts: [workoutOn('w1', 5)] }),
};

/** F05 — unwell since an earlier day, still ongoing (dashed open end). */
export const FormIllnessOngoing: Story = {
  args: { form: { kind: 'new', ctx: 'start', type: 'illness' } },
  beforeEach: () => seedStore({}),
};

/** F06 — past injury (body part chips + calendar). */
export const FormPastInjury: Story = {
  args: { form: { kind: 'new', ctx: 'past', type: 'injury' } },
  beforeEach: () => seedStore({}),
};

/** F07 — history list with filters. */
export const HistoryList: Story = {
  args: { view: 'history', hist: 'list' },
  beforeEach: () => seedStore({ restPeriods: history(), injuries: [kneeInjury()] }),
};

/** F08 — view-only timeline. */
export const HistoryTimeline: Story = {
  args: { view: 'history', hist: 'timeline' },
  beforeEach: () => seedStore({ restPeriods: history(), injuries: [kneeInjury()] }),
};

/** W01 — web: groups left, timeline right (open at ≥720px). */
export const WebHome: Story = {
  globals: { viewport: { value: 'web', isRotated: false } },
  beforeEach: () => seedStore({ restPeriods: history(), injuries: [kneeInjury()] }),
};

/** W02 — web: a form in the right panel with two months. */
export const WebForm: Story = {
  globals: { viewport: { value: 'web', isRotated: false } },
  args: { form: { kind: 'new', ctx: 'past', type: 'illness' } },
  beforeEach: () => seedStore({ restPeriods: history(), workouts: [workoutOn('w1', 5)] }),
};
