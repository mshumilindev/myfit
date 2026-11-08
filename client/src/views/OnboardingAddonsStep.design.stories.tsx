import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../components/ui/Button';
import { GroupedList, ListRow } from '../components/ui/GroupedList';
import { IconTile } from '../components/ui/IconTile';
import { SectionLabel } from '../components/ui/SectionLabel';
import { Switch } from '../components/ui/Switch';
import { Icon } from '../ui';
import { THEMES } from '../themes';
import { PageFrame } from '../stories/PageFrame';
import { seedPage } from '../stories/fixtures';
import { ThemeCard } from './ThemeCard';
import './themes.css';

/**
 * DESIGN ONLY (SPO-516, I5/I8): onboarding steps "Add-ons" (5 of 6, by role) and "Look" (6 of 6, own + store).
 * Real onboarding shell; rows are kit GroupedList/ListRow/Switch.
 */
const rail = (n: number, name: string) => (
  <div className="onb-steptop">
    <div className="onb-rail" aria-hidden>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <span key={i} className={`bar${i <= n ? ' on' : ''}`} />
      ))}
    </div>
    <div className="row">
      <span className="k">Step {n} of 6</span>
      <span className="k right">{name}</span>
    </div>
  </div>
);

type Item = {
  id: string;
  icon: string;
  tone: number;
  label: string;
  sub: string;
  needsGym?: boolean;
};
const APEX: Item = {
  id: 'apex',
  icon: 'trophy',
  tone: 8,
  label: 'Apex',
  sub: 'Challenges, ranks and awards',
};
const GYM: Item = {
  id: 'gym',
  icon: 'barbell',
  tone: 1,
  label: 'Gym',
  sub: 'Workouts, sets and training log',
};
const PERSONAL: Item[] = [
  {
    id: 'sleep',
    icon: 'moon',
    tone: 2,
    label: 'Sleep',
    sub: 'Bedtime, wake-up and sleep debt',
    needsGym: true,
  },
  {
    id: 'health',
    icon: 'heartbeat',
    tone: 4,
    label: 'Health',
    sub: 'Injuries, rest days and illness',
    needsGym: true,
  },
  {
    id: 'goals',
    icon: 'target',
    tone: 5,
    label: 'Goals',
    sub: 'Targets and progress on Today',
    needsGym: true,
  },
  {
    id: 'atlas',
    icon: 'sparkle',
    tone: 6,
    label: 'Atlas',
    sub: 'Your AI coach in a chat',
    needsGym: true,
  },
];
const COACH: Item[] = [
  {
    id: 'coach-live',
    icon: 'pulse',
    tone: 6,
    label: 'Live',
    sub: 'See clients train in real time',
  },
  {
    id: 'coach-signals',
    icon: 'bell-ringing',
    tone: 6,
    label: 'Signals',
    sub: 'Who needs your attention today',
  },
  { id: 'coach-notes', icon: 'note', tone: 3, label: 'Notes', sub: 'Private notes on each client' },
  { id: 'coach-team', icon: 'users', tone: 6, label: 'Team', sub: 'Work with other trainers' },
];

function AddonsStep({ role, gymOn = false }: { role: 'member' | 'trainer'; gymOn?: boolean }) {
  const [on, setOn] = useState<Record<string, boolean>>(
    gymOn ? { gym: true, sleep: true } : { sleep: role === 'member' },
  );
  const gym = role === 'member' || !!on.gym;
  const rows = (items: Item[]): ReactNode =>
    items.map((it) => {
      const locked = !!it.needsGym && !gym;
      return (
        <ListRow
          key={it.id}
          as="label"
          dim={locked}
          icon={<IconTile icon={it.icon} tone={it.tone as never} size={40} />}
          label={it.label}
          sub={locked ? 'Needs Gym' : it.sub}
          trailing={
            <Switch
              checked={!!on[it.id] && !locked}
              disabled={locked}
              onChange={(v) => setOn({ ...on, [it.id]: v })}
            />
          }
        />
      );
    });
  return (
    <div className="onb-card">
      {rail(5, 'Add-ons')}
      <h2 className="display sm">Make it yours</h2>
      <p className="lead">
        {role === 'trainer'
          ? 'Pick what you work with. You can change it any time.'
          : 'Start with what you need. You can change it any time.'}
      </p>
      <GroupedList header="Apps">{rows(role === 'trainer' ? [GYM, APEX] : [APEX])}</GroupedList>
      {role === 'trainer' && <GroupedList header="For coaching">{rows(COACH)}</GroupedList>}
      <GroupedList header={role === 'trainer' ? 'For your own training' : 'Add-ons'}>
        {rows(PERSONAL)}
      </GroupedList>
      <div className="footnote center">Your data stays put if you remove one later.</div>
      <Button variant="primary" size="lg">
        Continue <Icon name="arrow-right" />
      </Button>
      <Button variant="link">Skip for now</Button>
    </div>
  );
}

const find = (id: string) => THEMES.find((t) => t.id === id)!;

function LookStep() {
  return (
    <div className="onb-card">
      {rail(6, 'Look')}
      <h2 className="display sm">Pick a look for the app</h2>
      <SectionLabel>Yours</SectionLabel>
      <div className="thm-list">
        <ThemeCard theme={find('glass')} current onApply={() => undefined} />
      </div>
      <SectionLabel>From the store</SectionLabel>
      <div className="thm-list">
        <ThemeCard
          theme={find('cyberpunk')}
          current={false}
          cta="Add and apply · Free"
          onApply={() => undefined}
        />
      </div>
      <div className="footnote center">You can change it any time in Add-ons.</div>
      <Button variant="primary" size="lg">
        Continue <Icon name="arrow-right" />
      </Button>
    </div>
  );
}

const meta = {
  title: 'Design/Onboarding add-ons and look',
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
export const Member: S = { render: () => <AddonsStep role="member" /> };
export const TrainerGymOff: S = { render: () => <AddonsStep role="trainer" /> };
export const TrainerGymOn: S = { render: () => <AddonsStep role="trainer" gymOn /> };
export const Look: S = { render: () => <LookStep /> };
