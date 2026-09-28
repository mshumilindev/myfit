import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Switch } from './Switch';
import { Row } from '../../stories/LocaleMatrix';
import type { Tone } from './tones';

const meta = {
  title: 'Kit/Switch',
  component: Switch,
  args: {
    checked: true,
    onChange: () => undefined,
    tone: 'accent',
    size: 'md',
    'aria-label': 'Toggle',
  },
} satisfies Meta<typeof Switch>;
export default meta;
type Story = StoryObj<typeof meta>;

function Live({ tone, size }: { tone: Tone; size: 'sm' | 'md' }) {
  const [on, setOn] = useState(true);
  return <Switch checked={on} onChange={setOn} tone={tone} size={size} aria-label={tone} />;
}

export const Playground: Story = {};

/** On / off / disabled, both sizes. */
export const States: Story = {
  render: () => (
    <Row gap={20}>
      <Switch checked={false} onChange={() => undefined} aria-label="off" />
      <Switch checked onChange={() => undefined} aria-label="on" />
      <Switch checked={false} disabled onChange={() => undefined} aria-label="disabled off" />
      <Switch checked disabled onChange={() => undefined} aria-label="disabled on" />
      <Switch checked size="sm" onChange={() => undefined} aria-label="small on" />
      <Switch checked={false} size="sm" onChange={() => undefined} aria-label="small off" />
    </Row>
  ),
};

/** Interactive, one per family. */
export const Tones: Story = {
  render: () => (
    <Row gap={20}>
      {(['accent', 'rest', 'active', 'illness', 'injury', 'sleep', 'sport'] as Tone[]).map((t) => (
        <Live key={t} tone={t} size="md" />
      ))}
    </Row>
  ),
};
