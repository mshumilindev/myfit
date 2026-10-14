import type { Meta, StoryObj } from '@storybook/react-vite';
import { HostPair, type PairHostKind, type PairState } from './HostPair';

/**
 * The program editor PAGE in both apps, one story per state. The two hosts render the same layout: `host` switches the
 * app (accent ramp and the host's own slot content). `scripts/page-pair-diff.py` shoots the pairs at 1440 / 768 / 390.
 */
const meta = {
  title: 'Tools/Program editor page',
  component: HostPair,
  parameters: { layout: 'fullscreen' },
  args: { host: 'coach' as PairHostKind, state: 'selected' as PairState },
  argTypes: {
    host: { control: 'inline-radio', options: ['coach', 'athlete'] },
  },
  decorators: [
    (Story) => (
      <div style={{ padding: 'var(--s-16)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HostPair>;
export default meta;
type Story = StoryObj<typeof meta>;

/** No training days yet: the same empty state in both apps. */
export const Empty: Story = { args: { state: 'empty' } };
/** A row selected: its targets in the inspector. */
export const SelectedExercise: Story = { args: { state: 'selected' } };
/** A planned activity selected. */
export const Activity: Story = { args: { state: 'activity' } };
/** A warm-up with its exercise list. */
export const Warmup: Story = { args: { state: 'warmup' } };
/** The program is not ready: the band note, the main action. */
export const CheckFindings: Story = { args: { state: 'findings' } };
/** Read only: no actions, nothing editable. */
export const ReadOnly: Story = { args: { state: 'readonly' } };
/** A day defined by muscles. */
export const MusclesDay: Story = { args: { state: 'muscles' } };
