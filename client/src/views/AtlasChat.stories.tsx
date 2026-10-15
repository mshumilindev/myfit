import type { Meta, StoryObj } from '@storybook/react-vite';
import { CoachView } from './CoachView';
import { clearChat, pushChat, type ChatMsg } from '../atlas/chatLog';
import { __getStateForTests, __replaceStateForTests } from '../store';
import type { Temper } from '../atlas/types';
import { PageFrame } from '../stories/PageFrame';

/**
 * Atlas's chat (SPO-115 / SPO-120): the same ChatPage / ChatShell / ChatComposer frame the trainer's and the client's chat
 * use. Only the colour (the temper) differs, so the gutters, the composer room and the message width must match the
 * other two chats at every width. The geometry audit (`npm run audit:chat`) measures these stories.
 */
const meta = {
  title: 'Pages/Atlas chat',
  component: CoachView,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <PageFrame>
        <Story />
      </PageFrame>
    ),
  ],
  args: { onClose: () => undefined },
} satisfies Meta<typeof CoachView>;
export default meta;
type Story = StoryObj<typeof meta>;

const NOW = Date.now();
const msg = (
  i: number,
  from: ChatMsg['from'],
  text: string,
  extra: Partial<ChatMsg> = {},
): ChatMsg => ({
  id: `story-${i}`,
  at: NOW - (20 - i) * 60_000,
  from,
  text,
  ...extra,
});

const CHIPS = [
  'What should I train today?',
  'How is my Incline Dumbbell Press going?',
  'How was my week?',
  'Why is my bench stuck?',
  'Should I deload next week?',
];

const thread = (chips: string[]): ChatMsg[] => [
  msg(
    1,
    'atlas',
    "Oh, you found the chat. I've seen all 31 of your workouts. All of them. Let's talk.",
    {
      hello: true,
      chips,
    },
  ),
  msg(2, 'me', 'What should I train today?'),
  msg(
    3,
    'atlas',
    'Last 7 days: Chest 27, Calves 0. Only training the fun stuff? Very grown-up. Pick legs today and stop negotiating with yourself about it, because the squat rack has been waiting.',
  ),
  msg(
    4,
    'me',
    'Supercalifragilisticexpialidocious-and-a-very-long-unbreakable-word-that-must-wrap-somewhere',
  ),
  msg(5, 'atlas', 'Bodyweight 98.2 kg, −4.2% over 5 weeks.'),
];

const seed =
  (temper: Temper, chips = 3, short = false) =>
  () => {
    __replaceStateForTests({
      ...__getStateForTests(),
      coach: { ...__getStateForTests().coach, enabled: true, temper, startedAt: NOW - 86_400_000 },
    });
    clearChat();
    const msgs = thread(CHIPS.slice(0, chips));
    if (short) msgs[0] = { ...msgs[0], text: 'Hi.' };
    for (const m of msgs) pushChat(m);
  };

/** Merciless (red): the screenshot from SPO-115 / SPO-120. */
export const Merciless: Story = { beforeEach: seed(5) };
/** Blunt (yellow). */
export const Blunt: Story = { beforeEach: seed(3) };
/** Warm (green). */
export const Warm: Story = { beforeEach: seed(1) };
/** One chip under a short hello. */
export const OneChip: Story = { beforeEach: seed(3, 1, true) };
/** Five chips under the hello: they wrap under the message and never squeeze it. */
export const FiveChips: Story = { beforeEach: seed(3, 5) };
