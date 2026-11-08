import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../components/ui/Button';
import { GroupedList, ListRow } from '../components/ui/GroupedList';
import { IconTile } from '../components/ui/IconTile';
import { Switch } from '../components/ui/Switch';
import { Icon } from '../ui';
import { PageFrame } from '../stories/PageFrame';
import { seedPage } from '../stories/fixtures';

/** DESIGN ONLY (SPO-516, I5): the new onboarding step "Make it yours" inside the real onboarding shell. */
const rail = (
  <div className="onb-steptop">
    <div className="onb-rail" aria-hidden>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <span key={i} className={`bar${i <= 5 ? ' on' : ''}`} />
      ))}
    </div>
    <div className="row">
      <span className="k">Step 5 of 6</span>
      <span className="k right">Add-ons</span>
    </div>
  </div>
);

type Item = { id: string; icon: string; tone: number; label: string; sub: string };
const BASE: Item[] = [
  { id: 'sleep', icon: 'moon', tone: 2, label: 'Sleep', sub: 'Bedtime, wake-up and sleep debt' },
  {
    id: 'health',
    icon: 'heartbeat',
    tone: 4,
    label: 'Health',
    sub: 'Injuries, rest days and illness',
  },
  { id: 'goals', icon: 'target', tone: 5, label: 'Goals', sub: 'Targets and progress on Today' },
  {
    id: 'activities',
    icon: 'person-simple-run',
    tone: 9,
    label: 'Activities',
    sub: 'Runs, rides and walks',
  },
];
const COACH: Item[] = [
  {
    id: 'coach-live',
    icon: 'broadcast',
    tone: 6,
    label: 'Live',
    sub: 'See clients train in real time',
  },
  {
    id: 'coach-notes',
    icon: 'note-pencil',
    tone: 3,
    label: 'Notes',
    sub: 'Private notes on each client',
  },
];

function Step({ role }: { role: 'member' | 'trainer' }) {
  const [on, setOn] = useState<Record<string, boolean>>({ sleep: true });
  const rows = (items: Item[]): ReactNode =>
    items.map((it) => (
      <ListRow
        key={it.id}
        as="label"
        icon={<IconTile icon={it.icon} tone={it.tone as never} size={40} />}
        label={it.label}
        sub={it.sub}
        trailing={<Switch checked={!!on[it.id]} onChange={(v) => setOn({ ...on, [it.id]: v })} />}
      />
    ));
  return (
    <div className="onb-card">
      {rail}
      <h2 className="display sm">Make it yours</h2>
      <p className="lead">Start with the essentials. Add more any time in Add-ons.</p>
      <GroupedList header="Add to your app">{rows(BASE)}</GroupedList>
      {role === 'trainer' && <GroupedList header="For coaching">{rows(COACH)}</GroupedList>}
      <div className="footnote center">Your data stays put if you remove an add-on later.</div>
      <Button variant="primary" size="lg">
        Continue <Icon name="arrow-right" />
      </Button>
      <Button variant="link">Skip for now</Button>
    </div>
  );
}

const meta = {
  title: 'Design/Onboarding add-ons step',
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
} satisfies Meta;
export default meta;
type S = StoryObj<typeof meta>;
export const Member: S = { render: () => <Step role="member" /> };
export const Trainer: S = { render: () => <Step role="trainer" /> };
