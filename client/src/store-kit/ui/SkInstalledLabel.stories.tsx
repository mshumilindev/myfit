import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage, SkStageRow } from '../stories/SkStage';
import { SkInstalledLabel } from './SkInstalledLabel';

const meta = {
  title: 'Store/SkInstalledLabel',
  component: SkInstalledLabel,
  args: { children: 'Installed' },
} satisfies Meta<typeof SkInstalledLabel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <SkStage>
      <SkInstalledLabel {...args} />
    </SkStage>
  ),
};

export const LongText: Story = {
  render: () => (
    <SkStage width="phone">
      <SkStageRow>
        <SkInstalledLabel>Installed on this device</SkInstalledLabel>
      </SkStageRow>
    </SkStage>
  ),
};
