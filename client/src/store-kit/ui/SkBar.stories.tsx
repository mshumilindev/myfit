import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage } from '../stories/SkStage';
import { SkBar } from './SkBar';
import { SkBtn } from './SkBtn';

const meta = {
  title: 'Store/SkBar',
  component: SkBar,
  args: { children: null },
} satisfies Meta<typeof SkBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Variants: Story = {
  render: (args) => (
    <SkStage width="phone">
      <SkBar {...args}>
        <SkBtn kind="pri" size="l">
          Install 3 items
        </SkBtn>
      </SkBar>
      <SkBar {...args} note="Nothing leaves your device until you confirm">
        <SkBtn kind="ghost" size="l">
          Cancel
        </SkBtn>
        <SkBtn kind="pri" size="l">
          Add
        </SkBtn>
      </SkBar>
      <SkBar {...args}>
        <SkBtn kind="pri" size="l" disabled>
          Install
        </SkBtn>
      </SkBar>
    </SkStage>
  ),
};
