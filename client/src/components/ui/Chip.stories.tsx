import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { LocaleId } from '../../i18n';
import { PG_LOCALES } from '../../i18n/coachProgram';
import { Chip, ChipGroup, type ChipTone } from './Chip';

const TONES: ChipTone[] = ['neutral', 'accent', 'danger', 'ok', 'rest', 'atlas'];

const meta = {
  title: 'Kit/Chip',
  component: Chip,
  args: { children: 'Chest', tone: 'neutral', size: 'md', selected: false },
  argTypes: { tone: { control: 'select', options: TONES } },
} satisfies Meta<typeof Chip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Static status pills in every tone, both sizes. */
export const Tones: Story = {
  render: () => (
    <ChipGroup>
      {TONES.map((t) => (
        <Chip key={t} tone={t}>
          {t}
        </Chip>
      ))}
      {TONES.map((t) => (
        <Chip key={`s${t}`} tone={t} size="xs" icon="clock">
          {t} sm
        </Chip>
      ))}
    </ChipGroup>
  ),
};

/** `lead`: a solid tab before the label (e.g. the "×2 per hand" sides badge). */
export const WithLead: Story = {
  render: () => (
    <ChipGroup>
      <Chip tone="accent" lead="×2">
        per hand
      </Chip>
      <Chip tone="rest" lead="×2">
        one side at a time
      </Chip>
      <Chip tone="accent" lead="×2" onClick={() => undefined}>
        per hand
      </Chip>
    </ChipGroup>
  ),
};

function Selectable() {
  const [on, setOn] = useState<string | null>('Back');
  return (
    <ChipGroup>
      {['Chest', 'Back', 'Legs', 'Shoulders'].map((m) => (
        <Chip key={m} selected={on === m} onClick={() => setOn(on === m ? null : m)}>
          {m}
        </Chip>
      ))}
      <Chip disabled onClick={() => undefined}>
        Disabled
      </Chip>
    </ChipGroup>
  );
}

/** Selectable chips (buttons with aria-pressed) + disabled. */
export const SelectableGroup: Story = { render: () => <Selectable /> };

/** Filter chips with a count (`count` prop: tabular, dimmed, announced as part of the name) in a `ChipGroup`. `scroll` keeps ONE row on a phone, `fill` makes equal columns. */
export const WithCounts: Story = {
  render: () => {
    const items: [string, number][] = [
      ['All', 14],
      ['Needs attention', 4],
      ['Improved', 6],
      ['Declined', 2],
      ['No change', 2],
    ];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 358 }}>
        <ChipGroup role="group" aria-label="Filter">
          {items.map(([l, n], i) => (
            <Chip key={l} selected={i === 0} count={n} onClick={() => undefined}>
              {l}
            </Chip>
          ))}
        </ChipGroup>
        <ChipGroup scroll role="group" aria-label="Filter (scrolls)">
          {items.map(([l, n], i) => (
            <Chip key={l} selected={i === 1} count={n} onClick={() => undefined}>
              {l}
            </Chip>
          ))}
        </ChipGroup>
        <ChipGroup fill role="group" aria-label="Filter (equal columns)">
          {items.slice(0, 3).map(([l, n], i) => (
            <Chip key={l} size="xs" selected={i === 2} count={n} onClick={() => undefined}>
              {l}
            </Chip>
          ))}
        </ChipGroup>
      </div>
    );
  },
};

const WEEK_ISO = [1, 2, 3, 4, 5, 6, 7] as const;
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function WeekRow({ first, locale }: { first: 1 | 7; locale: LocaleId }) {
  const short = PG_LOCALES[locale].dowShort;
  const full = PG_LOCALES[locale].dowFull;
  const order = first === 7 ? [7, 1, 2, 3, 4, 5, 6] : [...WEEK_ISO];
  const [on, setOn] = useState<number[]>([1, 3, 5, 7]);
  return (
    <ChipGroup grid data-weekrow={`start-${first}`} role="group" aria-label="Training days">
      {order.map((d) => {
        const sel = on.includes(d);
        return (
          <Chip
            key={d}
            size="md"
            selected={sel}
            icon={sel ? 'check' : undefined}
            aria-pressed={sel}
            aria-label={full[DOW[d - 1]]}
            onClick={() => setOn((c) => (c.includes(d) ? c.filter((x) => x !== d) : [...c, d]))}
          >
            {short[DOW[d - 1]]}
          </Chip>
        );
      })}
    </ChipGroup>
  );
}

/**
 * `ChipGroup grid`: seven weekday chips, ALWAYS one row of equal columns (320 px up to desktop), the week starting on
 * Mon or Sun. Picking a day never changes a chip's width: the check mark is an overlay, not part of the row.
 */
export const WeekdayGrid: Story = {
  render: (_args, ctx) => {
    const locale = (ctx.globals.locale as LocaleId | undefined) ?? 'en';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <WeekRow first={1} locale={locale} />
        <WeekRow first={7} locale={locale} />
      </div>
    );
  },
};
