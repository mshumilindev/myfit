import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconButton } from './Button';
import { ChatBubble, ChatDay, ChatMessage } from './ChatBubble';
import { ChatComposer } from './ChatComposer';
import { ChatPage, ChatShell } from './ChatShell';

const meta = {
  title: 'Coach/Chat shell',
  component: ChatShell,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ChatShell>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The one frame every chat uses (trainer, client, Atlas): bar, scrolling list, composer. A phone shows it as the page. */
export const Default: Story = {
  args: {
    head: (
      <div className="ch-bar">
        <IconButton icon="caret-left" label="Back" />
        <div className="ch-bar-id">
          <b>Iryna</b>
          <small>Strength block</small>
        </div>
      </div>
    ),
    foot: (
      <ChatComposer
        value=""
        onChange={() => {}}
        onSend={() => {}}
        placeholder="Write to Iryna"
        sendLabel="Send"
        emptyReason="Write a message to send it"
      />
    ),
    children: (
      <div className="ch-scroll">
        <ol className="ch-list-m">
          <ChatDay>Today</ChatDay>
          <ChatMessage side="them" time="09:05">
            <ChatBubble side="them">Left shoulder is sore after the incline press.</ChatBubble>
          </ChatMessage>
          <ChatMessage side="me" time="09:07">
            <ChatBubble side="me">Drop the incline today, keep the rows light.</ChatBubble>
          </ChatMessage>
        </ol>
      </div>
    ),
  },
};

/** A screen chat (client, Atlas) in `ChatPage`: desktop gutter around the card, composer room set by the shell alone. */
export const InPage: Story = {
  args: Default.args,
  render: (args) => (
    <ChatPage>
      <ChatShell {...args} />
    </ChatPage>
  ),
};
