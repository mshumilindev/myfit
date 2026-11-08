import type { Meta, StoryObj } from '@storybook/react-vite';
import { PageFrame } from '../stories/PageFrame';
import { seedPage } from '../stories/fixtures';
import { setRole } from '../api';
import { OnboardingAddonsStep } from './OnboardingAddonsStep';

const rail = (
  <div className="onb-steptop">
    <div className="onb-rail" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="bar on" />
      ))}
    </div>
    <div className="row">
      <span className="k">Step 5 of 5</span>
    </div>
  </div>
);

const meta = {
  title: 'Pages/Onboarding make it yours',
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
} satisfies Meta;
export default meta;
type S = StoryObj<typeof meta>;

export const Member: S = {
  loaders: [() => (seedPage(), setRole('member'), {})],
  render: () => <OnboardingAddonsStep rail={rail} onContinue={() => undefined} />,
};
export const Trainer: S = {
  loaders: [() => (seedPage(), setRole('trainer'), {})],
  render: () => <OnboardingAddonsStep rail={rail} onContinue={() => undefined} />,
};
