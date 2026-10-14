import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from './Button';
import { ErrorBoundary } from './ErrorBoundary';
import { Stack } from '../../stories/LocaleMatrix';

function Broken(): never {
  throw new Error('story: this screen failed to render');
}

function Demo() {
  const [boom, setBoom] = useState(false);
  return (
    <Stack>
      <Button variant="secondary" onClick={() => setBoom((b) => !b)}>
        {boom ? 'Fix the screen' : 'Break the screen'}
      </Button>
      <ErrorBoundary
        title="This screen did not open"
        body="Nothing was changed. The rest of the app still works."
        retryLabel="Try again"
        resetKey={String(boom)}
      >
        {boom ? <Broken /> : <p>The screen renders normally.</p>}
      </ErrorBoundary>
    </Stack>
  );
}

const meta = {
  title: 'Coach/ErrorBoundary',
  component: ErrorBoundary,
  args: { title: 'This screen did not open', children: null },
  decorators: [
    (Story) => (
      <div style={{ width: 358 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ErrorBoundary>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A caught render error becomes a calm card; changing `resetKey` (a route change) clears it. */
export const BreakAndFix: Story = { render: () => <Demo /> };

export const Caught: Story = {
  render: () => (
    <ErrorBoundary
      title="This screen did not open"
      body="Nothing was changed. The rest of the app still works."
      retryLabel="Try again"
      icon="cloud-slash"
    >
      <Broken />
    </ErrorBoundary>
  ),
};
