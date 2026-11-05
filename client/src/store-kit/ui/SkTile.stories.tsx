import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage, SkStageRow } from '../stories/SkStage';
import { SkTile } from './SkTile';

const meta = {
  title: 'Store/SkTile',
  component: SkTile,
  args: { letter: 'S', tone: 1 },
  argTypes: {
    tone: { control: { type: 'range', min: 0, max: 9, step: 1 } },
    size: { control: 'select', options: [undefined, 32, 40, 64, 96] },
  },
} satisfies Meta<typeof SkTile>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <SkStage>
      <SkTile {...args} />
    </SkStage>
  ),
};

/** Tones 0..9 at the default 48 size. */
export const Tones: Story = {
  render: () => (
    <SkStage>
      <SkStageRow>
        {Array.from({ length: 10 }, (_, i) => (
          <SkTile key={i} letter={'ABCDEFGHIJ'[i]} tone={i} />
        ))}
      </SkStageRow>
    </SkStage>
  ),
};

export const Sizes: Story = {
  render: () => (
    <SkStage>
      <SkStageRow>
        <SkTile letter="H" tone={4} size={32} />
        <SkTile letter="H" tone={4} size={40} />
        <SkTile letter="H" tone={4} />
        <SkTile letter="H" tone={4} size={64} />
        <SkTile letter="H" tone={4} size={96} />
      </SkStageRow>
    </SkStage>
  ),
};
