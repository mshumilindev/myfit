import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkStage } from '../stories/SkStage';
import { SkBtn } from './SkBtn';
import { SkSteps, type SkStep } from './SkSteps';
import './SkSteps.stories.css';

const meta = { title: 'Store/SkSteps', component: SkSteps, args: { items: [] } } satisfies Meta<
  typeof SkSteps
>;
export default meta;
type Story = StoryObj<typeof meta>;

const tile = (letter: string, tone: number) => (
  <span
    className="sk-step-demo-tile"
    style={{ '--sk-demo-bg': `var(--ic-${tone})` } as CSSProperties}
  >
    {letter}
  </span>
);

const installing: SkStep[] = [
  { id: 'h', tile: tile('H', 4), name: 'Health', state: 'done', detail: 'Done' },
  { id: 'i', tile: tile('I', 4), name: 'Injury log', state: 'active', progress: 62 },
  {
    id: 's',
    tile: tile('S', 2),
    name: 'Sleep',
    state: 'pending',
    detail: 'Starts after Injury log',
    status: 'Waiting',
  },
];

/** Board 10: installing. */
export const Installing: Story = {
  render: () => (
    <SkStage width="phone">
      <SkSteps items={installing} label="Installing" />
    </SkStage>
  ),
};

/** Board 11: everything installed. */
export const AllDone: Story = {
  render: () => (
    <SkStage width="phone">
      <SkSteps items={installing.map((s) => ({ ...s, state: 'done' as const, detail: 'Done' }))} />
    </SkStage>
  ),
};

/** Board 16: one failed with a retry action. */
export const Failed: Story = {
  render: () => (
    <SkStage width="phone">
      <SkSteps
        items={[
          { ...installing[0], detail: 'Installed' },
          {
            id: 's',
            tile: tile('S', 2),
            name: 'Sleep',
            state: 'failed',
            detail: 'Could not install. Check your connection.',
            action: (
              <SkBtn kind="pri" size="s">
                Try again
              </SkBtn>
            ),
          },
        ]}
      />
    </SkStage>
  ),
};

/** Long names wrap; failed without an action shows an alert glyph; a single step. */
export const Edge: Story = {
  render: () => (
    <SkStage width="phone">
      <SkSteps
        items={[
          {
            id: 'l',
            tile: tile('N', 7),
            name: 'Nicotine and alcohol check-in with a very long name that wraps',
            state: 'active',
            progress: 5,
          },
          {
            id: 'f',
            tile: tile('F', 0),
            name: 'Failed item',
            state: 'failed',
            detail: 'Try later',
          },
        ]}
      />
      <SkSteps items={[{ id: 'o', name: 'Only one', state: 'pending', status: 'Waiting' }]} />
    </SkStage>
  ),
};
