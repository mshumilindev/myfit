/**
 * Coach chat strings (M4). Own dictionary like coachRoster / coachToday; read through `useChatT()` in
 * `coachChat.ts`. Every key is mirrored in uk / pl / lt / et (enforced by `typeof chatEn`).
 * Copy never says "end-to-end": keys are held with a server master (plan C.1).
 */
import { plural } from './coachPlural';

const convN = (n: number) =>
  plural('en', n, { one: '{n} conversation', other: '{n} conversations' });
const msgsN = (n: number) => plural('en', n, { one: '{n} message', other: '{n} messages' });

export const chatEn = {
  chTitle: 'Chat',
  chSubtitle: convN,
  chListLabel: 'Conversations',
  chBack: 'Chats',
  chGoClients: 'Go to Clients',
  chClient: 'Client',
  chOpenClient: 'Open client',
  chEmptyH: 'No conversations yet',
  chEmptyB: 'Invite a client and your conversation with them appears here.',
  chNoMessages: 'No messages yet',
  chYouPrefix: 'You: ',
  chUnreadLabel: (n: number) =>
    plural('en', n, { one: '{n} unread message', other: '{n} unread messages' }),
  chThreadLabel: (name: string) => `Conversation with ${name}`,
  chMessagesLabel: 'Messages',
  chNewDivider: 'New messages',
  chToday: 'Today',
  chYesterday: 'Yesterday',
  chWriteTo: (name: string) => `Write to ${name}`,
  chSend: 'Send',
  chSendNeedsText: 'Write a message to send it',
  chTooLong: (max: number) => `Too long. The limit is ${max} characters.`,
  chEncNote: 'Messages are encrypted on your device and stored encrypted.',
  chYou: 'You',
  chSending: 'Sending...',
  chFailed: "Couldn't send",
  chRetry: 'Retry',
  chDeletedMine: 'You deleted a message',
  chDeletedTheirs: (name: string) => `${name} deleted a message`,
  chUnverified: "Couldn't verify this message",
  chEarlier: 'Show earlier messages',
  chEarlierLoading: 'Loading earlier messages',
  chQueuedNote: 'Unsent messages are kept on this device.',
  chDockOpen: 'Open chat',
  chDockLabel: 'Chat dock',
  chDockClose: 'Close chat',
  chDockAll: 'All conversations',
  chUnsupported: 'Unsupported message. Update Spotter',
  chSystem: 'Update',
  chMenuMsg: 'Message actions',
  /** The same, with who and when, so every row's button has its own name. */
  chMenuMsgFor: (who: string) => `Message actions, ${who}`,
  chCopy: 'Copy',
  chCopied: 'Copied',
  chDelete: 'Delete message',
  chDeleteTheirs: (name: string) => `Only ${name} can delete this`,
  chDeleteRule: (name: string) =>
    `You can delete only your own messages. It disappears for you and ${name}.`,
  chDelTitle: 'Delete this message?',
  chDelBody: (name: string) =>
    `This removes it for you and for ${name}. A small line stays in the chat.`,
  chDelWho: (name: string) => `You and ${name} stop seeing the text`,
  chUndoSmall: 'You can undo for 8 seconds. After that it cannot be restored.',
  chDelConfirm: 'Delete',
  chCancel: 'Cancel',
  chMenuChat: 'Chat menu',
  chClear: 'Clear chat...',
  chClearHint: 'Only your copy',
  chClearTitle: 'Clear this chat?',
  chClearBody: (name: string) =>
    `This clears the chat on your side only. ${name} keeps their copy and can still read everything.`,
  chClearWho: (n: number) => `You stop seeing ${msgsN(n)}`,
  chClearKeeps: (name: string) => `${name} keeps every message`,
  chClearConfirm: 'Clear chat',
  chMsgDeleted: 'Message deleted',
  chCleared: 'Chat cleared',
  chUndo: 'Undo',
  chUndoCountdown: 'Undo is available for 8 seconds',
  chClearedH: 'Your copy is empty',
  chClearedB: (name: string) => `Only your copy. ${name} still has theirs.`,
  chEmptyThreadH: 'No messages yet',
  chEmptyThreadB: (name: string) => `Write the first message to ${name} below.`,
  chLoadFailed: "Couldn't load the chat",
  chOffline: 'You are offline. Messages send when you are back online.',
  chStale: (time: string) => `Showing the last saved chat from ${time}.`,
};
