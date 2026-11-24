import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { LoadField, type LoadFieldLabels } from './LoadField';

const LABELS: LoadFieldLabels = {
  type: 'Load in',
  kg: 'kg',
  pct: '% of max',
  weight: 'Weight',
  percent: '% of max',
  unitKg: 'kg',
  unitPct: '%',
};

const meta = {
  title: 'Kit/LoadField',
  component: LoadField,
  args: {
    mode: 'kg',
    onMode: () => undefined,
    kg: 80,
    onKg: () => undefined,
    pct: 75,
    onPct: () => undefined,
    labels: LABELS,
  },
} satisfies Meta<typeof LoadField>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Kilograms: Story = {};

/** A percent of the person's max, with what it comes to. */
export const Percent: Story = {
  args: { mode: 'pct', hint: 'Max 140 kg → 105 kg' },
};

/** No max yet: the hint warns and offers the way to set one. */
export const NoMax: Story = {
  args: {
    mode: 'pct',
    hint: 'No max yet.',
    hintWarn: true,
    hintAction: { label: 'Set a max', onClick: () => undefined },
  },
};

export const Disabled: Story = { args: { mode: 'pct', disabled: true } };

function Live() {
  const [mode, setMode] = useState<'kg' | 'pct'>('kg');
  const [kg, setKg] = useState(80);
  const [pct, setPct] = useState(75);
  return (
    <LoadField
      mode={mode}
      onMode={setMode}
      kg={kg}
      onKg={setKg}
      pct={pct}
      onPct={setPct}
      labels={LABELS}
      hint={
        mode === 'pct' ? `Max 140 kg → ${(Math.round((140 * pct) / 25) * 2.5) / 10} kg` : undefined
      }
    />
  );
}
export const Interactive: Story = { render: () => <Live /> };
