import type { Meta, StoryObj } from '@storybook/react-vite';
import { buildFixtureWorld } from '../data/__fixtures__/fixtures';
import { programPageRoute } from '../routes';
import { idOf } from '../screens/storyPorts';
import { bareRows, ProgramStoryFrame } from './storyKit';

/** Check before sending (S-11, S-12): findings, sets per muscle, push and pull, activities, the Send card. */
const meta = {
  title: 'Pages/Coach/Check before sending',
  component: ProgramStoryFrame,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ProgramStoryFrame>;
export default meta;
type Story = StoryObj<typeof meta>;

const W = buildFixtureWorld();
const check = (name = 'Oleh Bondar') => programPageRoute(idOf(W, name), 'check', 'client');

/** diagnostics: two items to fix, Send is gated */
export const Default: Story = { args: { route: check() } };
/** diagnostics-bare: rows without sets are listed, never an error */
export const BareRows: Story = { args: { route: check(), scenario: bareRows } };
/** A client who shares injuries and has a restriction against a planned exercise */
export const Restriction: Story = { args: { route: check('Andriy Lysenko') } };
export const Loading: Story = { args: { route: check(), delayMs: 60000 } };
