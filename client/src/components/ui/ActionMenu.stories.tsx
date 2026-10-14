import type { Meta, StoryObj } from '@storybook/react-vite';
import { ActionMenu } from './ActionMenu';

const ITEMS = [
  { id: 'msg', label: 'Message Oleh', icon: 'envelope', onSelect: () => undefined },
  { id: 'ask', label: 'Ask Oleh to share more', icon: 'key', onSelect: () => undefined },
  { id: 'res', label: 'Request reschedule', icon: 'calendar-blank', onSelect: () => undefined },
  { id: 'sch', label: 'Schedule sessions', icon: 'calendar-plus', onSelect: () => undefined },
  { id: 'edit', label: 'Edit program', icon: 'pencil-simple', onSelect: () => undefined },
];

const meta = {
  title: 'Coach/Action menu',
  component: ActionMenu,
  parameters: { layout: 'padded' },
  args: {
    label: 'More actions',
    items: ITEMS,
    note: 'Reads are logged and visible to the client.',
  },
  decorators: [
    (S) => (
      <div style={{ minHeight: 360, display: 'flex', justifyContent: 'flex-end' }}>
        <S />
      </div>
    ),
  ],
} satisfies Meta<typeof ActionMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};
/** The client360-header-menu state. */
export const Open: Story = { args: { defaultOpen: true } };
/** Phone header: Message lives in the menu, an unread dot sits on the button. */
export const WithUnreadDot: Story = { args: { dot: true, dotLabel: '3 unread' } };
