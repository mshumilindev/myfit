import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from './Avatar';
import { IconButton } from './Button';
import { ChatBubble, ChatDay, ChatMessage, ChatNewDivider } from './ChatBubble';

const meta = {
  title: 'Coach/Chat bubbles',
  component: ChatBubble,
  parameters: { layout: 'padded' },
  args: {
    side: 'them',
    children: 'Iryna, my left shoulder is sore again after the incline press.',
  },
} satisfies Meta<typeof ChatBubble>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

const dots = <IconButton icon="dots-three" label="Message actions" size="sm" />;

/** A thread slice: day divider, both sides, the New messages line, a system line. */
export const Thread: Story = {
  render: () => (
    <ol
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        margin: 0,
        padding: 0,
        maxWidth: 560,
      }}
    >
      <ChatDay>Yesterday</ChatDay>
      <ChatMessage
        side="them"
        time="19:40"
        sender={
          <>
            <Avatar name="Oleh Bondar" size={24} />
            Oleh
          </>
        }
        actions={dots}
      >
        <ChatBubble side="them">
          Iryna, my left shoulder is sore again after the incline dumbbell press. Should I lower the
          weight?
        </ChatBubble>
      </ChatMessage>
      <ChatMessage side="me" time="20:11" sender={<>You</>} actions={dots}>
        <ChatBubble side="me">
          Thanks for telling me. This week we swap it for a 30 degree incline press.
        </ChatBubble>
      </ChatMessage>
      <ChatMessage side="center">
        <ChatBubble system kind={{ icon: 'arrows-clockwise', label: 'Update' }}>
          Program updated: Upper B, overhead press to 30 degree incline press
        </ChatBubble>
      </ChatMessage>
      <ChatNewDivider>New messages</ChatNewDivider>
      <ChatMessage side="them" time="08:02">
        <ChatBubble side="them">
          Ok, I will send the video tonight. Can I move legs to Saturday?
        </ChatBubble>
      </ChatMessage>
    </ol>
  ),
};

/** Quiet states: deleted, unverified, sending, failed, and a toned card bubble (share blue, note brass). */
export const States: Story = {
  render: () => (
    <ol
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        margin: 0,
        padding: 0,
        maxWidth: 560,
      }}
    >
      <ChatMessage side="me">
        <ChatBubble side="me" muted icon="trash">
          You deleted a message
        </ChatBubble>
      </ChatMessage>
      <ChatMessage side="them">
        <ChatBubble side="them" muted icon="warning-circle">
          Couldn&apos;t verify this message
        </ChatBubble>
      </ChatMessage>
      <ChatMessage side="me">
        <ChatBubble side="me" state="sending" stateLabel="Sending...">
          Same plan on Wednesday.
        </ChatBubble>
      </ChatMessage>
      <ChatMessage side="me">
        <ChatBubble
          side="me"
          state="failed"
          stateLabel="Couldn't send"
          retryLabel="Retry"
          onRetry={() => undefined}
        >
          Same plan on Wednesday.
        </ChatBubble>
      </ChatMessage>
      <ChatMessage side="me">
        <ChatBubble
          side="me"
          tone="share"
          kind={{ icon: 'share-network', label: 'You shared . program' }}
        >
          A card goes here (M5)
        </ChatBubble>
      </ChatMessage>
      <ChatMessage side="me">
        <ChatBubble
          side="me"
          tone="note"
          kind={{ icon: 'lock-simple', label: 'Private note . only you' }}
        >
          Third time this month he mentions the left shoulder.
        </ChatBubble>
      </ChatMessage>
    </ol>
  ),
};

/** Long unbroken text and many lines wrap inside the bubble; nothing touches an edge. */
export const LongText: Story = {
  render: () => (
    <div style={{ maxWidth: 360 }}>
      <ChatBubble side="them">
        {
          'Supercalifragilisticexpialidocious_Supercalifragilisticexpialidocious\nLine two\n\nLine four with a long sentence that wraps over several lines in a narrow column.'
        }
      </ChatBubble>
    </div>
  ),
};
