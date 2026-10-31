import type { ReactNode } from 'react';
import base from '../../../.storybook/preview';
import { TrainerSheetHost } from '../TrainerRequestSheet';

// The trainer's request sheet opens over any story when ?ar=trainer-sheet… is in the URL.
const withLab = (Story: () => ReactNode) => (
  <>
    <Story />
    <TrainerSheetHost />
  </>
);
export default { ...base, decorators: [...(base.decorators ?? []), withLab] };
