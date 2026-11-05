import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage } from '../stories/SkStage';
import { SkBento } from './SkBento';
import { SkBentoTile } from './SkBentoTile';

const meta = {
  title: 'Store/SkBento',
  component: SkBento,
  args: { children: null },
} satisfies Meta<typeof SkBento>;
export default meta;
type Story = StoryObj<typeof meta>;

const tiles = [1, 2, 3, 4, 5].map((n) => (
  <SkBentoTile key={n} tone={n} eyebrow={`Tile ${n}`} title="App" />
));

export const TwoColumns: Story = {
  render: () => (
    <SkStage width="phone">
      <SkBento>{tiles}</SkBento>
    </SkStage>
  ),
};

/** 3 and 4 columns apply from the wide breakpoint; below it the grid stays at 2. */
export const WideColumns: Story = {
  render: () => (
    <SkStage width="wide" themes={['light']}>
      <SkBento cols={3}>{tiles}</SkBento>
      <SkBento cols={4}>{tiles}</SkBento>
    </SkStage>
  ),
};
