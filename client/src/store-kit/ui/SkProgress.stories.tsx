import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage } from '../stories/SkStage';
import { SkProgress } from './SkProgress';

const meta = {
  title: 'Store/SkProgress',
  component: SkProgress,
  args: { value: 40, label: 'Installing' },
  argTypes: { value: { control: { type: 'range', min: 0, max: 100, step: 1 } } },
} satisfies Meta<typeof SkProgress>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <SkStage width="phone">
      <SkProgress {...args} />
    </SkStage>
  ),
};

export const Values: Story = {
  render: () => (
    <SkStage width="phone">
      {[0, 25, 60, 100].map((v) => (
        <SkProgress key={v} value={v} label={`Installing ${v}%`} />
      ))}
    </SkStage>
  ),
};
