import type { Meta, StoryObj } from '@storybook/react-vite';
import { SectionLabel } from './SectionLabel';
import { Button } from './Button';
import { Stack } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/SectionLabel',
  component: SectionLabel,
  args: { children: 'Shortcuts' },
  decorators: [
    (Story) => (
      <div style={{ width: 358 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SectionLabel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Plain, with an action, toned, long text. */
export const Variants: Story = {
  render: () => (
    <Stack>
      <SectionLabel>Body</SectionLabel>
      <SectionLabel
        action={
          <Button variant="ghost" size="sm">
            See all
          </Button>
        }
      >
        History
      </SectionLabel>
      <SectionLabel tone="sleep">Last night</SectionLabel>
      <SectionLabel tone="illness">Unwell · day 3</SectionLabel>
      <SectionLabel>A very long section label that should still fit on one line</SectionLabel>
    </Stack>
  ),
};
