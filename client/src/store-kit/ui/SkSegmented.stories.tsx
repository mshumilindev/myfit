import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage, SkStageRow } from '../stories/SkStage';
import { SkSegmented } from './SkSegmented';

const OPTS = [
  { value: 'all', label: 'All' },
  { value: 'apps', label: 'Apps' },
  { value: 'add', label: 'Add-ons' },
];
const meta = {
  title: 'Store/SkSegmented',
  component: SkSegmented,
  args: { options: OPTS, value: 'all', label: 'Kind' },
} satisfies Meta<typeof SkSegmented>;
export default meta;
type Story = StoryObj<typeof meta>;

function Live({ options = OPTS }: { options?: typeof OPTS }) {
  const [v, set] = useState(options[0].value);
  return <SkSegmented options={options} value={v} onChange={set} label="Kind" />;
}

export const Playground: Story = {
  render: () => (
    <SkStage width="phone">
      <Live />
    </SkStage>
  ),
};

export const TwoAndLongLabels: Story = {
  render: () => (
    <SkStage width="phone">
      <SkStageRow label="two options">
        <Live options={OPTS.slice(0, 2)} />
      </SkStageRow>
      <SkStageRow label="long labels">
        <Live
          options={[
            { value: 'a', label: 'Recommended for you' },
            { value: 'b', label: 'Everything else' },
          ]}
        />
      </SkStageRow>
    </SkStage>
  ),
};
