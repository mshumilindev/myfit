import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage, SkStageRow } from '../stories/SkStage';
import { SkBadge, type SkBadgeKind } from './SkBadge';

const KINDS: SkBadgeKind[] = ['app', 'add', 'soon', 'ok', 'warn', 'new'];
const meta = {
  title: 'Store/SkBadge',
  component: SkBadge,
  args: { kind: 'add', children: 'Add-on' },
  argTypes: { kind: { control: 'select', options: KINDS } },
} satisfies Meta<typeof SkBadge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <SkStage>
      <SkBadge {...args} />
    </SkStage>
  ),
};

export const AllKinds: Story = {
  render: () => (
    <SkStage>
      <SkStageRow>
        {KINDS.map((k) => (
          <SkBadge key={k} kind={k}>
            {k}
          </SkBadge>
        ))}
      </SkStageRow>
      <SkStageRow label="long text">
        <SkBadge kind="soon">Coming soon to every platform</SkBadge>
      </SkStageRow>
    </SkStage>
  ),
};
