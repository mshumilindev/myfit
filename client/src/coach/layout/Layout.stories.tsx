import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Tag } from '../../components/ui/Tag';
import { useCoachT } from '../../i18n/coach';
import { Header, Inspector, Page, Split, Toolbar } from './Layout';
import { SidePanel } from './SidePanel';

/** Stands in for the shell's main column: same padding and scroll as `.co-main`. */
function MainColumn({ children }: { children: ReactNode }) {
  return (
    <main
      className="app-coach"
      tabIndex={0}
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'auto',
        padding: 'var(--co-gut) var(--co-pad)',
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
      }}
    >
      {children}
    </main>
  );
}

const meta = {
  title: 'Coach/Layout',
  parameters: { layout: 'fullscreen', viewport: { value: 'web' } },
  decorators: [
    (Story) => (
      <MainColumn>
        <Story />
      </MainColumn>
    ),
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

function Block({ title, height = 120 }: { title: string; height?: number }) {
  return (
    <Card pad="md">
      <strong>{title}</strong>
      <div style={{ height }} />
    </Card>
  );
}

function Skeleton58Page() {
  const { c } = useCoachT();
  return (
    <Page>
      <Header
        eyebrow={c.modeCoach}
        title={c.navClients}
        subtitle="14 clients, 5 need attention"
        pills={<Tag tone="danger">5</Tag>}
        actions={<Button size="sm">{c.navSchedule}</Button>}
      />
      <Toolbar label={c.navClients}>
        <Button variant="secondary" size="sm">
          {c.navAgenda}
        </Button>
        <Button variant="secondary" size="sm">
          {c.navWeek}
        </Button>
      </Toolbar>
      <Split ratio="5-7">
        <Block title="List 5" height={480} />
        <Block title="Detail 7" height={480} />
      </Split>
    </Page>
  );
}

function Skeleton84Page() {
  const { c } = useCoachT();
  return (
    <Page>
      <Header eyebrow={c.modeCoach} title={c.navAgenda} subtitle="3 decisions waiting" />
      <Split ratio="8-4">
        <Block title="Main 8" height={900} />
        <Inspector label="Inspector">
          <strong>Inspector 4</strong>
          <p>Sticks while the main column scrolls; stacks under it at 1100 and below.</p>
        </Inspector>
      </Split>
    </Page>
  );
}

/** Master-detail 5/7 (web, 1280). */
export const Skeleton58: Story = { render: () => <Skeleton58Page /> };

/** Main + sticky inspector 8/4 (web, 1280). */
export const Skeleton84: Story = { render: () => <Skeleton84Page /> };

/** Phone 390: 16px gutters, everything stacks, header min 56. */
export const Phone: Story = {
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { viewport: { value: 'phone' } },
  render: () => <Skeleton58Page />,
};

function DrawerDemo() {
  const { c } = useCoachT();
  const [open, setOpen] = useState(true);
  return (
    <Page>
      <Header eyebrow={c.modeCoach} title={c.navSignals} actions={null} />
      <div>
        <Button onClick={() => setOpen(true)}>Open drawer</Button>
      </div>
      <SidePanel
        open={open}
        onClose={() => setOpen(false)}
        title={c.navSignals}
        closeLabel={c.drawerClose}
      >
        <p>
          The kit Sheet: a right panel on a wide screen, a bottom sheet on a phone; scrim, Esc
          closes, focus returns.
        </p>
      </SidePanel>
    </Page>
  );
}

export const DrawerOpen: Story = { render: () => <DrawerDemo /> };
