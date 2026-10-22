import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stepper } from './Stepper';
import { LocaleMatrix, Stack } from '../../stories/LocaleMatrix';

const steps = [
  { id: 'terms', label: 'Terms' },
  { id: 'choices', label: 'Your choices' },
  { id: 'done', label: 'Done' },
];
const word = (n: number, t: number) => `Step ${n} of ${t}`;

const meta = {
  title: 'Kit/Stepper',
  component: Stepper,
  args: { steps, current: 0, stepLabel: word },
  argTypes: { current: { control: { type: 'number', min: 0, max: 2 } } },
  decorators: [
    (Story) => (
      <div style={{ width: 358 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Stepper>;
export default meta;
type Story = StoryObj<typeof meta>;

export const First: Story = {};

/** Finished steps and the current one are filled. */
export const AllSteps: Story = {
  render: (args) => (
    <Stack>
      {steps.map((_, i) => (
        <Stepper key={i} {...args} current={i} />
      ))}
    </Stack>
  ),
};

export const Locales: Story = {
  render: () => (
    <LocaleMatrix
      render={(t) => (
        <Stepper
          steps={[
            { id: 'a', label: t.onbContinue },
            { id: 'b', label: t.close },
          ]}
          current={1}
          stepLabel={word}
        />
      )}
    />
  ),
};
