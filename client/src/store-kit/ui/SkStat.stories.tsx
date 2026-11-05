import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage } from '../stories/SkStage';
import { SkStat } from './SkStat';

const meta = {
  title: 'Store/SkStat',
  component: SkStat,
  args: { value: '1', caption: 'Caption' },
} satisfies Meta<typeof SkStat>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Tones: Story = {
  render: () => (
    <SkStage width="phone">
      <div className="sk-rowf sk-g24">
        <SkStat value="12" caption="Installed" />
        <SkStat value="3" caption="Selected" tone="acc" />
        <SkStat value="100%" caption="Ready" tone="ok" />
        <SkStat value="1,234,567" caption="A long caption that wraps" />
      </div>
    </SkStage>
  ),
};
