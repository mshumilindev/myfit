import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  ConsentChips,
  ConsentLevelPicker,
  type ConsentItem,
  type ConsentLevelId,
} from './ConsentControls';
import { Button } from './Button';

const LABELS: Record<ConsentLevelId, string> = {
  off: 'Off',
  effects: 'Effects only',
  full: 'Full',
};
const SHOWN: Record<ConsentLevelId, string> = {
  off: 'Not shared',
  effects: 'Effects only',
  full: 'Full',
};
const CATS = [
  ['totals', 'Workout totals', 'Sessions, duration, total volume'],
  ['sets', 'Sets and weights', 'Every set: exercise, weight, reps, RPE'],
  ['body', 'Body weight', 'Weight and measurements, no photos'],
  ['sleep', 'Sleep', 'Hours and quality per night'],
  ['injury', 'Injuries', 'Restrictions they declared'],
  ['nutrition', 'Nutrition', 'Calories and macros'],
  ['checkins', 'Check-in answers', 'Their replies to your questions'],
] as const;
const LV: Record<string, ConsentLevelId> = {
  totals: 'full',
  sets: 'full',
  body: 'off',
  sleep: 'effects',
  injury: 'effects',
  nutrition: 'off',
  checkins: 'full',
};

const items = (lv: Record<string, ConsentLevelId>): ConsentItem[] =>
  CATS.map(([id, label, what]) => ({
    id,
    label,
    level: lv[id],
    levelLabel: SHOWN[lv[id]],
    what: lv[id] === 'off' ? 'Oleh has not shared this' : what,
  }));

const meta = {
  title: 'Coach/Consent',
  component: ConsentChips,
  parameters: { layout: 'padded' },
  args: { items: items(LV), label: 'Shared categories' },
} satisfies Meta<typeof ConsentChips>;
export default meta;
type Story = StoryObj<typeof meta>;

/** "What Oleh shares": check = shared at that level, lock = nothing shown. */
export const Shares: Story = {
  render: (a) => (
    <div style={{ maxWidth: 380 }}>
      <ConsentChips
        {...a}
        action={
          <Button variant="secondary" size="sm" icon="key">
            Ask Oleh to share 2 more
          </Button>
        }
      />
    </div>
  ),
};

export const NothingShared: Story = {
  render: () => (
    <div style={{ maxWidth: 380 }}>
      <ConsentChips
        label="Shared categories"
        items={items(Object.fromEntries(CATS.map(([id]) => [id, 'off'])))}
      />
    </div>
  ),
};

/** Off / Effects only / Full per category (the invite request; later the sharing editor). */
export const Picker: Story = {
  render: function Render() {
    const [v, setV] = useState(LV);
    return (
      <div style={{ maxWidth: 560 }}>
        <ConsentLevelPicker
          legend="What you would like the client to share"
          levelLabels={LABELS}
          rows={CATS.map(([id, label, what]) => ({ id, label, what, value: v[id] }))}
          onChange={(id, lv) => setV({ ...v, [id]: lv })}
        />
      </div>
    );
  },
};

/** A trainer's request (SPO-99): the asked rows carry the accent bar, alcohol has no Full, a health row waits for consent. */
export const PickerAsked: Story = {
  render: function Render() {
    const [v, setV] = useState<Record<string, ConsentLevelId>>({});
    return (
      <div style={{ maxWidth: 560 }}>
        <ConsentLevelPicker
          legend="Body"
          levelLabels={LABELS}
          rows={[
            {
              id: 'sleep',
              label: 'Sleep',
              what: 'How long and how well you sleep',
              value: v.sleep ?? 'off',
              highlight: true,
            },
            {
              id: 'alcohol',
              label: 'Alcohol',
              what: 'Whether you drank, never amounts',
              value: v.alcohol ?? 'off',
              highlight: true,
              levels: ['off', 'effects'],
            },
            {
              id: 'nutrition',
              label: 'Nutrition',
              what: 'Needs your health-data consent first',
              value: 'off',
              highlight: true,
              blocked: true,
            },
          ]}
          onChange={(id, lv) => setV({ ...v, [id]: lv })}
        />
      </div>
    );
  },
};
