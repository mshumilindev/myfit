import type { Meta, StoryObj } from '@storybook/react-vite';
import { useMemo } from 'react';
import { FIXTURE_NOW } from '../data/__fixtures__/fixtures';
import { createFixturesNotesPort } from './__fixtures__/fixtures';
import { NotesPanel } from './NotesPanel';

/** The notes list as a page (Client 360 > Notes) and as the client's read-only list (client app, My trainer). */
const meta = {
  title: 'Pages/Coach/Notes',
  component: NotesPanel,
  parameters: { layout: 'padded' },
  args: { clientId: 'c1', first: 'Oleh', coachFirst: 'Iryna', variant: 'page', now: FIXTURE_NOW },
  decorators: [
    (Story, ctx) => {
      const port = useMemo(
        () => createFixturesNotesPort(ctx.parameters.empty ? { seed: { c1: [] } } : {}),
        [ctx.parameters.empty],
      );
      return <Story args={{ ...ctx.args, port }} />;
    },
  ],
} satisfies Meta<typeof NotesPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Trainer: Story = {};
export const Empty: Story = { parameters: { empty: true } };
export const Search: Story = { args: { initial: { q: 'bench' } } };
export const Adding: Story = {
  args: { initial: { text: 'Ask about the knee on Friday.', vis: 'shared' } },
};
export const Editing: Story = { args: { initial: { editId: 'n2' } } };
export const ConfirmDelete: Story = { args: { initial: { confirmId: 'n1' } } };
export const ClientReadOnly: Story = { args: { side: 'client' } };
export const ClientEmpty: Story = { args: { side: 'client' }, parameters: { empty: true } };
