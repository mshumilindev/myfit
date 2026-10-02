import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconTile } from './IconTile';
import { OptionCard, OptionCardGrid } from './OptionCard';
import { LocaleMatrix, Stack } from '../../stories/LocaleMatrix';

const meta = {
  title: 'Kit/OptionCard',
  component: OptionCard,
  decorators: [
    (Story) => (
      <div style={{ width: 358 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    title: 'Together',
    sub: 'One stories strip',
    selected: false,
    onSelect: () => undefined,
  },
} satisfies Meta<typeof OptionCard>;
export default meta;
type Story = StoryObj<typeof meta>;

const dots = (n: number) => (
  <>
    {Array.from({ length: n }, (_, i) => (
      <span
        key={i}
        style={{
          width: 16,
          height: 16,
          borderRadius: 'var(--radius-pill)',
          border: '2px solid var(--color-accent)',
        }}
      />
    ))}
  </>
);

export const Playground: Story = {};

/** Off / on / disabled, with and without a preview. */
export const States: Story = {
  render: () => (
    <OptionCardGrid label="States">
      <OptionCard
        title="Off"
        sub="Not selected"
        preview={dots(3)}
        selected={false}
        onSelect={() => undefined}
      />
      <OptionCard title="On" sub="Selected" preview={dots(3)} selected onSelect={() => undefined} />
      <OptionCard
        title="Disabled"
        sub="Coming soon"
        selected={false}
        disabled
        onSelect={() => undefined}
      />
      <OptionCard title="No preview" selected={false} onSelect={() => undefined} />
    </OptionCardGrid>
  ),
};

function Picker() {
  const [v, setV] = useState('note');
  const opts = [
    ['note', 'Note of the day', 'One daily insight'],
    ['chat', 'Quick chat', 'Last message + replies'],
    ['compact', 'Compact', 'Face + one line'],
    ['auto', 'Off when no notes', 'Appears only if new'],
  ];
  return (
    <OptionCardGrid label="Atlas view">
      {opts.map(([id, title, sub]) => (
        <OptionCard
          key={id}
          title={title}
          sub={sub}
          preview={dots(id === 'compact' ? 1 : 2)}
          selected={v === id}
          onSelect={() => setV(id)}
        />
      ))}
    </OptionCardGrid>
  );
}

/** Interactive one-of-N picker, two columns. */
export const Interactive: Story = { render: () => <Picker /> };

/** Toned selection and long text. */
export const TonesAndLongText: Story = {
  render: () => (
    <Stack>
      <OptionCardGrid columns={3}>
        <OptionCard title="Sleep" tone="sleep" selected onSelect={() => undefined} />
        <OptionCard title="Rest" tone="rest" selected onSelect={() => undefined} />
        <OptionCard title="Sport" tone="sport" selected onSelect={() => undefined} />
      </OptionCardGrid>
      <OptionCardGrid>
        <OptionCard
          title="A very long option title that has to wrap onto two lines"
          sub="And an even longer sub-line that explains what happens when you pick it"
          selected
          onSelect={() => undefined}
        />
        <OptionCard title="Short" sub="Sub" selected={false} onSelect={() => undefined} />
      </OptionCardGrid>
    </Stack>
  ),
};

/** Leading icon: the ListRow layout, check centred at the end, one column of named choices. */
export const WithIcon: Story = {
  render: () => (
    <OptionCardGrid label="Coach sharing" columns={1}>
      <OptionCard
        icon={<IconTile tone="accent" size={30} icon="eye-slash" />}
        title="Off"
        sub="Nothing"
        selected={false}
        onSelect={() => undefined}
      />
      <OptionCard
        icon={<IconTile tone="accent" size={30} icon="sliders-horizontal" />}
        title="Effects only"
        sub="“Sleep need +10 min, readiness −3%.” No products or amounts."
        selected
        onSelect={() => undefined}
      />
      <OptionCard
        icon={<IconTile tone="accent" size={30} icon="eye" />}
        title="Full"
        sub="Products and your usual amounts."
        selected={false}
        onSelect={() => undefined}
      />
    </OptionCardGrid>
  ),
};

/** Real strings in the five locales. */
export const Locales: Story = {
  render: () => (
    <LocaleMatrix
      render={(t) => (
        <OptionCardGrid>
          <OptionCard
            title={t.todayAtlasLayout.together}
            sub={t.todayAtlasLayoutSub.together}
            preview={dots(4)}
            selected
            onSelect={() => undefined}
          />
          <OptionCard
            title={t.todayAtlasLayout.split}
            sub={t.todayAtlasLayoutSub.split}
            preview={dots(2)}
            selected={false}
            onSelect={() => undefined}
          />
        </OptionCardGrid>
      )}
    />
  ),
};
