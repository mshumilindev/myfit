import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { FilterGroup } from './FilterGroup';
import { Stack } from '../../stories/LocaleMatrix';

const LEVEL = [
  { id: 'l1', label: 'Beginner', count: 3 },
  { id: 'l2', label: 'Intermediate', count: 2 },
  { id: 'l3', label: 'Advanced', count: 2 },
];
const DAYS = [
  { id: 'd3', label: '3 days', count: 3 },
  { id: 'd4', label: '4 days', count: 1 },
  { id: 'd5', label: '5 days', count: 0 },
  { id: 'd6', label: '6 days', count: 3 },
];

const meta = {
  title: 'Kit/FilterGroup',
  component: FilterGroup,
  args: { label: 'Level', options: LEVEL, active: [] },
} satisfies Meta<typeof FilterGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

function PlaygroundGroup(args: ComponentProps<typeof FilterGroup>) {
  const [on, setOn] = useState<string[]>([]);
  return (
    <FilterGroup
      {...args}
      active={on}
      onToggle={(id) => setOn((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))}
    />
  );
}

export const Playground: Story = {
  render: (args) => <PlaygroundGroup {...args} />,
};

/** None on, some on, and an option that matches nothing (dimmed, disabled). */
export const States: Story = {
  render: () => (
    <Stack>
      <FilterGroup label="Level" options={LEVEL} active={[]} />
      <FilterGroup label="Level" options={LEVEL} active={['l1']} />
      <FilterGroup label="Days a week" options={DAYS} active={['d3']} />
    </Stack>
  ),
};
