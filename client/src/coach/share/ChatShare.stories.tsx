import type { Meta, StoryObj } from '@storybook/react-vite';
import { ShareStoryFrame } from './ShareStoryFrame';

/**
 * Share and Notes inside the Coach chat (S-16b..d), in the real shell with the Oleh thread open. Pick the viewport in
 * the toolbar: 1440 / 1024 = list + thread with popover and drawer, 390 = the thread with sheets. The lab shots these
 * reproduce are v11-chat-share-* and v11-notes-* / v11-peek-*.
 */
const meta = {
  title: 'Pages/Coach/Chat share',
  component: ShareStoryFrame,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ShareStoryFrame>;
export default meta;
type Story = StoryObj<typeof meta>;

const prog = { kind: 'program', id: 'upper-lower-4x' } as const;
const day = { kind: 'day', id: 'upper-lower-4x:0' } as const;
const bench = { kind: 'exercise', id: 'Barbell_Bench_Press_-_Medium_Grip' } as const;

/** 1 - the Share button next to the composer. */
export const Button: Story = { args: {} };
/** 2 - the picker, empty query: suggested for this chat, in this conversation, recent. */
export const PickerOpen: Story = { args: { initial: { picker: {} }, sent: [{ share: day }] } };
/** 3 - search "bench": groups of three with Show all, and why a row matched. */
export const PickerSearch: Story = { args: { initial: { picker: { q: 'bench' } } } };
/** 3b - a date in the query: workouts and activities of that day. */
export const PickerDate: Story = { args: { initial: { picker: { q: '6 oct' } } } };
/** 4 - one type chosen: the full list with its sort. */
export const PickerCategory: Story = { args: { initial: { picker: { filter: 'exercise' } } } };
/** 5 - nothing found. */
export const PickerEmpty: Story = { args: { initial: { picker: { q: 'zzzzqq' } } } };
/** 6 - Oleh shares no totals: workout days and activities are a locked group. */
export const PickerLocked: Story = {
  args: { initial: { picker: { filter: 'workout' } }, off: ['totals'] },
};
/** 6b - Oleh shares neither totals nor sets: every client-data type is locked. */
export const PickerLockedAll: Story = {
  args: { initial: { picker: { q: 'a' } }, off: ['totals', 'sets'] },
};
/** Loading what can be shared (the source is slow): skeleton rows, the field works. */
export const PickerLoading: Story = { args: { initial: { picker: {} }, slow: true } };
/** 7 - an item picked: the card waits above the field, Send works without text. */
export const PendingChip: Story = { args: { initial: { pending: day } } };
/** 8 - sent: the card in the thread with "You shared" and a caption. */
export const Sent: Story = {
  args: {
    sent: [
      { share: prog, text: 'Here is the plan for next month.' },
      { share: bench },
      { share: { kind: 'workout', id: 'w1-0', ownerId: 'c1' } },
    ],
  },
};
/** 9 - a card opened: the library peek over the chat. */
export const Opened: Story = { args: { sent: [{ share: bench }], initial: { peek: bench } } };
/** Notes drawer (desktop) or sheet (phone). */
export const NotesDrawer: Story = { args: { initial: { notesOpen: true } } };
export const NotesAdd: Story = {
  args: {
    initial: {
      notesOpen: true,
      notes: { text: 'Check the count of the pause next Friday.', vis: 'shared' },
    },
  },
};
export const NotesEmpty: Story = { args: { initial: { notesOpen: true }, notesEmpty: true } };
export const NotesSearch: Story = { args: { initial: { notesOpen: true, notes: { q: 'bench' } } } };
export const NotesJump: Story = { args: { initial: { notesOpen: true, highlightNote: 'n3' } } };
export const NotesDelete: Story = {
  args: { initial: { notesOpen: true, notes: { confirmId: 'n1' } } },
};
export const PrivateNoteMode: Story = { args: { initial: { noteMode: true } } };
