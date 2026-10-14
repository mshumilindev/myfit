/** Which adapters the client-side trainer screens use. The real ones are `data/firestore/clientPort.ts` and `clientChatPort.ts`, installed by `install.ts`; until then the unavailable stand-ins. */
import { coachAdapter } from '../../data/backend';
import {
  createUnavailableClientChatPort,
  createUnavailableClientPort,
} from '../../data/unavailable';
import type { ClientCoachPort } from './port';
import type { ClientChatPort } from './chatPort';

let port: ClientCoachPort | null = null;
let chat: ClientChatPort | null = null;

/** Override adapters (tests, stories, the future real adapter). Nothing resets everything. */
export function configureClientCoach(
  p: { port?: ClientCoachPort | null; chat?: ClientChatPort | null } = {},
): void {
  port = p.port ?? null;
  chat = p.chat ?? null;
}

export const getClientPort = (): ClientCoachPort =>
  (port ??= coachAdapter('client', createUnavailableClientPort)); // not installed: errors, never a sample trainer
export const getClientChatPort = (): ClientChatPort =>
  (chat ??= coachAdapter('clientChat', createUnavailableClientChatPort));
