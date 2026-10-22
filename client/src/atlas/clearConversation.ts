import { setCoach } from '../store';
import { clearChat } from './chatLog';
import { clearSaid } from './memory';

/**
 * Clear the Atlas conversation on this device (the last 100 messages and what Atlas said, for consistency): not your log,
 * not what he remembers about you. Used by "Clear chat" in Atlas settings and by turning the AI chat off.
 */
export function clearAtlasConversation(): void {
  clearChat();
  clearSaid();
  const now = Date.now();
  setCoach({ clearedAt: now, readAt: now });
}
