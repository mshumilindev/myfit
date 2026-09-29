import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Widget,
  WidgetBar,
  WidgetBars,
  WidgetDelta,
  WidgetList,
  WidgetRing,
  WidgetSpark,
  WidgetStats,
  WidgetEmpty,
  WIDGET_SIZES,
} from './Widget';
import { Button } from './Button';
import { TONES } from './tones';
import { Row, Stack } from '../../stories/LocaleMatrix';

/** Stories render widgets at their phone widths: S = 170, M/L/XL = 350. */
const W = { S: 170, M: 350, L: 350, XL: 350 } as const;

const meta = {
  title: 'Kit/Widget',
  component: Widget,
  args: {
    size: 'S',
    tone: 'ok',
    icon: 'heartbeat',
    kicker: 'Readiness',
    value: '82',
    unit: '%',
    sub: 'Legs recovering',
    onClick: () => undefined,
  },
  argTypes: {
    size: { control: 'inline-radio', options: WIDGET_SIZES },
    tone: { control: 'select', options: TONES },
  },
  render: (args) => <Widget {...args} style={{ width: W[args.size] }} />,
} satisfies Meta<typeof Widget>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** One widget (Readiness) in all four sizes — the contract every widget follows. */
export const FourSizes: Story = {
  render: () => (
    <Stack gap={16}>
      <Row>
        <Widget
          size="S"
          tone="ok"
          kicker="Readiness"
          value="82"
          unit="%"
          sub="Legs recovering"
          style={{ width: W.S }}
        >
          <WidgetBar value={0.82} />
        </Widget>
        <Widget
          size="M"
          tone="ok"
          icon="heartbeat"
          title="Readiness 82%"
          sub="Upper fresh · legs recovering"
          onClick={() => undefined}
          style={{ width: W.M }}
        />
      </Row>
      <Row>
        <Widget
          size="L"
          tone="ok"
          kicker="Readiness"
          badge={<WidgetDelta>+6 vs yesterday</WidgetDelta>}
          style={{ width: W.L }}
        >
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <WidgetRing value={0.82} size={96}>
              82
            </WidgetRing>
            <WidgetList
              rows={[
                { label: 'Chest', value: '100' },
                { label: 'Back', value: '92' },
                { label: 'Legs', value: '61' },
              ]}
            />
          </div>
        </Widget>
        <Widget
          size="XL"
          tone="ok"
          kicker="Muscle readiness"
          badge="82%"
          footer={
            <Button variant="secondary" size="sm" fullWidth>
              Open muscles
            </Button>
          }
          style={{ width: W.XL }}
        >
          <WidgetList
            rows={[
              { label: 'Chest', value: '100' },
              { label: 'Back', value: '92' },
              { label: 'Shoulders', value: '94' },
              { label: 'Core', value: '76' },
              { label: 'Legs', value: '61' },
            ]}
          />
        </Widget>
      </Row>
    </Stack>
  ),
};

/** Kicker and accents in every colour family. */
export const Tones: Story = {
  render: () => (
    <Row>
      {TONES.map((tone) => (
        <Widget
          key={tone}
          size="S"
          tone={tone}
          kicker={tone}
          value="12"
          unit="days"
          sub="sample"
          style={{ width: W.S }}
        >
          <WidgetBar value={0.6} />
        </Widget>
      ))}
    </Row>
  ),
};

/** Body building blocks: bar, ring, sparkline, columns, list, stat tiles, delta. */
export const BuildingBlocks: Story = {
  render: () => (
    <Stack gap={16}>
      <Row>
        <Widget
          size="L"
          tone="ok"
          kicker="Bench e1RM"
          value="102"
          unit="kg"
          sub={<WidgetDelta>+2.5 · 4 wks</WidgetDelta>}
          bodyLast
          style={{ width: W.L }}
        >
          <WidgetSpark
            points={[90, 91, 90.5, 93, 92.5, 95, 96, 98, 99, 100, 102]}
            height={44}
            area
          />
        </Widget>
        <Widget
          size="L"
          tone="accent"
          kicker="Volume · 8 weeks"
          badge={<WidgetDelta>+8%</WidgetDelta>}
          value="18.2"
          unit="t"
          bodyLast
          style={{ width: W.L }}
        >
          <WidgetBars
            values={[11, 12.4, 10, 14, 13.2, 15.6, 14.4, 18.2]}
            highlight={[7]}
            height={44}
          />
        </Widget>
      </Row>
      <Row>
        <Widget size="S" tone="apex" kicker="Challenge" style={{ width: W.S }}>
          <div style={{ display: 'grid', placeItems: 'center', flex: 1 }}>
            <WidgetRing value={0.6} size={80}>
              18<small>of 30</small>
            </WidgetRing>
          </div>
        </Widget>
        <Widget
          size="L"
          tone="sleep"
          kicker="Last night"
          value="8"
          unit="h 30m"
          style={{ width: W.L }}
        >
          <WidgetStats
            items={[
              { label: 'Bedtime', value: '±24 min' },
              { label: 'Tonight', value: '23:00' },
              { label: 'Moon', value: '64%' },
            ]}
          />
        </Widget>
      </Row>
    </Stack>
  ),
};

/** Edge cases: long text is ellipsised, missing parts collapse. */
export const LongAndEmpty: Story = {
  render: () => (
    <Row>
      <Widget
        size="S"
        tone="accent"
        kicker="A very long kicker that will not fit"
        title="Pull + Shoulders + Arms extended"
        sub="A subline that is much longer than the card"
        style={{ width: W.S }}
      />
      <Widget
        size="M"
        tone="apex"
        icon="trophy"
        title="Consistency 30 — the long challenge name"
        sub="18 of 30 days · 12 left · next badge at day 20"
        onClick={() => undefined}
        style={{ width: W.M }}
      />
      <Widget size="S" tone="neutral" style={{ width: W.S }} />
    </Row>
  ),
};

/** Zero-data state in every size — the XL centres an icon tile instead of a blank square. */
export const Empty: Story = {
  render: () => (
    <Stack>
      <Row>
        <div style={{ width: W.S }}>
          <WidgetEmpty
            size="S"
            tone="sport"
            icon="path"
            kicker="This week"
            title="No distance this week"
          />
        </div>
        <div style={{ width: W.M }}>
          <WidgetEmpty
            size="M"
            tone="sport"
            icon="path"
            kicker="This week"
            title="No distance this week"
            sub="Log a run, walk or ride"
            action="Log activity"
            onAction={() => undefined}
          />
        </div>
      </Row>
      <Row>
        {(['L', 'XL'] as const).map((s) => (
          <div key={s} style={{ width: W[s] }}>
            <WidgetEmpty
              size={s}
              tone="sport"
              icon="path"
              kicker="This week"
              title="No distance this week"
              sub="Log a run, walk or ride"
              action="Log activity"
              onAction={() => undefined}
            />
          </div>
        ))}
      </Row>
    </Stack>
  ),
};
