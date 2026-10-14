import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge, badgeText } from './Badge';
import { Rail, RailItem } from './Rail';
import { TabBar } from './TabBar';
import { Avatar } from './Avatar';
import { Chip } from './Chip';
import { Icon } from '../../ui';
import { Row, Stack } from '../../stories/LocaleMatrix';

const VALUES = [0, 1, 7, 9, 10, 23, 148];

const meta = {
  title: 'Kit/Badge',
  component: Badge,
  args: { n: 3, tone: 'danger', size: 'sm' },
  argTypes: {
    tone: { control: 'select', options: ['danger', 'accent', 'neutral'] },
    size: { control: 'select', options: ['sm', 'md'] },
  },
} satisfies Meta<typeof Badge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** 0 renders nothing; 1..9 the number; above 9 "9+". Both sizes, all tones. */
export const Values: Story = {
  render: () => (
    <Stack>
      {(['danger', 'accent', 'neutral'] as const).map((tone) => (
        <Row key={tone}>
          {VALUES.map((n) => (
            <span key={n} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <code style={{ fontSize: 13 }}>{n}</code>
              <Badge n={n} tone={tone} />
              <Badge n={n} tone={tone} size="md" />
              <span style={{ fontSize: 13 }}>{badgeText(n) || '(hidden)'}</span>
            </span>
          ))}
        </Row>
      ))}
    </Stack>
  ),
};

/** On the 88px labelled rail and the 60px compact rail: same corner offset on both. */
export const OnRails: Story = {
  parameters: { layout: 'fullscreen', viewport: { value: 'web' } },
  render: () => (
    <div style={{ display: 'flex', gap: 24, height: 360 }}>
      {[true, false].map((labelled) => (
        <Rail
          key={String(labelled)}
          brand={<Avatar name="S" size={40} />}
          labelled={labelled}
          compact={!labelled}
        >
          {VALUES.slice(1, 5).map((n, i) => (
            <RailItem
              key={n}
              icon="chat-circle"
              label={`Chat ${n}`}
              ariaLabel={`Chat ${n}`}
              count={n}
              countLabel={`${n} unread`}
              active={i === 0}
            />
          ))}
        </Rail>
      ))}
    </div>
  ),
};

/** On the phone tab bar. */
export const OnTabBar: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div style={{ width: 390 }}>
      <TabBar
        onSelect={() => undefined}
        items={[
          { id: 'today', label: 'Today', icon: 'house', active: true },
          {
            id: 'clients',
            label: 'Clients',
            icon: 'users',
            badge: 3,
            ariaLabel: 'Clients, 3 unread',
          },
          {
            id: 'chat',
            label: 'Chat',
            icon: 'chat-circle',
            badge: 148,
            ariaLabel: 'Chat, 148 unread',
          },
          { id: 'more', label: 'More', icon: 'dots-three', badge: 0 },
        ]}
      />
    </div>
  ),
};

/** Inline at a row end. */
export const OnRow: Story = {
  render: () => (
    <div style={{ width: 358, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1, 9, 23].map((n) => (
        <div
          key={n}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            minHeight: 44,
            padding: '0 12px',
          }}
        >
          <Avatar name="Oleh" size={32} />
          <span>Oleh Kovalenko</span>
          <Badge n={n} anchor="inline" label="unread" />
        </div>
      ))}
    </div>
  ),
};

/** On a round floating button (the chat dock FAB) and on an avatar. */
export const OnFabAndAvatar: Story = {
  render: () => (
    <Row gap={32}>
      <span style={{ position: 'relative', display: 'inline-grid', width: 44, height: 44 }}>
        <span style={{ display: 'grid', placeItems: 'center' }}>
          <Icon name="chat-circle" />
        </span>
        <Badge n={12} anchor="corner" />
      </span>
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <Avatar name="Iryna" size={40} />
        <Badge n={2} anchor="corner" />
      </span>
      <Chip>
        Notes <Badge n={4} tone="accent" />
      </Chip>
    </Row>
  ),
};
