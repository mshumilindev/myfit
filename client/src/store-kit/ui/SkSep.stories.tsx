import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage } from '../stories/SkStage';
import { SkSep } from './SkSep';

const meta = { title: 'Store/SkSep', component: SkSep } satisfies Meta<typeof SkSep>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: () => (
    <SkStage width="phone">
      <span className="sk-t-s">Above</span>
      <SkSep />
      <span className="sk-t-s">Below</span>
    </SkStage>
  ),
};

export const Vertical: Story = {
  render: () => (
    <SkStage width="phone">
      <div className="sk-rowf sk-g12">
        <span className="sk-t-s">Left</span>
        <SkSep vertical />
        <span className="sk-t-s">Right</span>
      </div>
    </SkStage>
  ),
};
