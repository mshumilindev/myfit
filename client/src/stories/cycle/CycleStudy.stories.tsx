import type { Meta, StoryObj } from '@storybook/react-vite';
import * as S from './CycleStudy';
import { PageFrame } from '../PageFrame';

const meta = {
  title: 'Studies/Cycle',
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <PageFrame>
        <Story />
      </PageFrame>
    ),
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
const mk = (C: () => React.ReactElement): Story => ({ render: () => <C /> });
export const LifestyleOff = mk(S.LifestyleOff);
export const LifestyleOn = mk(S.LifestyleOn);
export const Setup = mk(S.Setup);
export const HubRegular = mk(S.HubRegular);
export const HubIrregular = mk(S.HubIrregular);
export const HubLogOnly = mk(S.HubLogOnly);
export const HubStale = mk(S.HubStale);
export const SuppressedPregnancy = mk(S.SuppressedPregnancy);
export const SuppressedMenopause = mk(S.SuppressedMenopause);
export const MarkPregnancy = mk(S.MarkPregnancy);
export const MarkMenopause = mk(S.MarkMenopause);
export const ConditionsAfter = mk(S.ConditionsAfter);
export const Patterns = mk(S.Patterns);
export const PatternsNotEnough = mk(S.PatternsNotEnough);
export const Surfaces = mk(S.Surfaces);
