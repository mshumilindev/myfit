import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';
import { NoteCard } from './NoteCard';

const meta = {
  title: 'Coach/Note card',
  component: NoteCard,
  parameters: { layout: 'padded' },
  args: {
    vis: 'private',
    visLabel: 'Private',
    time: 'Today 08:12',
    text: 'He pauses for 1 s, not 2 s. Check the count next time we train together on Friday.',
    context: {
      icon: 'scales',
      label: 'On decision: Bench stalled 4 weeks',
      onOpen: () => undefined,
      actionLabel: 'Open',
    },
    actions: (
      <>
        <Button variant="ghost" size="sm" icon="pencil-simple">
          Edit
        </Button>
        <Button variant="ghost" size="sm" icon="eye">
          Share with Oleh
        </Button>
        <Button variant="danger" size="sm" icon="trash">
          Delete
        </Button>
      </>
    ),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NoteCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Private: Story = {};
export const Shared: Story = {
  args: {
    vis: 'shared',
    visLabel: 'Shared with Oleh',
    context: { icon: 'calendar-check', label: 'On Upper A', onOpen: undefined },
  },
};
export const ClientReadOnly: Story = {
  args: { vis: 'shared', visLabel: 'From Iryna', actions: undefined },
};
export const Highlighted: Story = { args: { highlighted: true } };
export const Long: Story = {
  args: {
    text: 'Why we pause the bench: the pause removes the bounce, so the chest does the work. Count 2 seconds with the bar on the chest, then press. If the bar drifts forward, lower the weight by 5 kg and keep the same count for the whole block.',
    expandLabel: 'Show all',
    collapseLabel: 'Show less',
  },
};
