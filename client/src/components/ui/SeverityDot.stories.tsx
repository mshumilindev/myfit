import type { Meta, StoryObj } from '@storybook/react-vite';
import { SeverityDot } from './SeverityDot';

const meta = {
  title: 'Coach/SeverityDot',
  component: SeverityDot,
  args: { children: 'Urgent', tone: 'danger' },
} satisfies Meta<typeof SeverityDot>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Urgent: Story = {};
export const All: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SeverityDot tone="danger">Urgent</SeverityDot>
      <SeverityDot tone="illness">Watch</SeverityDot>
      <SeverityDot tone="ok">Good</SeverityDot>
      <SeverityDot tone="ok">Improved</SeverityDot>
      <SeverityDot tone="neutral">No clear change</SeverityDot>
      <SeverityDot tone="danger">Declined</SeverityDot>
      <SeverityDot tone="illness">Measuring</SeverityDot>
    </div>
  ),
};
