import type { Meta, StoryObj } from '@storybook/react-vite';
import { Checklist } from './Checklist';
import { Stack } from '../../stories/LocaleMatrix';

const items = [
  { id: 'terms', label: 'Read: Terms of Use', done: true },
  { id: 'privacy', label: 'Read: Privacy Policy', done: true },
  { id: 'age', label: 'Confirm you are 18 or older', done: false },
  { id: 'agree', label: 'Tick the agreement', done: false },
];

const meta = {
  title: 'Kit/Checklist',
  component: Checklist,
  args: { title: 'Still to do on this page', items },
  decorators: [
    (Story) => (
      <div style={{ width: 358 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Checklist>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Every item stays; the finished ones turn green with a check. */
export const Partly: Story = {};

export const Nothing: Story = {
  args: { items: items.map((i) => ({ ...i, done: false })) },
};

/** All done: the whole card turns green. */
export const All: Story = {
  args: { title: 'Ready to continue', items: items.map((i) => ({ ...i, done: true })) },
};

export const Variants: Story = {
  render: (args) => (
    <Stack>
      <Checklist {...args} />
      <Checklist title="Ready to continue" items={items.map((i) => ({ ...i, done: true }))} />
    </Stack>
  ),
};
