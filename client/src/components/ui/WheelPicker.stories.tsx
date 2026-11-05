import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { WheelPicker, type WheelPickerProps } from './WheelPicker';
import { Sheet } from './Overlays';
import { Button } from './Button';
import { Row, Stack } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/WheelPicker',
  component: WheelPicker,
  args: {
    label: 'Weight',
    value: 82.5,
    unit: 'kg',
    step: 0.5,
    min: 0,
    max: 300,
    decimals: 1,
    onChange: () => undefined,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 358 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WheelPicker>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

type Variant = Pick<WheelPickerProps, 'input' | 'columns'>;

/** Weight + reps side by side, the way the session set editor lays them out. */
function Pair({ v, size = 'md' }: { v: Variant; size?: 'compact' | 'md' | 'big' }) {
  const [w, setW] = useState(82.5);
  const [r, setR] = useState(8);
  return (
    <Row>
      <WheelPicker
        label="Weight"
        value={w}
        onChange={setW}
        step={0.5}
        min={0}
        max={300}
        decimals={1}
        unit="kg"
        size={size}
        {...v}
      />
      <WheelPicker
        label="Reps"
        value={r}
        onChange={setR}
        step={1}
        min={0}
        max={50}
        size={size}
        input={v.input}
        columns="single"
      />
    </Row>
  );
}

const VARIANTS: Array<[string, Variant, ('compact' | 'md')?]> = [
  ['A1 · wheel + type', { input: 'manual', columns: 'single' }],
  ['A2 · wheel + type + −/+', { input: 'stepper', columns: 'single' }],
  ['A3 · wheel only', { input: 'wheel', columns: 'single' }],
  ['A3 · wheel only, whole | fraction', { input: 'wheel', columns: 'split' }],
  ['N · native system picker (select)', { input: 'native', columns: 'single' }],
  ['A1 · compact (3 rows)', { input: 'manual', columns: 'single' }, 'compact'],
  ['A2 · compact (3 rows)', { input: 'stepper', columns: 'single' }, 'compact'],
];

/** SPO-318 shard: the inline variants (C1) with the session pair. */
export const InlineVariants: Story = {
  render: () => (
    <Stack>
      {VARIANTS.map(([name, v, size]) => (
        <div key={name}>
          <p
            style={{
              margin: '0 0 6px',
              font: '600 11px var(--font)',
              letterSpacing: '0.08em',
              color: 'var(--color-text-faint)',
            }}
          >
            {name}
          </p>
          <Pair v={v} size={size} />
        </div>
      ))}
    </Stack>
  ),
};

/** C2 — one shared bench: weight (whole | fraction) and reps in a single well. */
export const SharedBench: Story = {
  render: function SharedBenchStory() {
    const [w, setW] = useState(82.5);
    const [r, setR] = useState(8);
    return (
      <Row>
        <WheelPicker
          label="Weight"
          value={w}
          onChange={setW}
          step={0.5}
          max={300}
          decimals={1}
          unit="kg"
          input="wheel"
          columns="split"
          size="big"
        />
        <WheelPicker label="Reps" value={r} onChange={setR} max={50} input="wheel" size="big" />
      </Row>
    );
  },
};

/** C3 — tap a field, a drawer with big drums (A1 and the multi-column A3). */
export const InSheet: Story = {
  render: function InSheetStory() {
    const [open, setOpen] = useState(true);
    const [w, setW] = useState(82.5);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Weight · {w} kg</Button>
        {open && (
          <Sheet onClose={() => setOpen(false)} label="Weight" padded>
            <WheelPicker
              label="Weight"
              value={w}
              onChange={setW}
              step={0.5}
              max={300}
              decimals={1}
              unit="kg"
              input="wheel"
              columns="split"
              size="big"
            />
            <Button onClick={() => setOpen(false)}>Done</Button>
          </Sheet>
        )}
      </>
    );
  },
};

export const States: Story = {
  render: () => (
    <Stack>
      <Row>
        <WheelPicker
          label="Weight"
          value={0}
          onChange={() => undefined}
          disabled
          input="manual"
          unit="kg"
        />
        <WheelPicker label="Reps" value={8} onChange={() => undefined} focused input="manual" />
      </Row>
      <Row>
        <WheelPicker
          label="Bodyweight plus"
          value={300}
          onChange={() => undefined}
          max={300}
          input="wheel"
          unit="kg"
        />
        <WheelPicker
          label="Powiększona waga dodatkowa"
          value={5}
          onChange={() => undefined}
          input="wheel"
        />
      </Row>
    </Stack>
  ),
};

/** SPO-318 chosen variant A1: wheel + type; the unit (kg / lbs, from the person's setting) sits right after the weight. */
export const ChosenA1Units: Story = {
  render: function ChosenUnitsStory() {
    const [kg, setKg] = useState(82.5);
    const [lb, setLb] = useState(185);
    const [r, setR] = useState(8);
    return (
      <Stack>
        <Row>
          <WheelPicker
            label="Weight"
            value={kg}
            onChange={setKg}
            step={0.5}
            max={300}
            decimals={1}
            unit="kg"
            input="manual"
            size="compact"
          />
          <WheelPicker
            label="Reps"
            value={r}
            onChange={setR}
            max={50}
            input="manual"
            size="compact"
          />
        </Row>
        <Row>
          <WheelPicker
            label="Weight"
            value={lb}
            onChange={setLb}
            step={5}
            max={660}
            unit="lbs"
            input="manual"
            size="compact"
          />
          <WheelPicker
            label="Reps"
            value={r}
            onChange={setR}
            max={50}
            input="manual"
            size="compact"
          />
        </Row>
      </Stack>
    );
  },
};

/** Design review only (SPO-318): the pair as it sits in the session set editor (60 kg × 8), to drop into the real screen. */
export const SessionPair: Story = {
  render: () => (
    <div data-pair>
      <Row>
        <WheelPicker
          label="Reps"
          value={8}
          onChange={() => undefined}
          max={50}
          input="manual"
          size="compact"
        />
        <WheelPicker
          label="Weight"
          value={60}
          onChange={() => undefined}
          step={0.5}
          max={300}
          decimals={1}
          unit="kg"
          input="manual"
          size="compact"
        />
      </Row>
    </div>
  ),
};
