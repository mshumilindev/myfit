import type { Meta, StoryObj } from '@storybook/react-vite';
import { WidgetGrid, WidgetSection, SECTION_LAYOUTS } from './WidgetGrid';
import { Widget, WidgetBar } from './Widget';
import { ShortcutTile } from './ShortcutTile';
import { Stack } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/WidgetGrid',
  component: WidgetGrid,
  decorators: [
    (Story) => (
      <div style={{ width: 350 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WidgetGrid>;
export default meta;
type Story = StoryObj<typeof meta>;

const S = (k: string, v: string, u?: string) => (
  <Widget size="S" tone="ok" kicker={k} value={v} unit={u}>
    <WidgetBar value={0.7} />
  </Widget>
);

/** Every section layout with sample widgets (the slot size decides the widget size). */
export const Layouts: Story = {
  render: () => (
    <Stack gap={24}>
      <WidgetSection title="Shortcuts · XS × 4–8" layout="shortcuts">
        <ShortcutTile label="Chest 1" icon="play" primary />
        <ShortcutTile label="Dance" icon="disco-ball" tone="active" />
        <ShortcutTile
          label="Run"
          icon="person-simple-run"
          tone="active"
          state="live"
          meta="24:10"
        />
        <ShortcutTile label="Home set" icon="house" tone="accent" state="done" />
      </WidgetSection>
      <WidgetSection title="Pair · S + S" layout="pair">
        {S('Readiness', '82', '%')}
        {S('Sleep', '8', 'h 30m')}
      </WidgetSection>
      <WidgetSection title="Quad · 4 × S" layout="quad">
        {S('Readiness', '82', '%')}
        {S('Sleep', '8', 'h')}
        {S('Streak', '12', 'days')}
        {S('Volume', '18.2', 't')}
      </WidgetSection>
      <WidgetSection title="Rows · M × 1–5" layout="rows">
        <Widget
          size="M"
          tone="apex"
          icon="trophy"
          title="Consistency 30"
          sub="18 of 30 days"
          onClick={() => undefined}
        />
        <Widget
          size="M"
          tone="apex"
          icon="flame"
          title="12-day streak"
          sub="Best 21"
          onClick={() => undefined}
        />
      </WidgetSection>
      <WidgetSection title="Wide · L" layout="wide">
        <Widget
          size="L"
          tone="accent"
          kicker="Bench e1RM"
          value="102"
          unit="kg"
          sub="+2.5 · 4 wks"
        />
      </WidgetSection>
      <WidgetSection title="Wide + pair · L · S S" layout="wide-pair">
        <Widget size="L" tone="accent" kicker="Volume" value="18.2" unit="t" />
        {S('Readiness', '82', '%')}
        {S('Sleep', '8', 'h')}
      </WidgetSection>
      <WidgetSection title="Big · XL" layout="big">
        <Widget
          size="XL"
          tone="ok"
          kicker="Muscle readiness"
          value="82"
          unit="%"
          sub="Legs back by Saturday"
        />
      </WidgetSection>
    </Stack>
  ),
};

/** The catalogue of layouts and their slots (data used by the Customize sheet). */
export const LayoutCatalogue: Story = {
  render: () => (
    <Stack>
      {SECTION_LAYOUTS.map((l) => (
        <div key={l.id} style={{ font: '500 13px var(--font)', color: 'var(--color-text)' }}>
          {l.id} — {l.sizes} — slots: {l.slots.join(' ')}
        </div>
      ))}
    </Stack>
  ),
};
