/** Which adapters the hooks use. The real ones are the Firestore adapters installed by `data/firestore/install.ts`; before that (or when the install failed) the defaults only report `unavailable`. Test doubles come in through `testHooks.ts`. */
import { currentUid } from '../../api';
import { coachAdapter } from './backend';
import type { CoachWorldPort } from './port';
import { createUnavailableChatPort, createUnavailableWorldPort } from './unavailable';
import type { ConversationsPort } from './unreadStore';
import type { ChatPort } from '../chat/port';
import { conversationsFromChat } from '../chat/chatStore';
import type { ScheduleFeed } from './worldStore';

let world: CoachWorldPort | null = null;
let conversations: ConversationsPort | null = null;
let chat: ChatPort | null = null;
let uid: string | null = null;
let scheduleFeed: ScheduleFeed | null = null;

/** Override adapters (tests, stories, the future real adapter). Pass nothing to reset. */
export function configureCoachData(
  p: {
    world?: CoachWorldPort | null;
    conversations?: ConversationsPort | null;
    chat?: ChatPort | null;
    /** Stories / tests: act as this trainer without a signed-in user. */
    uid?: string | null;
    /** The live schedule as the single source of sessions (the real backend sets it; test doubles leave it off). */
    scheduleFeed?: ScheduleFeed | null;
  } = {},
): void {
  world = p.world ?? null;
  conversations = p.conversations ?? null;
  chat = p.chat ?? null;
  uid = p.uid ?? null;
  scheduleFeed = p.scheduleFeed ?? null;
}
/** The schedule feed the world follows, or null (the port's own snapshot). */
export const getScheduleFeed = (): ScheduleFeed | null => scheduleFeed;
/** The signed-in trainer (admin = coach), or the story / test override. */
export const getTrainerUid = (): string | null => uid ?? currentUid();
/** Default world = the unavailable stand-in (errors, never sample people); the real adapter replaces it on install. */
export const getWorldPort = (): CoachWorldPort =>
  (world ??= coachAdapter('world', createUnavailableWorldPort));
/** Default chat = the unavailable stand-in; the sealed Firestore adapter (`firestore/chatPort.ts`) replaces it on install. */
export const getChatPort = (): ChatPort =>
  (chat ??= coachAdapter('chat', createUnavailableChatPort));
/**
 * Default unread = derived from the chat port, so the rail / tab bar badge, the chat list and the dock read ONE
 * snapshot (R-FE-011). The real chat adapter will run the `firestoreConversations` query itself; this
 * adapter is replaced together with it (data/firestoreConversations.ts stays in place for that wiring).
 */
export const getConversationsPort = (): ConversationsPort =>
  conversations ?? conversationsFromChat(getChatPort());
