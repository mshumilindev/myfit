import type { Meta, StoryObj } from '@storybook/react-vite';
import { LogActivityView } from '../LogActivityView';
import { pinsPref } from '../../activityPrefs';
import { activityHistory, seedStore, storyShell } from '../../stories/fixtures';
import { PageFrame } from '../../stories/PageFrame';

/** Composed page sections of Log activity (docs/design/log-activity m01–m08, w01–w04). */
const meta = {
  title: 'Pages/Log activity',
  component: LogActivityView,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <PageFrame>
        <Story />
      </PageFrame>
    ),
  ],
  args: { shell: storyShell, onClose: () => undefined },
  beforeEach: () => {
    seedStore({ activities: activityHistory() });
    pinsPref.set(['run', 'dance', 'sauna']);
  },
} satisfies Meta<typeof LogActivityView>;
export default meta;
type Story = StoryObj<typeof meta>;

function click(root: HTMLElement, pick: (el: HTMLElement) => boolean): void {
  const el = [...root.querySelectorAll<HTMLElement>('button, [role="button"]')].find(pick);
  el?.click();
}
const wait = () => new Promise((r) => setTimeout(r, 50));

/** m01 — the main page (hero, pinned, categories). */
export const Main: Story = {};

/** m03 — the quick-log sheet from a category page. */
export const QuickLogSheet: Story = {
  args: { cat: 'conditioning' },
  play: async ({ canvasElement }) => {
    click(canvasElement.ownerDocument.body, (b) =>
      /^Run[,]/.test(b.getAttribute('aria-label') ?? ''),
    );
    await wait();
  },
};

/** m04 — quick log › Pick a day: the shared calendar with activity markers. */
export const QuickLogPickDay: Story = {
  args: { cat: 'conditioning' },
  play: async ({ canvasElement }) => {
    const body = canvasElement.ownerDocument.body;
    click(body, (b) => /^Run[,]/.test(b.getAttribute('aria-label') ?? ''));
    await wait();
    click(body, (b) => b.textContent?.trim() === 'Pick a day');
    await wait();
  },
};

/** w01 — web: empty Quick log panel. */
export const Web: Story = {
  globals: { viewport: { value: 'web', isRotated: false } },
};

/** w02 — web: Quick log panel filled (Pick a day). */
export const WebQuickLog: Story = {
  globals: { viewport: { value: 'web', isRotated: false } },
  play: async ({ canvasElement }) => {
    const body = canvasElement.ownerDocument.body;
    click(body, (b) => /^Run, pinned/.test(b.getAttribute('aria-label') ?? ''));
    await wait();
    click(body, (b) => b.textContent?.trim() === 'Pick a day');
    await wait();
  },
};
