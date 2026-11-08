import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../components/ui/Button';
import { IconTile } from '../components/ui/IconTile';
import { OptionCard, OptionCardGrid } from '../components/ui/OptionCard';
import { Sheet } from '../components/ui/Overlays';
import { Icon } from '../ui';
import { PageFrame } from '../stories/PageFrame';
import { seedPage, storyShell } from '../stories/fixtures';
import { useStore } from '../store';
import { TodayView } from './TodayView';
import { inviteDraft } from '../components/MakeItYoursInvite';
import { ItemPage } from '../addonStore/ItemPage';
import { useAddonStoreT } from '../i18n/addonStore';
import { useEnabledAddons } from '../addons/enabledSet';
import { useQueuedAddons } from '../addons/queue';
import { ItemAction, type StoreCtx } from '../addonStore/storeItems';
import { addonById } from '../addons/manifest';
import '../store-kit/tokens.css';
import '../store-kit/base.css';

/** DESIGN ONLY (SPO-500 I5, round 3): one question → a ready set; "What's inside" opens the real store page in a sheet; Look moves to Today. */
const rail = (
  <div className="onb-steptop">
    <div className="onb-rail" aria-hidden>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <span key={i} className={`bar${i <= 5 ? ' on' : ''}`} />
      ))}
    </div>
    <div className="row">
      <span className="k">Step 5 of 6</span>
      <span className="k right">Make it yours</span>
    </div>
  </div>
);

type Pack = {
  id: string;
  icon: string;
  tone: number;
  title: string;
  sub: string;
  inside: string;
  item: string;
};
const MEMBER: Pack[] = [
  {
    id: 'train',
    icon: 'barbell',
    tone: 1,
    title: 'Just train',
    sub: 'Recommended · nothing extra',
    inside: 'Gym is all you need',
    item: 'sleep',
  },
  {
    id: 'recover',
    icon: 'moon',
    tone: 2,
    title: 'Train and recover',
    sub: 'Sleep, Health',
    inside: 'Sleep · Health',
    item: 'sleep',
  },
  {
    id: 'goal',
    icon: 'target',
    tone: 5,
    title: 'Chase a goal',
    sub: 'Goals, Sleep',
    inside: 'Goals · Sleep',
    item: 'goals',
  },
];
const TRAINER: Pack[] = [
  {
    id: 'coach',
    icon: 'users',
    tone: 6,
    title: 'Coach my clients',
    sub: 'Recommended · Gym, Live, Notes',
    inside: 'Gym · Live · Notes',
    item: 'coach-live',
  },
  {
    id: 'both',
    icon: 'barbell',
    tone: 1,
    title: 'Coach and train myself',
    sub: 'Gym, Live, Notes, Sleep',
    inside: 'Gym · Live · Notes · Sleep',
    item: 'coach-live',
  },
  {
    id: 'min',
    icon: 'clipboard-text',
    tone: 3,
    title: 'Just the basics',
    sub: 'Nothing extra for now',
    inside: 'You can add more later',
    item: 'coach-live',
  },
];

function Cards({ packs }: { packs: Pack[] }) {
  const [sel, setSel] = useState(packs[0].id);
  const cur = packs.find((p) => p.id === sel)!;
  return (
    <>
      <OptionCardGrid columns={1} label="What do you need">
        {packs.map((p) => (
          <OptionCard
            key={p.id}
            icon={<IconTile icon={p.icon} tone={p.tone as never} size={40} />}
            title={p.title}
            sub={p.sub}
            selected={sel === p.id}
            onSelect={() => setSel(p.id)}
          />
        ))}
      </OptionCardGrid>
      <Button variant="link" className="onb-inside">
        What's inside: {cur.inside} <Icon name="caret-right" />
      </Button>
    </>
  );
}

function Step({ role }: { role: 'member' | 'trainer' }) {
  return (
    <div className="onb-card">
      {rail}
      <h2 className="display sm">
        {role === 'trainer' ? 'How will you use Spotter?' : 'What do you need?'}
      </h2>
      <p className="lead">We'll set it up. You can change it any time.</p>
      <Cards packs={role === 'trainer' ? TRAINER : MEMBER} />
      <Button variant="primary" size="lg">
        Continue <Icon name="arrow-right" />
      </Button>
      <Button variant="link">Skip for now</Button>
    </div>
  );
}

function PreviewOverOnboarding() {
  const { st } = useAddonStoreT();
  const enabled = useEnabledAddons();
  const queued = useQueuedAddons();
  const ctx: StoreCtx = useMemo(
    () => ({ st, enabled, queued, online: true, open: () => undefined }),
    [st, enabled, queued],
  );
  return (
    <>
      <div className="onb-shell">
        <Step role="member" />
      </div>
      <Sheet onClose={() => undefined} label="Sleep" padded>
        <div className="sk-root sk-dark">
          <ItemPage id="sleep" ctx={ctx} go={() => undefined} />
          <div className="sk-mt16">
            <ItemAction m={addonById('sleep')!} ctx={ctx} lead />
          </div>
        </div>
      </Sheet>
    </>
  );
}

function TodayWithInvite() {
  const store = useStore();
  return <TodayView shell={storyShell} store={store} />;
}

const meta = {
  title: 'Design/Onboarding goal step',
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <PageFrame>
        <Story />
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
const shell = (n: React.ReactNode) => <div className="onb-shell">{n}</div>;
export const Member: S = { render: () => shell(<Step role="member" />) };
export const Trainer: S = { render: () => shell(<Step role="trainer" />) };
export const WhatsInside: S = { render: () => <PreviewOverOnboarding /> };
export const TodayInvite: S = {
  render: () => <TodayWithInvite />,
  loaders: [
    () => {
      seedPage();
      inviteDraft.shown = true;
      return {};
    },
  ],
};
