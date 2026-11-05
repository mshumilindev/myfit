import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { WheelColumn, type WheelItem } from './WheelColumn';
import { Row } from '../../stories/LocaleMatrix';

const items: WheelItem[] = Array.from({ length: 41 }, (_, i) => ({
  key: String(i),
  label: String(i),
}));

const meta = {
  title: 'Kit/WheelColumn',
  component: WheelColumn,
  args: { label: 'Reps', items, index: 8, onIndex: () => undefined },
  decorators: [
    (Story) => (
      <div style={{ width: 120 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WheelColumn>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

function Controlled({ unit, disabled }: { unit?: string; disabled?: boolean }) {
  const [i, setI] = useState(8);
  return (
    <WheelColumn
      label="Reps"
      items={items}
      index={i}
      onIndex={setI}
      unit={unit}
      disabled={disabled}
    />
  );
}

/** A bare drum (the picker adds the band and the well); with a unit; disabled. */
export const States: Story = {
  render: () => (
    <Row>
      <Controlled />
      <Controlled unit="kg" />
      <Controlled disabled />
    </Row>
  ),
  decorators: [
    (Story) => (
      <div style={{ width: 358 }}>
        <Story />
      </div>
    ),
  ],
};
