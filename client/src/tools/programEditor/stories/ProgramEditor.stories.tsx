import type { Meta, StoryObj } from '@storybook/react-vite';
import { useMemo } from 'react';
import { userEvent, within } from 'storybook/test';
import { LOCALES } from '../../../i18n';
import { PG_LOCALES } from '../../../i18n/coachProgram';
import { addBareExercise, addMarker, addWarmupExercise, startDay } from '../model/ops';
import { runCheck } from '../check/engine';
import { CheckReport } from '../ui/CheckReport';
import { DEMO_ACTIVITIES, demoCatalog, demoDoc, demoHost, DemoEditor } from './demoHost';
import '../../../coach/CoachApp.css';

/**
 * The program editor tool on its own: no Coach screen, no app data. `Tools/Program editor` is the tool;
 * `Pages/Coach/Program editor` is the Coach host. Pick the viewport and the locale in the toolbar.
 */
const meta = {
  title: 'Tools/Program editor',
  component: DemoEditor,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="theme-coach" style={{ padding: 'var(--s-16)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DemoEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

/** mode coach: preview, trainer days, library */
export const CoachHost: Story = {
  args: {
    audience: 'Oleh Bondar',
    partner: 'Iryna Melnyk',
    partnerDays: [1],
    initial: { rowName: 'Barbell Bench Press' },
  },
};

/** mode self: a person writes their own program; no client preview */
export const SelfHost: Story = {
  args: { host: demoHost({ mode: 'self' }) },
};

/** mode self, the week starts on Sunday (Profile > Settings): the seven weekday toggles follow that order */
export const SelfHostSundayStart: Story = {
  args: { host: demoHost({ mode: 'self', weekOrder: [7, 1, 2, 3, 4, 5, 6] }) },
};

/** readOnly: every op is a no-op, panes are disabled */
export const ReadOnly: Story = {
  args: { readOnly: true, audience: 'Oleh Bondar', initial: { rowName: 'Barbell Bench Press' } },
};

/** a long Ukrainian dictionary in the tool: nothing may clip */
export const LongUkrainian: Story = {
  args: {
    host: demoHost({ locale: 'uk' }),
    audience: 'Олександра Коваленко-Шевченко',
    initial: { rowName: 'Barbell Bench Press' },
  },
};

/** a long Polish dictionary */
export const LongPolish: Story = {
  args: {
    host: demoHost({ locale: 'pl' }),
    audience: 'Małgorzata Wiśniewska-Kowalczyk',
    initial: { rowName: 'Barbell Bench Press' },
  },
};

/** phone 390 (use the toolbar viewport "Phone"): one day at a time, the inspector in a sheet */
export const Phone390: Story = {
  args: { audience: 'Oleh Bondar', initial: { rowName: 'Barbell Bench Press' } },
  globals: { viewport: { value: 'phone', isRotated: false } },
};

/** a day defined by muscles, and a bare row */
export const BareAndMuscles: Story = {
  args: {
    doc: (() => {
      const d = startDay(demoDoc(), 5, 'Shoulders');
      return addBareExercise(d, 5, 'Lateral Raise', demoCatalog).program;
    })(),
    audience: 'Oleh Bondar',
    initial: { day: 5 },
  },
};

function Findings() {
  const host = demoHost();
  const doc = useMemo(() => {
    let d = demoDoc();
    d = startDay(d, 5, 'Custom');
    return addBareExercise(d, 5, 'My own move', demoCatalog).program;
  }, []);
  const check = useMemo(
    () =>
      runCheck(doc, {
        catalog: demoCatalog,
        activities: DEMO_ACTIVITIES,
        weekOrder: [1, 2, 3, 4, 5, 6, 7],
        checkContext: { restrictions: ['shoulder'] },
      }),
    [doc],
  );
  return (
    <CheckReport
      check={check}
      doc={doc}
      labels={PG_LOCALES.en}
      words={{
        muscleGroups: LOCALES.en.muscleGroups,
        actType: LOCALES.en.actType,
        actEffortLevel: LOCALES.en.actEffortLevel,
        equipmentLabel: host.words.equipmentLabel,
      }}
      audience="Oleh Bondar"
      onFix={() => {}}
    />
  );
}
/** the check report: findings, weekly volume, push / pull */
export const CheckFindings: Story = { render: () => <Findings /> };

/** Add pane with a typed name the catalog does not know: "Create <name>" (custom exercise by name) */
export const CreateCustomExercise: Story = {
  args: { audience: 'Oleh Bondar', initial: { pane: 'add' } },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement.ownerDocument.body);
    // on a phone the pane lives in a sheet that opens from the day card
    if (!c.queryByPlaceholderText('Search exercises'))
      await userEvent.click((await c.findAllByRole('button', { name: 'Add exercise' }))[0]);
    await userEvent.type(await c.findByPlaceholderText('Search exercises'), 'Cable hip abduction');
  },
};

/** the same on a phone: the Add pane in the sheet */
export const CreateCustomExercisePhone: Story = {
  ...CreateCustomExercise,
  globals: { viewport: { value: 'phone', isRotated: false } },
};

const warmDoc = () => {
  let d = addMarker(demoDoc(), 1, 'warmup');
  const id = d.items.find((i) => i.kind === 'warmup')!.id;
  d = addWarmupExercise(d, id, { name: 'Lateral Raise', reps: 15, weight: 4 });
  d = addWarmupExercise(d, id, { name: 'Plank', durationSec: 30 });
  return { d, id };
};

const WARM = warmDoc();

/** warm-up exercises: one line each, the pencil opens the drawer (reps / seconds, weight) */
export const WarmupList: Story = {
  args: {
    host: demoHost({ mode: 'self', warmupWeighted: () => true }),
    doc: WARM.d,
    initial: { itemId: WARM.id },
  },
};

/** the warm-up drawer, with the weight field */
export const WarmupDrawer: Story = {
  ...WarmupList,
  play: async ({ canvasElement }) => {
    const c = within(canvasElement.ownerDocument.body);
    if (!c.queryByRole('button', { name: 'Edit Lateral Raise' }))
      await userEvent.click((await c.findAllByRole('button', { name: /Warm-up/ }))[0]);
    await userEvent.click(await c.findByRole('button', { name: 'Edit Lateral Raise' }));
  },
};

/** the same drawer on a phone */
export const WarmupDrawerPhone: Story = {
  ...WarmupDrawer,
  globals: { viewport: { value: 'phone', isRotated: false } },
};

/** removing an activity the person had changed asks first (an untouched one only offers Undo) */
export const RemoveActivityConfirm: Story = {
  args: {
    doc: {
      ...demoDoc(),
      activities: [{ id: 'a9', day: 1, type: 'run', minutes: 45, effort: 'hard', when: 'after' }],
    },
    initial: { day: 1, itemId: 'a9' },
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement.ownerDocument.body);
    if (!c.queryByRole('button', { name: 'Remove' }))
      await userEvent.click((await c.findAllByRole('button', { name: /Run/ }))[0]);
    await userEvent.click(await c.findByRole('button', { name: 'Remove' }));
  },
};
