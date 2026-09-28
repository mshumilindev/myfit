import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { PinToggle } from './PinToggle';
import { LocaleMatrix, Row, Stack } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/PinToggle',
  component: PinToggle,
  args: { pinned: false, onToggle: () => undefined, label: 'Pin Tennis' },
} satisfies Meta<typeof PinToggle>;
export default meta;
type Story = StoryObj<typeof meta>;

function Live({ variant }: { variant: 'icon' | 'boxed' | 'row' }) {
  const [on, setOn] = useState(false);
  return (
    <PinToggle
      variant={variant}
      pinned={on}
      onToggle={() => setOn(!on)}
      label={on ? 'Unpin Tennis' : 'Pin Tennis'}
      text={on ? 'Pinned to top of Log activity' : 'Pin to top of Log activity'}
      tone="sport"
    />
  );
}

export const Playground: Story = {};

/** Icon, boxed (card corner) and row variants — off and on. */
export const Variants: Story = {
  render: () => (
    <Stack width={320}>
      <Row>
        <PinToggle pinned={false} onToggle={() => undefined} label="Pin" />
        <PinToggle pinned onToggle={() => undefined} label="Unpin" />
        <PinToggle variant="boxed" pinned={false} onToggle={() => undefined} label="Pin" />
        <PinToggle variant="boxed" pinned onToggle={() => undefined} label="Unpin" />
        <PinToggle variant="boxed" tone="rest" pinned onToggle={() => undefined} label="Unpin" />
      </Row>
      <PinToggle
        variant="row"
        pinned={false}
        onToggle={() => undefined}
        label="Pin"
        text="Pin to top of Log activity"
      />
      <PinToggle
        variant="row"
        pinned
        onToggle={() => undefined}
        label="Unpin"
        text="Pinned to top of Log activity"
      />
    </Stack>
  ),
};

/** Interactive. */
export const Interactive: Story = {
  render: () => (
    <Stack width={320}>
      <Row>
        <Live variant="icon" />
        <Live variant="boxed" />
      </Row>
      <Live variant="row" />
    </Stack>
  ),
};

/** Row text in five locales. */
export const LongText: Story = {
  render: () => (
    <LocaleMatrix
      width={320}
      render={(t) => (
        <PinToggle
          variant="row"
          pinned
          onToggle={() => undefined}
          label={t.laPinnedToTop}
          text={t.laPinnedToTop}
        />
      )}
    />
  ),
};
