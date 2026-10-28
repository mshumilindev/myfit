import type { Meta, StoryObj } from '@storybook/react-vite';
import { OnboardingThemeStep } from './OnboardingThemeStep';
import { PageFrame } from '../stories/PageFrame';
import { seedPage } from '../stories/fixtures';

/**
 * Onboarding step 5 of 5 (SPO-355): the real step inside the onboarding shell, with the rail as the other steps
 * draw it. The theme cards are the Themes page's own (ThemeCard).
 */
const rail = (
  <div className="onb-steptop">
    <div className="onb-rail" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="bar on" />
      ))}
    </div>
    <div className="row">
      <span className="k">Step 5 of 5</span>
      <span className="k right">Look</span>
    </div>
  </div>
);

const meta = {
  title: 'Pages/Onboarding look step',
  component: OnboardingThemeStep,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <PageFrame>
        <div className="onb-shell">
          <Story />
        </div>
      </PageFrame>
    ),
  ],
  loaders: [
    () => {
      seedPage();
      return {};
    },
  ],
} satisfies Meta<typeof OnboardingThemeStep>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { rail, onContinue: () => undefined } };
