import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { NumberStepper } from './NumberStepper';
import { Row, Stack } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/NumberStepper',
  component: NumberStepper,
  args: { label: 'Weight', value: 100, unit: 'kg', step: 2.5, onChange: () => undefined },
  decorators: [
    (Story) => (
      <div style={{ width: 358 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NumberStepper>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

function SetEditor() {
  const [w, setW] = useState(100);
  const [r, setR] = useState(5);
  return (
    <Row>
      <NumberStepper
        label="Weight"
        value={w}
        onChange={setW}
        step={2.5}
        decimals={2}
        min={0}
        unit="kg"
        size="big"
      />
      <NumberStepper label="Reps" value={r} onChange={setR} step={1} min={0} max={50} size="big" />
    </Row>
  );
}

/** The session pair (big), md size, empty, bounds, disabled. */
export const States: Story = {
  render: () => (
    <Stack>
      <SetEditor />
      <Row>
        <NumberStepper label="Sets" value={4} onChange={() => undefined} min={1} max={10} />
        <NumberStepper label="Rest" value={90} onChange={() => undefined} step={15} unit="s" />
      </Row>
      <Row>
        <NumberStepper
          label="Bodyweight"
          value={0}
          onChange={() => undefined}
          disabled
          placeholder="BW"
        />
        <NumberStepper label="At max" value={10} onChange={() => undefined} max={10} />
        <NumberStepper label="Disabled" value={7} onChange={() => undefined} disabled />
      </Row>
    </Stack>
  ),
};
