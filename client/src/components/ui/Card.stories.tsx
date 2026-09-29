import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card, type CardEmphasis, type CardTone } from './Card';
import { Stack } from '../../stories/LocaleMatrix';

const TONES: CardTone[] = [
  'neutral',
  'danger',
  'ok',
  'rest',
  'accent',
  'active',
  'illness',
  'injury',
  'sleep',
  'sport',
  'kcal',
  'apex',
  'learn',
  'atlas',
];
const EMPHASIS: CardEmphasis[] = ['hero', 'glass', 'card', 'quiet'];

const meta = {
  title: 'Kit/Card',
  component: Card,
  args: { tone: 'neutral', pad: 'md', header: 'Card header', children: 'Body text on the card.' },
  argTypes: {
    tone: { control: 'select', options: TONES },
    emphasis: { control: 'select', options: EMPHASIS },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 358 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Card>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Every tone. */
export const Tones: Story = {
  render: () => (
    <Stack>
      {TONES.map((tone) => (
        <Card key={tone} tone={tone} header={tone}>
          Body text on the {tone} tone.
        </Card>
      ))}
    </Stack>
  ),
};

/** Emphasis levels: one hero per screen, a glass or two, ordinary cards, quiet rows. */
export const Emphasis: Story = {
  render: () => (
    <Stack>
      {EMPHASIS.map((e) => (
        <Card key={e} emphasis={e} header={e}>
          {e === 'hero'
            ? 'The focal block: big numbers, the primary action.'
            : e === 'quiet'
              ? 'No chrome — secondary info the app keeps compact.'
              : 'Body text.'}
        </Card>
      ))}
    </Stack>
  ),
};

/** Paddings, no header, long text. */
export const PaddingAndContent: Story = {
  render: () => (
    <Stack>
      <Card pad="sm">Small padding</Card>
      <Card pad="md">Medium padding</Card>
      <Card pad="lg">Large padding</Card>
      <Card header="A long header that wraps onto a second line on a phone-width card">
        Wszystkie ćwiczenia z ostatnich czterech tygodni, posortowane według objętości i
        intensywności.
      </Card>
    </Stack>
  ),
};
