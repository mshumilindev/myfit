import type { Meta, StoryObj } from '@storybook/react-vite';
import { ShortcutTile } from './ShortcutTile';
import { TONES } from './tones';
import { Row } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/ShortcutTile',
  component: ShortcutTile,
  args: { label: 'Run', icon: 'person-simple-run', tone: 'active', state: 'default' },
  argTypes: {
    tone: { control: 'select', options: TONES },
    state: { control: 'inline-radio', options: ['default', 'live', 'done', 'selected'] },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 84 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ShortcutTile>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** All four states + the primary "today's day" tile. */
export const States: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 'auto' }}>
        <Story />
      </div>
    ),
  ],
  render: () => (
    <Row>
      {(
        [
          ['default', undefined],
          ['live', '24:10'],
          ['done', undefined],
          ['selected', undefined],
        ] as const
      ).map(([state, meta]) => (
        <div key={state} style={{ width: 84 }}>
          <ShortcutTile
            label="Run"
            icon="person-simple-run"
            tone="active"
            state={state}
            meta={meta}
          />
        </div>
      ))}
      <div style={{ width: 84 }}>
        <ShortcutTile label="Today’s day" icon="play" primary />
      </div>
    </Row>
  ),
};

/** Tones across action families. */
export const Tones: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 'auto' }}>
        <Story />
      </div>
    ),
  ],
  render: () => (
    <Row>
      {TONES.map((tone) => (
        <div key={tone} style={{ width: 84 }}>
          <ShortcutTile label={tone} icon="heartbeat" tone={tone} />
        </div>
      ))}
    </Row>
  ),
};

/** Long labels clamp to two lines. */
export const LongLabel: Story = {
  args: { label: 'Stair climber machine session', icon: 'stairs' },
};
