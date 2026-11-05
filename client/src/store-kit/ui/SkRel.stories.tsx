import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage } from '../stories/SkStage';
import { SkRel } from './SkRel';

const meta = {
  title: 'Store/SkRel',
  component: SkRel,
  args: { children: 'Works with Health' },
} satisfies Meta<typeof SkRel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <SkStage>
      <SkRel {...args} />
    </SkStage>
  ),
};

export const LongText: Story = {
  render: () => (
    <SkStage width="phone">
      <SkRel>Works with Health, Nutrition and Calendar add-ons</SkRel>
    </SkStage>
  ),
};
