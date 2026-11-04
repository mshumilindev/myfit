import type { Meta, StoryObj } from '@storybook/react-vite';
import { DeviceImage } from './DeviceImage';
import { ListPanel, ListRow } from './GroupedList';
import { Row } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/DeviceImage',
  component: DeviceImage,
  args: { kind: 'phone', size: 44 },
  argTypes: {
    kind: { control: 'select', options: ['phone', 'tablet', 'computer', 'unknown'] },
    tone: { control: 'select', options: ['neutral', 'ok', 'danger'] },
    size: { control: 'select', options: [32, 44, 56] },
  },
} satisfies Meta<typeof DeviceImage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Kinds: Story = {
  render: () => (
    <Row>
      {(['phone', 'tablet', 'computer', 'unknown'] as const).map((k) => (
        <DeviceImage key={k} kind={k} />
      ))}
    </Row>
  ),
};

export const SizesAndTones: Story = {
  render: () => (
    <Row>
      <DeviceImage kind="phone" size={32} />
      <DeviceImage kind="phone" size={44} />
      <DeviceImage kind="phone" size={56} />
      <DeviceImage kind="phone" tone="ok" />
      <DeviceImage kind="computer" tone="danger" />
    </Row>
  ),
};

/** In a row with a long name (the row, not the image, truncates). */
export const InRows: Story = {
  render: () => (
    <ListPanel>
      <ListRow
        icon={<DeviceImage kind="phone" tone="ok" />}
        label="iPhone 18 Pro Max"
        sub="Wroclaw, PL · now"
      />
      <ListRow
        icon={<DeviceImage kind="computer" />}
        label="Chrome · Windows 11 on a very long device name that must not break the row"
        sub="Berlin, DE · 2 min ago"
      />
      <ListRow icon={<DeviceImage kind="unknown" />} label="Unknown device" sub="2 days ago" />
    </ListPanel>
  ),
};
