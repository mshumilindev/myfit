import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Checkbox } from './Checkbox';
import { Row, Stack } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/Checkbox',
  component: Checkbox,
  args: { checked: true, onChange: () => undefined, 'aria-label': 'Include' },
} satisfies Meta<typeof Checkbox>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

function Live() {
  const [on, setOn] = useState(false);
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <Checkbox checked={on} onChange={setOn} />
      Include warm-up sets
    </label>
  );
}

/** Off, on, disabled, toned, interactive. */
export const States: Story = {
  render: () => (
    <Stack>
      <Row>
        <Checkbox checked={false} onChange={() => undefined} aria-label="off" />
        <Checkbox checked onChange={() => undefined} aria-label="on" />
        <Checkbox checked disabled onChange={() => undefined} aria-label="disabled" />
        <Checkbox checked tone="ok" onChange={() => undefined} aria-label="ok" />
        <Checkbox checked tone="sleep" onChange={() => undefined} aria-label="sleep" />
      </Row>
      <Live />
    </Stack>
  ),
};
