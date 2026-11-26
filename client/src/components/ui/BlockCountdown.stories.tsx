import type { Meta, StoryObj } from '@storybook/react-vite';
import { Icon } from '../../ui';
import { BlockCountdown } from './BlockCountdown';
import { Tag } from './Tag';

const meta = {
  title: 'Kit/BlockCountdown',
  component: BlockCountdown,
  parameters: { layout: 'fullscreen' },
  args: {
    n: 5,
    still: true,
    title: '12 min · target 8 rounds',
    goLabel: 'GO',
    hint: 'Get in position',
    cancelLabel: 'Cancel',
    ariaLabel: 'Get ready',
    tag: (
      <Tag tone="conditioning" icon={<Icon name="arrow-clockwise" />}>
        AMRAP
      </Tag>
    ),
    onCancel: () => {},
    onSkip: () => {},
  },
} satisfies Meta<typeof BlockCountdown>;
export default meta;
type Story = StoryObj<typeof meta>;

/** First beat: full ring, neutral colour. */
export const Start: Story = {};
/** The last three seconds: warning colour (and a higher tone from the player). */
export const Warning: Story = { args: { n: 3 } };
export const LastSecond: Story = { args: { n: 1 } };
/** GO: green, the block clock has started. */
export const Go: Story = { args: { n: 0, go: true, hint: 'Clock running' } };
/** Long title and Cancel in a long locale: nothing overflows. */
export const LongTitle: Story = {
  args: {
    n: 4,
    title: 'Co 60 sekund przez 10 minut · 3 ćwiczenia w każdej minucie, zmiana co minutę',
    hint: 'Przygotuj się do startu',
    cancelLabel: 'Anuluj',
  },
};
