import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage, SkStageRow } from '../stories/SkStage';
import { SkSwitch } from './SkSwitch';

const meta = {
  title: 'Store/SkSwitch',
  component: SkSwitch,
  args: { on: false, label: 'Sync' },
} satisfies Meta<typeof SkSwitch>;
export default meta;
type Story = StoryObj<typeof meta>;

function Live({ initial = false, disabled }: { initial?: boolean; disabled?: boolean }) {
  const [on, set] = useState(initial);
  return <SkSwitch on={on} onChange={set} label="Sync" disabled={disabled} />;
}

export const Playground: Story = {
  render: () => (
    <SkStage>
      <Live />
    </SkStage>
  ),
};

export const States: Story = {
  render: () => (
    <SkStage>
      <SkStageRow label="off / on / disabled off / disabled on">
        <Live />
        <Live initial />
        <Live disabled />
        <SkSwitch on label="Sync" disabled />
      </SkStageRow>
    </SkStage>
  ),
};

/** Knob must travel towards the end edge in RTL. */
export const Rtl: Story = {
  render: () => (
    <div dir="rtl">
      <SkStage>
        <Live initial />
      </SkStage>
    </div>
  ),
};
