import type { Meta, StoryObj } from '@storybook/react-vite';
import { WidgetLibrary } from './WidgetLibrary';
import { activityHistory, seedStore, storyShell, workoutOn } from '../stories/fixtures';
import { LOCALES } from '../i18n';
import { useTw } from './strings';
import { useStore } from '../store';

const STORY_NOW = Date.now();

function Library() {
  const store = useStore();
  const tw = useTw();
  return (
    <WidgetLibrary
      ctx={{
        store,
        now: STORY_NOW,
        t: LOCALES.en,
        tw,
        locale: 'en',
        shell: storyShell,
        openWeight: () => undefined,
        startToday: () => undefined,
        logPast: () => undefined,
      }}
    />
  );
}

const meta = {
  title: 'Today/Widget library',
  component: Library,
  parameters: { layout: 'padded' },
  loaders: [
    () => {
      seedStore({
        workouts: [1, 2, 4, 6, 8, 9, 11, 13, 15].map((d, i) => workoutOn(`w${i}`, d)),
        activities: activityHistory(),
      });
      return {};
    },
  ],
} satisfies Meta<typeof Library>;
export default meta;

/** Every widget in S · M · L · XL and every XS shortcut. */
export const All: StoryObj<typeof meta> = {};
