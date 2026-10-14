import type { Meta, StoryObj } from '@storybook/react-vite';
import { ShareCard, ShareCardPhoto } from './ShareCard';

const meta = {
  title: 'Coach/Share card',
  component: ShareCard,
  parameters: { layout: 'padded' },
  args: {
    state: 'ok',
    typeIcon: 'clipboard-text',
    typeLabel: 'Program',
    title: 'Upper / Lower, 4 days',
    subtitle: '8 weeks · 4 days a week',
    chips: ['Chest', 'Back', 'Legs'],
    media: <ShareCardPhoto icon="clipboard-text" />,
    rows: [
      { name: 'Bench press', meta: '4 x 8 · 70 kg' },
      { name: 'Barbell row', meta: '4 x 8 · 60 kg' },
      { name: 'Plank', meta: 'Just the exercise' },
    ],
    facts: [
      { label: 'Version', value: 'v3' },
      { label: 'Exercises', value: '12' },
    ],
    caption: 'Updates with the program',
    openLabel: 'Open in Programs',
    ariaLabel: 'Program: Upper / Lower, 4 days. Open in Programs',
    onOpen: () => undefined,
  },
} satisfies Meta<typeof ShareCard>;
export default meta;
type Story = StoryObj<typeof meta>;

/** One bordered panel, one fixed width, the whole card is the link. */
export const Playground: Story = {};
export const WithTag: Story = { args: { tag: { icon: 'user-circle', label: 'With trainer' } } };
export const Limited: Story = {
  args: {
    state: 'limited',
    tag: { icon: 'lock-simple', label: 'Totals only' },
    rows: undefined,
    chips: ['Bench press', 'Row', 'Squat'],
    limitedText: 'Oleh shares totals only. Sets and weights are hidden.',
  },
};
export const Locked: Story = {
  args: {
    state: 'locked',
    deadTag: 'Locked',
    typeLabel: 'Workout day',
    reason: 'Oleh has not shared workout totals. Ask Oleh to turn it on.',
    onOpen: undefined,
    ariaLabel: 'Workout day: locked',
  },
};
export const Removed: Story = {
  args: {
    state: 'removed',
    deadTag: 'Removed',
    title: 'This day was removed',
    reason: 'It is no longer in the history.',
    onOpen: undefined,
  },
};
export const Loading: Story = { args: { state: 'loading', loadingLabel: 'Loading preview...' } };
export const Dock: Story = { args: { density: 'dock' } };
export const Peek: Story = { args: { density: 'peek' } };
