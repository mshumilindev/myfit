import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SecurityCode, type SecurityCodeLabels } from './SecurityCode';

const labels: SecurityCodeLabels = {
  groupsAria: (c) => `Security code: ${c}`,
  copy: 'Copy code',
  copied: 'Copied',
  verified: 'Verified',
  notVerified: 'Not verified yet',
  verify: 'I verified this code',
  unverify: 'Mark as not verified',
};
const CODE = '0412 9981 3307 5528 1046 7790';

const meta = {
  title: 'Coach/Security code',
  component: SecurityCode,
  parameters: { layout: 'padded' },
  args: { code: CODE, verified: false, labels },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SecurityCode>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NotVerified: Story = { args: { onVerify: () => undefined } };
export const Verified: Story = { args: { verified: true, onUnverify: () => undefined } };
export const ReadOnly: Story = {};
function InteractiveDemo(a: React.ComponentProps<typeof SecurityCode>) {
  const [v, setV] = useState(false);
  return (
    <SecurityCode
      {...a}
      verified={v}
      onVerify={() => setV(true)}
      onUnverify={() => setV(false)}
      writeText={async () => undefined}
    />
  );
}
export const Interactive: Story = { render: (a) => <InteractiveDemo {...a} /> };
