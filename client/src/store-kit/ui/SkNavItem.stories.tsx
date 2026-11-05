import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage, SkStageRow } from '../stories/SkStage';
import { SkNavItem } from './SkNavItem';

const icon = (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    aria-hidden="true"
  >
    <rect x="4" y="4" width="16" height="16" rx="4" />
  </svg>
);

const meta = {
  title: 'Store/SkNavItem',
  component: SkNavItem,
  args: { label: 'Selected', icon },
} satisfies Meta<typeof SkNavItem>;
export default meta;
type Story = StoryObj<typeof meta>;

export const States: Story = {
  render: (args) => (
    <SkStage>
      <SkStageRow label="default / active">
        <div className="sk-col sk-g8">
          <SkNavItem {...args} />
          <SkNavItem {...args} active />
        </div>
      </SkStageRow>
      <SkStageRow label="count chip (3, 128, active)">
        <div className="sk-col sk-g8">
          <SkNavItem {...args} count={3} />
          <SkNavItem {...args} count={128} />
          <SkNavItem {...args} count={3} active />
        </div>
      </SkStageRow>
      <SkStageRow label="long label">
        <SkNavItem {...args} label="A very long navigation label that truncates" count={7} />
      </SkStageRow>
    </SkStage>
  ),
};
