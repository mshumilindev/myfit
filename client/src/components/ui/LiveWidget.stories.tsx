import type { Meta, StoryObj } from '@storybook/react-vite';
import { LiveWidget, type LiveEntry } from './LiveWidget';

const entries: LiveEntry[] = [
  {
    id: '1',
    name: 'Taras Rudenko',
    status: 'live',
    detail: 'Iron Yard · since 08:51',
    metric: '14 min',
    statusText: 'Training now',
  },
  {
    id: '2',
    name: 'Oksana Myronenko',
    status: 'offline',
    detail: 'Iron Yard · since 08:34',
    metric: '26 min',
    statusText: 'Last seen 3 min ago',
  },
  {
    id: '3',
    name: 'Denys Koval',
    status: 'finished',
    detail: '21 sets · 9.8 t · Iron Yard',
    metric: '1 h 09 min',
    statusText: 'Finished',
  },
];

const meta = {
  title: 'Coach/LiveWidget',
  component: LiveWidget,
  decorators: [
    (Story) => (
      <div style={{ padding: 24, display: 'flex', justifyContent: 'flex-end' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    entries,
    pillLabel: '1 live',
    pillAria: '1 live, open the list',
    title: 'Training now',
    summary: '1 live · 1 offline · 1 finished',
    groupLabels: { live: 'Live now', offline: 'Offline', finished: 'Finished' },
    noneText: 'Nobody is training right now.',
    privacy:
      'You see who is training and for how long. Sets and weights stay with the client until the session ends.',
  },
} satisfies Meta<typeof LiveWidget>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};
export const Open: Story = { args: { defaultOpen: true } };
export const None: Story = {
  args: { entries: [], pillLabel: '0 live', pillAria: '0 live, open the list', summary: '' },
};
export const OnlyOffline: Story = {
  args: { entries: [entries[1]], pillLabel: '0 live', summary: '0 live · 1 offline' },
};
export const OnlyFinished: Story = {
  args: { entries: [entries[2]], pillLabel: '0 live', summary: '0 live · 1 finished' },
};
