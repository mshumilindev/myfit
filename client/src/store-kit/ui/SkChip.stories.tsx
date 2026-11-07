import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage, SkStageRow } from '../stories/SkStage';
import { SkChip, SkChips } from './SkChip';

const meta = {
  title: 'Store/SkChip',
  component: SkChip,
  args: { children: 'Health' },
} satisfies Meta<typeof SkChip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <SkStage>
      <SkChip {...args} />
    </SkStage>
  ),
};

export const States: Story = {
  render: () => (
    <SkStage width="phone">
      <SkStageRow label="off / on / disabled / long">
        <SkChip>All</SkChip>
        <SkChip on>Health</SkChip>
        <SkChip disabled>Disabled</SkChip>
        <SkChip>Nutrition and recovery tools</SkChip>
      </SkStageRow>
    </SkStage>
  ),
};

export const OneLineScrolls: Story = {
  render: () => (
    <SkStage width="phone">
      <SkChips>
        <SkChip on>All</SkChip>
        <SkChip>Health</SkChip>
        <SkChip>Workouts</SkChip>
        <SkChip>Recovery</SkChip>
        <SkChip>Insights</SkChip>
        <SkChip>Look</SkChip>
        <SkChip>Coach</SkChip>
      </SkChips>
    </SkStage>
  ),
};
