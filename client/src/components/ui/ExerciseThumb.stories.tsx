import type { Meta, StoryObj } from '@storybook/react-vite';
import { ExerciseThumb } from './ExerciseThumb';
import { Row } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Coach/Exercise thumb',
  component: ExerciseThumb,
  args: { size: 40 },
} satisfies Meta<typeof ExerciseThumb>;
export default meta;
type Story = StoryObj<typeof meta>;

/** No picture (a custom name): the neutral icon tile, never a blank slot. */
export const Placeholder: Story = {};

export const Sizes: Story = {
  render: () => (
    <Row>
      <ExerciseThumb size={32} />
      <ExerciseThumb size={40} />
      <ExerciseThumb size={48} />
    </Row>
  ),
};
