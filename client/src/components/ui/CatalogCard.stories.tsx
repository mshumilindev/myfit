import type { Meta, StoryObj } from '@storybook/react-vite';
import { CatalogCard } from './CatalogCard';
import { Stack } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/CatalogCard',
  component: CatalogCard,
  args: {
    who: 'Bill Starr',
    title: 'Three-day 5×5 strength base',
    meta: '3 days · 12 weeks · ~60 min · Beginner',
  },
} satisfies Meta<typeof CatalogCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Default, selected, and locked (needs another add-on: dimmed, still openable). */
export const States: Story = {
  render: (args) => (
    <Stack>
      <CatalogCard {...args} />
      <CatalogCard {...args} selected />
      <CatalogCard
        {...args}
        who="Reg Park"
        title="Barbell and dumbbell course, 1953"
        lockedLabel="Needs Advanced training"
      />
    </Stack>
  ),
};

/** Long author and title wrap inside the card; the facts line wraps too. */
export const LongText: Story = {
  args: {
    who: 'Arnold Schwarzenegger',
    title:
      'Bodybuilding split from the Encyclopedia of Modern Bodybuilding, twelve weeks, six days a week',
    meta: '6 days · 12 weeks · ~90 min · Advanced · Full gym',
    lockedLabel: 'Needs Advanced training',
  },
};
