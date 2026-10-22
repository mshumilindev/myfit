import type { Meta, StoryObj } from '@storybook/react-vite';
import { FullPage } from './FullPage';
import { Button } from './Button';
import { Stepper } from './Stepper';

const meta = {
  title: 'Kit/FullPage',
  component: FullPage,
  parameters: { layout: 'fullscreen' },
  args: {
    label: 'Terms',
    top: (
      <Stepper
        steps={[
          { id: 'a', label: 'Terms' },
          { id: 'b', label: 'Your choices' },
        ]}
        current={0}
        stepLabel={(n, t) => `Step ${n} of ${t}`}
      />
    ),
    children: (
      <>
        <h2 className="ut-xl ut-w7">A blocking page</h2>
        <p className="ut-base ut-muted">
          Opaque, one column on a phone and a desktop, the app behind it inert, the actions pinned
          to the bottom edge.
        </p>
        {Array.from({ length: 12 }, (_, i) => (
          <p key={i} className="ut-base">
            Content row {i + 1}
          </p>
        ))}
      </>
    ),
    actions: (
      <>
        <Button variant="primary" size="lg">
          Continue
        </Button>
        <Button variant="danger" size="sm" icon="sign-out">
          Sign out
        </Button>
      </>
    ),
  },
} satisfies Meta<typeof FullPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutActions: Story = { args: { actions: undefined } };
