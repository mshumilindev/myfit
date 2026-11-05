import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TodayView } from './TodayView';
import { useStore } from '../store';
import { PageFrame } from '../stories/PageFrame';
import { Sheet } from '../components/ui/Overlays';
import { SectionLabel } from '../components/ui/SectionLabel';
import { Button } from '../components/ui/Button';
import { seedPage, storyShell } from '../stories/fixtures';
import { ThemePreviewHost } from '../components/ThemeAnnouncement';
import { resetSeenForTest, syncSeenFromDoc } from '../themes/seen';

function TodayViewStory() {
  const store = useStore();
  return <TodayView shell={storyShell} store={store} />;
}

/** The Today screen with a few weeks of seeded training data. */
const meta = {
  title: 'Pages/Today',
  component: TodayViewStory,
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
} satisfies Meta<typeof TodayViewStory>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A new theme is out and this account has not seen it (SPO-355): the invite sits under the day heading, drawn in the new theme; Preview puts the whole app and the dock in it. */
export const NewThemeInvite: Story = {
  decorators: [
    (Story) => (
      <>
        <Story />
        <ThemePreviewHost />
      </>
    ),
  ],
  loaders: [
    () => {
      seedPage();
      resetSeenForTest();
      syncSeenFromDoc({}, () => undefined);
      return {};
    },
  ],
};

function DrawersOverToday({ depth }: { depth: number }) {
  const store = useStore();
  const [open, setOpen] = useState(depth);
  const names = ['Start a workout', 'Plate calculator', 'Barbell Bench Press'];
  return (
    <>
      <TodayView shell={storyShell} store={store} />
      {names.slice(0, open).map((name, i) => (
        <Sheet key={name} onClose={() => setOpen((n) => Math.min(n, i))} label={name}>
          <SectionLabel>{name}</SectionLabel>
          {i === open - 1 && i < names.length - 1 && (
            <Button onClick={() => setOpen(i + 2)}>Open next drawer</Button>
          )}
        </Sheet>
      ))}
    </>
  );
}

/** SPO-466: the real Today under one / two / three stacked drawers — one scrim, only the top drawer closes, the page takes no click. */
export const OneDrawer: StoryObj<typeof DrawersOverToday> = {
  render: () => <DrawersOverToday depth={1} />,
};
export const TwoDrawers: StoryObj<typeof DrawersOverToday> = {
  render: () => <DrawersOverToday depth={2} />,
};
export const ThreeDrawers: StoryObj<typeof DrawersOverToday> = {
  render: () => <DrawersOverToday depth={3} />,
};
