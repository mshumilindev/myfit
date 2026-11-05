import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage, SkStageRow } from '../stories/SkStage';
import { SkAvatar } from './SkAvatar';

const IMG =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 4'><rect width='4' height='4' fill='gray'/><circle cx='2' cy='2' r='1' fill='white'/></svg>";

const meta = {
  title: 'Store/SkAvatar',
  component: SkAvatar,
  args: { initials: 'MS' },
  argTypes: { size: { control: 'select', options: [24, 32, 36, 40] } },
} satisfies Meta<typeof SkAvatar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <SkStage>
      <SkAvatar {...args} />
    </SkStage>
  ),
};

export const SizesAndStates: Story = {
  render: () => (
    <SkStage>
      <SkStageRow label="initials 24 / 32 / 36 / 40">
        <SkAvatar initials="MS" size={24} />
        <SkAvatar initials="MS" size={32} />
        <SkAvatar initials="MS" />
        <SkAvatar initials="MS" size={40} />
      </SkStageRow>
      <SkStageRow label="image">
        <SkAvatar initials="MS" src={IMG} label="Maks" size={40} />
      </SkStageRow>
      <SkStageRow label="button (44px hit area)">
        <SkAvatar initials="MS" label="Account" onClick={() => undefined} />
      </SkStageRow>
      <SkStageRow label="long initials are cut to 2">
        <SkAvatar initials="ABCD" />
      </SkStageRow>
    </SkStage>
  ),
};
