import type { Meta, StoryObj } from '@storybook/react-vite';
import { Hint } from './Hint';
import { Stack } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/Hint',
  component: Hint,
  args: { children: 'These readings include your recent alcohol use.' },
} satisfies Meta<typeof Hint>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Both lines, plus a long sentence that must wrap, never clip. */
export const Variants: Story = {
  render: () => (
    <Stack>
      <Hint>A quiet note under a lens.</Hint>
      <Hint variant="field">The hint line beside a field in an editor.</Hint>
      <Hint>
        A much longer sentence that has to wrap onto several lines on a narrow phone without being
        clipped or pushing the page sideways, whatever the language is.
      </Hint>
    </Stack>
  ),
};
