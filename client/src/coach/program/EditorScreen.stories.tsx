import type { Meta, StoryObj } from '@storybook/react-vite';
import { buildFixtureWorld } from '../data/__fixtures__/fixtures';
import { programPageRoute } from '../routes';
import { idOf } from '../screens/storyPorts';
import { bareRows, musclesDay, ProgramStoryFrame } from './storyKit';

/** Program editor of one client (S-06..S-10, S-13): trainer days, day cards, bare rows, muscles days, preview, send gate. */
const meta = {
  title: 'Pages/Coach/Program editor',
  component: ProgramStoryFrame,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ProgramStoryFrame>;
export default meta;
type Story = StoryObj<typeof meta>;

const W = buildFixtureWorld();
const edit = (name = 'Oleh Bondar') => programPageRoute(idOf(W, name), 'edit', 'client');

/** editor: a row selected, its targets in the inspector */
export const Default: Story = {
  args: { route: edit(), initial: { rowName: 'Barbell Bench Press - Medium Grip' } },
};
/** editor-bare-rows: three rows are "just the exercise" */
export const BareRows: Story = {
  args: { route: edit(), scenario: bareRows, initial: { rowName: 'Incline Dumbbell Press' } },
};
/** editor-day-muscles: Lower B is defined by muscles */
export const DayByMuscles: Story = {
  args: { route: edit(), scenario: musclesDay, initial: { day: 6 } },
};
/** editor-mode-switch: switching a day with exercises to muscles asks first */
export const ModeSwitch: Story = { args: { route: edit(), initial: { day: 4, dialog: 'switch' } } };
/** editor-client-view: what the client sees for the selected row, drawn by the client's own components */
export const ClientView: Story = {
  args: { route: edit(), initial: { rowName: 'Barbell Shoulder Press', pane: 'view' } },
};
export const ClientViewBare: Story = {
  args: {
    route: edit(),
    scenario: bareRows,
    initial: { rowName: 'Incline Dumbbell Press', pane: 'view' },
  },
};
/** editor-check-failed: Send with items to fix opens the gate */
export const SendGate: Story = { args: { route: edit(), initial: { dialog: 'gate' } } };
export const VersionOpen: Story = { args: { route: edit(), initial: { versionOpen: true } } };
export const AddExercise: Story = { args: { route: edit(), initial: { pane: 'add' } } };
export const Loading: Story = { args: { route: edit(), delayMs: 60000 } };
export const SaveConflict: Story = { args: { route: edit(), failNext: 'conflict' } };
