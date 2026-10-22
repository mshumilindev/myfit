import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { DocReader } from './DocReader';

const para = (n: number) => (
  <p key={n}>
    Section {n}. Spotter processes the data you enter to run your training log. You can read here
    what is collected, why, and for how long, and how to withdraw a consent at any time.
  </p>
);
const docs = [
  {
    id: 'terms',
    label: 'Terms of Use',
    body: <>{Array.from({ length: 24 }, (_, i) => para(i + 1))}</>,
  },
  {
    id: 'privacy',
    label: 'Privacy Policy',
    body: <>{Array.from({ length: 30 }, (_, i) => para(i + 1))}</>,
  },
  { id: 'short', label: 'A short notice', body: <p>Fits without scrolling: read when shown.</p> },
];

const meta = {
  title: 'Kit/DocReader',
  component: DocReader,
  args: {
    docs,
    read: {},
    onRead: () => undefined,
    readLabel: 'Read',
    unreadLabel: 'Scroll to the end',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 358 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DocReader>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Unread: Story = {};

export const OneRead: Story = { args: { read: { terms: true } } };

/** Live: scroll a document to its end and it turns green. */
function TrackingDemo(args: React.ComponentProps<typeof DocReader>) {
  const [read, setRead] = useState<Record<string, boolean>>({});
  return (
    <DocReader {...args} read={read} onRead={(id) => setRead((r) => ({ ...r, [id]: true }))} />
  );
}

export const Tracking: Story = {
  render: (args) => <TrackingDemo {...args} />,
};
