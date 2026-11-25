import type { Meta, StoryObj } from '@storybook/react-vite';
import { ActiveFilters } from './ActiveFilters';
import { Stack } from '../../stories/LocaleMatrix';

const text = {
  groupLabel: 'Active filters',
  clearLabel: 'Clear all',
  removeLabel: (l: string) => `Remove ${l}`,
};
const ONE = [{ id: 'a', label: 'Beginner' }];
const MANY = [
  { id: 'a', label: 'Beginner' },
  { id: 'b', label: 'Full gym' },
  { id: 'c', label: 'Mass' },
  { id: 'd', label: 'Golden age' },
  { id: 'e', label: '4 days' },
];

const meta = {
  title: 'Kit/ActiveFilters',
  component: ActiveFilters,
  args: { items: ONE, onClear: () => {}, ...text },
} satisfies Meta<typeof ActiveFilters>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** One filter, many filters (the chip row scrolls sideways, Clear all stays), and without Clear all. */
export const States: Story = {
  render: () => (
    <Stack>
      <ActiveFilters items={ONE} onClear={() => {}} {...text} />
      <ActiveFilters items={MANY} onClear={() => {}} {...text} />
      <ActiveFilters items={ONE} {...text} />
    </Stack>
  ),
};
