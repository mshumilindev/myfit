import type { Meta, StoryObj } from '@storybook/react-vite';
import { useMemo } from 'react';
import { ShareCardView } from './ShareCardView';
import { buildShareSource } from './__fixtures__/fixtures';
import { resolveShare } from './resolve';
import {
  loadingView,
  SHARE_KINDS,
  type ShareKind,
  type ShareRef,
  type ShareSource,
  type Viewer,
} from './types';
import './ShareCards.css';

/** The nine cards in the five states (S-16b). Resolved from the fixtures with the same code the chat uses. */
const meta = {
  title: 'Pages/Coach/Share cards',
  parameters: { layout: 'padded' },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const T: Viewer = { side: 'trainer', clientId: 'c1' };
const REF: Record<ShareKind, ShareRef> = {
  program: { kind: 'program', id: 'upper-lower-4x' },
  day: { kind: 'day', id: 'upper-lower-4x:0' },
  exercise: { kind: 'exercise', id: 'Barbell_Bench_Press_-_Medium_Grip' },
  equipment: { kind: 'equipment', id: 'barbell-olympic' },
  gym: { kind: 'gym', id: 'iron-yard' },
  workout: { kind: 'workout', id: 'w1-0', ownerId: 'c1' },
  activity: { kind: 'activity', id: 'c1-a1', ownerId: 'c1' },
  results: { kind: 'results', id: 'ex0', ownerId: 'c1' },
  muscle: { kind: 'muscle', id: 'chest', ownerId: 'c1' },
};
const off = (src: ShareSource, ...cats: ('totals' | 'sets')[]): ShareSource => {
  const c = src.clients.c1;
  const consent = { ...c.consent };
  cats.forEach((k) => (consent[k] = 'off'));
  return { ...src, clients: { ...src.clients, c1: { ...c, consent } } };
};

function Grid({
  kinds,
  state,
}: {
  kinds: readonly ShareKind[];
  state: 'ok' | 'limited' | 'locked' | 'removed' | 'loading';
}) {
  const src = useMemo(() => buildShareSource(), []);
  return (
    <div className="shc-grid">
      {kinds.map((k) => {
        const r = REF[k];
        let v;
        if (state === 'ok') v = resolveShare(r, T, src);
        else if (state === 'loading') v = loadingView(r);
        else if (state === 'removed')
          v = resolveShare({ kind: k, id: 'gone', ownerId: r.ownerId }, T, src);
        else if (state === 'locked')
          v = resolveShare(r, T, off(src, k === 'results' ? 'sets' : 'totals'));
        else v = { ...resolveShare(r, T, off(src, 'sets')), state: 'limited' as const };
        return <ShareCardView key={k} view={v} who="Oleh" onOpen={() => undefined} />;
      })}
    </div>
  );
}

export const Cards: Story = { render: () => <Grid kinds={SHARE_KINDS.slice(0, 5)} state="ok" /> };
export const Cards2: Story = { render: () => <Grid kinds={SHARE_KINDS.slice(5)} state="ok" /> };
export const Limited: Story = {
  render: () => <Grid kinds={['workout', 'results', 'muscle']} state="limited" />,
};
export const Locked: Story = {
  render: () => <Grid kinds={['workout', 'activity', 'results']} state="locked" />,
};
export const Removed: Story = {
  render: () => <Grid kinds={['program', 'exercise', 'workout']} state="removed" />,
};
export const Loading: Story = {
  render: () => <Grid kinds={['program', 'workout', 'activity']} state="loading" />,
};
/** All five states of one card, side by side. */
export const States: Story = {
  render: () => (
    <div className="shc-states">
      {(['ok', 'limited', 'locked', 'removed', 'loading'] as const).map((s) => (
        <Grid key={s} kinds={['workout']} state={s} />
      ))}
    </div>
  ),
};
